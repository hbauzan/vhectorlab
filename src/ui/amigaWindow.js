/**
 * Canonical Workbench window chrome.
 * Raised chassis + cobalt titlebar + two gadgets.
 * The left gadget toggles the same collapse as the host dock or sheet.
 * The right gadget is the depth mark and does not change state.
 */

export const AMIGA_WINDOW_TITLES = Object.freeze({
  arithmetic: 'ARITHMETIC',
  compare: 'TOKEN COMPARISON',
  spatial: 'SPATIAL CONTROLS',
  visualization: 'VISUALIZATION',
});

/**
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtmlText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * @param {string} title
 * @returns {string}
 */
export function amigaWindowTitlebarMarkup(title) {
  const label = escapeHtmlText(title);
  return (
    '<div class="amiga-window-titlebar">'
    + '<button type="button" class="amiga-window-gadget" data-gadget="close" aria-label="Collapse window">'
    + '<span class="gadget-inner-square" aria-hidden="true"></span>'
    + '</button>'
    + `<span class="amiga-window-title">${label}</span>`
    + '<button type="button" class="amiga-window-gadget" data-gadget="depth" aria-label="Window depth">'
    + '<span class="gadget-inner-square" aria-hidden="true"></span>'
    + '</button>'
    + '</div>'
  );
}

/**
 * @param {HTMLElement | null | undefined} root
 * @param {() => void} onClose
 */
export function wireAmigaWindowClose(root, onClose) {
  if (!root || typeof root.querySelector !== 'function') return;
  if (typeof onClose !== 'function') return;
  const gadget = root.querySelector('[data-gadget="close"]');
  if (!gadget || typeof gadget.addEventListener !== 'function') return;
  gadget.addEventListener('click', (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    onClose();
  });
}

/**
 * Toggle the collapsible dock that contains this panel.
 * No-op when the panel is not mounted in a dock.
 * @param {HTMLElement | null | undefined} panelEl
 * @returns {boolean}
 */
export function collapseNearestDock(panelEl) {
  if (!panelEl || typeof panelEl.closest !== 'function') return false;
  const dock = panelEl.closest('.collapsible-dock');
  if (!dock || typeof dock.querySelector !== 'function') return false;
  const tab = dock.querySelector('.dock-tab');
  if (!tab || typeof tab.click !== 'function') return false;
  tab.click();
  return true;
}
