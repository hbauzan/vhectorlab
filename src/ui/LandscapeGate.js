/**
 * Landscape gate (retired): portrait overlay was removed — phone portrait is the
 * preferred mobile layout. Helpers remain for tests / TouchControls selectors.
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
 * Always false — landscape nudge overlay retired (portrait is preferred on phone).
 * @param {{ isPortrait?: boolean, dismissed?: boolean, isMobile?: boolean }} [_state]
 */
export function shouldShowLandscapeGate(_state) {
  return false;
}

/**
 * No-op mount kept so callers/tests stay stable; never shows overlay.
 */
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
    this.overlay = this._doc.createElement('div');
    this.overlay.id = 'landscape-gate';
    this.overlay.className = 'landscape-gate hidden';
    this.overlay.setAttribute('hidden', '');
    this.overlay.setAttribute('aria-hidden', 'true');
    // Intentionally empty — no cartel/copy.
    this.overlay.innerHTML = '';
    options.parent.appendChild(this.overlay);
    this._dismissBtn = null;
  }

  /** @returns {boolean} */
  get isVisible() {
    return false;
  }

  refresh() {
    this.overlay.classList.add('hidden');
    this.overlay.setAttribute('hidden', '');
  }

  dismiss() {
    this.refresh();
  }

  destroy() {
    if (this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
  }
}

export { MOBILE_MQ, isMobileViewport };
