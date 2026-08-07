/**
 * Collapsible side dock with a persistent edge tab.
 *
 * Deep module: collapse/transform/localStorage/`aria-expanded` behind a small API.
 * Does NOT unmount children (forms, sliders, cosine list stay mounted).
 *
 * Left-dock MODE policy (Arithmetic ↔ Compare):
 *   One shared collapsed flag for the left host. Switching MODE only toggles
 *   which child panel has `.hidden` inside `dock.body`; collapse state is unchanged
 *   and continues to read/write the same localStorage key.
 */

export const DOCK_TRANSITION_MS = 250;

/** Breakpoint: phone width, OR short landscape phone (hover:none) so touch chrome stays on. */
export const MOBILE_MQ = '(max-width: 768px), ((max-height: 500px) and (hover: none))';

/**
 * @param {((query: string) => { matches: boolean }) | undefined} matchMedia
 * @returns {boolean}
 */
export function isMobileViewport(matchMedia = globalThis.matchMedia) {
  if (typeof matchMedia !== 'function') return false;
  try {
    return Boolean(matchMedia(MOBILE_MQ).matches);
  } catch {
    return false;
  }
}

/**
 * Desktop: honor localStorage. Mobile: always default collapsed (D4); ignore storage.
 * @param {Storage | null | undefined} storage
 * @param {string} key
 * @param {{ isMobile?: boolean, defaultCollapsed?: boolean }} [opts]
 */
export function readCollapsedPreference(storage, key, opts = {}) {
  const isMobile = opts.isMobile ?? false;
  const defaultCollapsed = opts.defaultCollapsed ?? false;
  if (isMobile) return true;
  if (!storage || typeof storage.getItem !== 'function') return defaultCollapsed;
  const raw = storage.getItem(key);
  if (raw === null || raw === undefined) return defaultCollapsed;
  return raw === '1' || raw === 'true';
}

/**
 * Persist only on desktop. Mobile ignores writes (D4).
 * @param {Storage | null | undefined} storage
 * @param {string} key
 * @param {boolean} collapsed
 * @param {{ isMobile?: boolean }} [opts]
 */
export function writeCollapsedPreference(storage, key, collapsed, opts = {}) {
  const isMobile = opts.isMobile ?? false;
  if (isMobile || !storage || typeof storage.setItem !== 'function') return;
  storage.setItem(key, collapsed ? '1' : '0');
}

/**
 * @param {'left' | 'right'} side
 * @param {boolean} collapsed
 */
export function tabGlyphFor(side, collapsed) {
  if (side === 'left') return collapsed ? '▶' : '◀';
  return collapsed ? '◀' : '▶';
}

/**
 * @param {'left' | 'right'} side
 * @param {boolean} collapsed
 */
export function tabLabelFor(side, collapsed) {
  const which = side === 'left' ? 'left' : 'right';
  return collapsed ? `Expand ${which} panel` : `Collapse ${which} panel`;
}

export class CollapsibleDock {
  /**
   * @param {object} options
   * @param {HTMLElement} options.parent - Where to append the dock root
   * @param {'left' | 'right'} options.side
   * @param {string} options.id - Root element id
   * @param {string} options.storageKey - localStorage key
   * @param {Storage | null} [options.storage] - Injectable (tests); default localStorage
   * @param {boolean} [options.defaultCollapsed=false] - Desktop default when no stored value
   * @param {() => boolean} [options.isMobile] - Viewport probe (Stage B hook)
   * @param {Document} [options.doc]
   */
  constructor(options) {
    if (!options || !options.parent) {
      throw new Error('CollapsibleDock requires options.parent');
    }
    if (options.side !== 'left' && options.side !== 'right') {
      throw new Error('CollapsibleDock side must be "left" or "right"');
    }

    this.side = options.side;
    this.storageKey = options.storageKey;
    this.defaultCollapsed = options.defaultCollapsed === true;
    this._isMobileFn = typeof options.isMobile === 'function'
      ? options.isMobile
      : () => isMobileViewport();
    this._storage = options.storage !== undefined
      ? options.storage
      : (typeof localStorage !== 'undefined' ? localStorage : null);
    this._doc = options.doc || (typeof document !== 'undefined' ? document : null);
    if (!this._doc) {
      throw new Error('CollapsibleDock requires a Document');
    }

    this.root = this._doc.createElement('div');
    this.root.id = options.id;
    this.root.className = `collapsible-dock dock-${this.side}`;
    this.root.dataset.side = this.side;

    this.body = this._doc.createElement('div');
    this.body.className = 'dock-body';

    this.tab = this._doc.createElement('button');
    this.tab.type = 'button';
    this.tab.className = 'dock-tab';
    this.tab.dataset.dockTab = this.side;

    // DOM order: left = body then tab (tab on trailing edge); right = tab then body
    if (this.side === 'left') {
      this.root.appendChild(this.body);
      this.root.appendChild(this.tab);
    } else {
      this.root.appendChild(this.tab);
      this.root.appendChild(this.body);
    }

    options.parent.appendChild(this.root);

    this._onTabClick = () => this.toggle();
    this.tab.addEventListener('click', this._onTabClick);

    const initial = readCollapsedPreference(this._storage, this.storageKey, {
      isMobile: this._isMobileFn(),
      defaultCollapsed: this.defaultCollapsed,
    });
    this._collapsed = null;
    this.setCollapsed(initial, { persist: false });
  }

  /** @returns {boolean} */
  get isCollapsed() {
    return this._collapsed === true;
  }

  /**
   * @param {boolean} collapsed
   * @param {{ persist?: boolean }} [opts]
   */
  setCollapsed(collapsed, opts = {}) {
    const next = Boolean(collapsed);
    const persist = opts.persist !== false;
    this._collapsed = next;

    this.root.classList.toggle('is-collapsed', next);
    this.tab.setAttribute('aria-expanded', next ? 'false' : 'true');
    this.tab.setAttribute('aria-label', tabLabelFor(this.side, next));
    this.tab.textContent = tabGlyphFor(this.side, next);

    if (persist) {
      writeCollapsedPreference(this._storage, this.storageKey, next, {
        isMobile: this._isMobileFn(),
      });
    }
  }

  /** @returns {boolean} new collapsed state */
  toggle() {
    this.setCollapsed(!this.isCollapsed);
    return this.isCollapsed;
  }

  destroy() {
    this.tab.removeEventListener('click', this._onTabClick);
    if (this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }
}
