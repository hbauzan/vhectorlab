/**
 * Soft portrait overlay for phone viewports (roadmap D13 / Etapa B).
 *
 * Landscape = recommended. Portrait shows a dismissible overlay; after dismiss,
 * sessionStorage prevents re-spam until a new session. Does not lock orientation
 * and does not pause the render loop.
 */

import { MOBILE_MQ, isMobileViewport } from './CollapsibleDock.js';

export const LANDSCAPE_DISMISS_KEY = 'vl3d.landscapeGate.dismissed';

/**
 * @param {() => { width: number, height: number }} [getSize]
 * @returns {boolean} true when phone-sized AND taller than wide (portrait)
 */
export function isPhonePortrait(getSize = () => ({
  width: typeof window !== 'undefined' ? window.innerWidth : 1024,
  height: typeof window !== 'undefined' ? window.innerHeight : 768,
})) {
  const { width, height } = getSize();
  const phone = width <= 768;
  return phone && height > width;
}

/**
 * @param {Storage | null | undefined} session
 * @param {string} [key]
 */
export function wasLandscapeGateDismissed(session, key = LANDSCAPE_DISMISS_KEY) {
  if (!session || typeof session.getItem !== 'function') return false;
  return session.getItem(key) === '1';
}

/**
 * @param {Storage | null | undefined} session
 * @param {string} [key]
 */
export function dismissLandscapeGate(session, key = LANDSCAPE_DISMISS_KEY) {
  if (!session || typeof session.setItem !== 'function') return;
  session.setItem(key, '1');
}

/**
 * Pure visibility decision for tests / wiring.
 * @param {{ isPortrait: boolean, dismissed: boolean, isMobile: boolean }} state
 */
export function shouldShowLandscapeGate(state) {
  if (!state.isMobile) return false;
  if (!state.isPortrait) return false;
  if (state.dismissed) return false;
  return true;
}

export class LandscapeGate {
  /**
   * @param {object} options
   * @param {HTMLElement} options.parent
   * @param {Document} [options.doc]
   * @param {Storage | null} [options.sessionStorage]
   * @param {() => boolean} [options.isMobile]
   * @param {() => boolean} [options.isPortrait]
   */
  constructor(options) {
    if (!options || !options.parent) {
      throw new Error('LandscapeGate requires options.parent');
    }
    this._doc = options.doc || document;
    this._session = options.sessionStorage !== undefined
      ? options.sessionStorage
      : (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
    this._isMobile = typeof options.isMobile === 'function'
      ? options.isMobile
      : () => isMobileViewport();
    this._isPortrait = typeof options.isPortrait === 'function'
      ? options.isPortrait
      : () => isPhonePortrait();

    this.overlay = this._doc.createElement('div');
    this.overlay.id = 'landscape-gate';
    this.overlay.className = 'landscape-gate hidden';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'false');
    this.overlay.setAttribute('aria-labelledby', 'landscape-gate-title');
    this.overlay.innerHTML = `
      <div class="landscape-gate-card">
        <div class="landscape-gate-icon" aria-hidden="true">↻</div>
        <h2 id="landscape-gate-title">Mejor en horizontal</h2>
        <p class="landscape-gate-copy">Girá el teléfono para una mejor experiencia. Podés seguir en vertical si preferís.</p>
        <button type="button" class="btn-primary landscape-gate-dismiss">Entendido</button>
      </div>
    `;

    options.parent.appendChild(this.overlay);

    this._dismissBtn = this.overlay.querySelector('.landscape-gate-dismiss');
    this._onDismiss = () => this.dismiss();
    this._onBackdrop = (e) => {
      if (e.target === this.overlay) this.dismiss();
    };
    this._onResize = () => this.refresh();

    this._dismissBtn.addEventListener('click', this._onDismiss);
    this.overlay.addEventListener('click', this._onBackdrop);
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this._onResize);
      window.addEventListener('orientationchange', this._onResize);
    }

    this.refresh();
  }

  /** @returns {boolean} */
  get isVisible() {
    return !this.overlay.classList.contains('hidden');
  }

  refresh() {
    const show = shouldShowLandscapeGate({
      isMobile: this._isMobile(),
      isPortrait: this._isPortrait(),
      dismissed: wasLandscapeGateDismissed(this._session),
    });
    this.overlay.classList.toggle('hidden', !show);
  }

  dismiss() {
    dismissLandscapeGate(this._session);
    this.overlay.classList.add('hidden');
  }

  destroy() {
    this._dismissBtn.removeEventListener('click', this._onDismiss);
    this.overlay.removeEventListener('click', this._onBackdrop);
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('orientationchange', this._onResize);
    }
    if (this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
  }
}

export { MOBILE_MQ };
