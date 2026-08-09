/**
 * Mobile virtual joystick + look + Q/E vertical buttons (Etapa C / D6).
 * Drives Navigation via setMoveAxes / setVertical / applyLookDelta.
 * Touches that start on docks/HUD/controls do not steal canvas look.
 */

import { isMobileViewport } from './CollapsibleDock.js';

const UI_BLOCK_SELECTOR = [
  '#left-dock',
  '#right-dock',
  '#bottom-hud',
  '#top-navbar',
  '#boot-progress',
  '#visualization-controls-container',
  '#landscape-gate',
  '#touch-controls',
  '.glass-modal',
  '.modal-overlay',
  '.field-info-tip',
  '.field-info-btn',
].join(',');

/**
 * @param {EventTarget | null} target
 * @returns {boolean}
 */
export function isUiTouchTarget(target) {
  if (!target || typeof target.closest !== 'function') {
    const tag = target && target.tagName ? String(target.tagName).toUpperCase() : '';
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON';
  }
  if (target.closest(UI_BLOCK_SELECTOR)) return true;
  const tag = target.tagName ? String(target.tagName).toUpperCase() : '';
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON';
}

/**
 * Normalize stick offset into [-1, 1] axes.
 * @param {number} dx
 * @param {number} dy
 * @param {number} maxRadius
 * @returns {{ x: number, z: number }}
 */
export function stickToAxes(dx, dy, maxRadius = 48) {
  const r = Math.max(1, maxRadius);
  let x = dx / r;
  let z = dy / r; // screen +Y is down → forward is -z when stick up
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  // Invert Y so stick-up = forward (KeyW / -z)
  return { x, z: -z };
}

export class TouchControls {
  /**
   * @param {object} options
   * @param {HTMLElement} options.parent
   * @param {import('../engine/Navigation.js').Navigation} options.navigation
   * @param {HTMLElement} [options.canvas]
   * @param {() => boolean} [options.isMobile]
   * @param {Document} [options.doc]
   */
  constructor(options) {
    if (!options?.parent || !options?.navigation) {
      throw new Error('TouchControls requires parent and navigation');
    }
    this.navigation = options.navigation;
    this.canvas = options.canvas || null;
    this._doc = options.doc || document;
    this._isMobile = typeof options.isMobile === 'function'
      ? options.isMobile
      : () => isMobileViewport();

    this.root = this._doc.createElement('div');
    this.root.id = 'touch-controls';
    this.root.className = 'touch-controls hidden';
    this.root.innerHTML = `
      <div class="touch-joystick" id="touch-joystick" aria-label="Virtual joystick">
        <div class="touch-joystick-base">
          <div class="touch-joystick-knob" id="touch-joystick-knob"></div>
        </div>
      </div>
      <div class="touch-vert-btns">
        <button type="button" class="touch-vert-btn" data-vert="1" aria-label="Ascend">▲</button>
        <button type="button" class="touch-vert-btn" data-vert="-1" aria-label="Descend">▼</button>
      </div>
    `;
    options.parent.appendChild(this.root);

    this.joystick = this.root.querySelector('#touch-joystick');
    this.knob = this.root.querySelector('#touch-joystick-knob');
    this._stickId = null;
    this._lookId = null;
    this._lookPrev = null;
    this._baseRect = null;

    this._onResize = () => this.refreshVisibility();
    this._onStickStart = (e) => this._stickStart(e);
    this._onStickMove = (e) => this._stickMove(e);
    this._onStickEnd = (e) => this._stickEnd(e);
    this._onLookStart = (e) => this._lookStart(e);
    this._onLookMove = (e) => this._lookMove(e);
    this._onLookEnd = (e) => this._lookEnd(e);
    this._onVertDown = (e) => this._vertDown(e);
    this._onVertUp = (e) => this._vertUp(e);

    this.joystick.addEventListener('pointerdown', this._onStickStart);
    window.addEventListener('pointermove', this._onStickMove);
    window.addEventListener('pointerup', this._onStickEnd);
    window.addEventListener('pointercancel', this._onStickEnd);

    const lookTarget = this.canvas || this._doc;
    lookTarget.addEventListener('pointerdown', this._onLookStart);
    window.addEventListener('pointermove', this._onLookMove);
    window.addEventListener('pointerup', this._onLookEnd);
    window.addEventListener('pointercancel', this._onLookEnd);

    this.root.querySelectorAll('.touch-vert-btn').forEach((btn) => {
      btn.addEventListener('pointerdown', this._onVertDown);
      btn.addEventListener('pointerup', this._onVertUp);
      btn.addEventListener('pointerleave', this._onVertUp);
      btn.addEventListener('pointercancel', this._onVertUp);
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this._onResize);
      window.addEventListener('orientationchange', this._onResize);
    }

    this.refreshVisibility();
  }

  refreshVisibility() {
    const show = this._isMobile();
    this.root.classList.toggle('hidden', !show);
    if (!show) {
      this.navigation.setMoveAxes(0, 0);
      this.navigation.setVertical(0);
      this._resetKnob();
    }
  }

  _stickStart(e) {
    if (!this._isMobile()) return;
    e.preventDefault();
    e.stopPropagation();
    this._stickId = e.pointerId;
    this.joystick.setPointerCapture?.(e.pointerId);
    this._baseRect = this.joystick.querySelector('.touch-joystick-base').getBoundingClientRect();
    this._updateStick(e.clientX, e.clientY);
  }

  _stickMove(e) {
    if (this._stickId !== e.pointerId) return;
    e.preventDefault();
    this._updateStick(e.clientX, e.clientY);
  }

  _stickEnd(e) {
    if (this._stickId !== e.pointerId) return;
    this._stickId = null;
    this.navigation.setMoveAxes(0, 0);
    this._resetKnob();
  }

  _updateStick(clientX, clientY) {
    const rect = this._baseRect;
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width / 2 - 8;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > maxR) {
      dx = (dx / len) * maxR;
      dy = (dy / len) * maxR;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const axes = stickToAxes(dx, dy, maxR);
    this.navigation.setMoveAxes(axes.x, axes.z);
  }

  _resetKnob() {
    if (this.knob) this.knob.style.transform = 'translate(0px, 0px)';
  }

  _lookStart(e) {
    if (!this._isMobile()) return;
    if (e.pointerType === 'mouse') return;
    if (this._stickId === e.pointerId) return;
    if (isUiTouchTarget(e.target)) return;
    const tag = e.target && e.target.tagName ? e.target.tagName.toUpperCase() : '';
    if (tag !== 'CANVAS') return;
    this._lookId = e.pointerId;
    this._lookPrev = { x: e.clientX, y: e.clientY };
  }

  _lookMove(e) {
    if (this._lookId !== e.pointerId || !this._lookPrev) return;
    const dx = e.clientX - this._lookPrev.x;
    const dy = e.clientY - this._lookPrev.y;
    this._lookPrev = { x: e.clientX, y: e.clientY };
    this.navigation.applyLookDelta(dx, dy);
  }

  _lookEnd(e) {
    if (this._lookId !== e.pointerId) return;
    this._lookId = null;
    this._lookPrev = null;
  }

  _vertDown(e) {
    if (!this._isMobile()) return;
    e.preventDefault();
    e.stopPropagation();
    const dir = parseInt(e.currentTarget.getAttribute('data-vert'), 10) || 0;
    this.navigation.setVertical(dir);
  }

  _vertUp(e) {
    e.preventDefault();
    this.navigation.setVertical(0);
  }

  destroy() {
    window.removeEventListener('pointermove', this._onStickMove);
    window.removeEventListener('pointerup', this._onStickEnd);
    window.removeEventListener('pointercancel', this._onStickEnd);
    window.removeEventListener('pointermove', this._onLookMove);
    window.removeEventListener('pointerup', this._onLookEnd);
    window.removeEventListener('pointercancel', this._onLookEnd);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
  }
}
