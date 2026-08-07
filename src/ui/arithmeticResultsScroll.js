/**
 * Arithmetic Top-10 list scroll contract (CSS `#sidebar-panel .results-list`).
 *
 * Tall viewports: panel clipped, list scrolls.
 * Short viewports (≤560px height): panel scrolls so form + Top-10 stay reachable.
 */

/** Floor so `calc(100vh - N)` can never collapse the scroller to 0. */
export const RESULTS_LIST_MIN_PX = 120;

/** Soft caps for list height (desktop / phone). */
export const RESULTS_LIST_CAP_DESKTOP_PX = 280;
export const RESULTS_LIST_CAP_MOBILE_PX = 200;

/**
 * CSS expressions kept in sync with `src/style.css`.
 * Always wrap with max(floor, …) so short landscape never gets 0px.
 */
export const ARITHMETIC_TOP10_SCROLL = Object.freeze({
  panelSelector: '#sidebar-panel',
  listSelector: '#sidebar-panel .results-list',
  desktopMaxHeight: `max(${RESULTS_LIST_MIN_PX}px, min(${RESULTS_LIST_CAP_DESKTOP_PX}px, 40dvh))`,
  mobileMaxHeight: `max(${RESULTS_LIST_MIN_PX}px, min(${RESULTS_LIST_CAP_MOBILE_PX}px, 36dvh))`,
  shortPanelScrollMq: '(max-height: 560px)',
  overflowY: 'auto',
});

/**
 * Resolve a concrete max-height (px) for the Top-10 scroller.
 * Used by tests as the feedback loop for short phone landscape / desktop.
 *
 * @param {{ width: number, height: number }} viewport
 * @param {{ isMobile?: boolean }} [opts]
 * @returns {number}
 */
export function resolveResultsListMaxHeightPx(viewport, opts = {}) {
  const height = Math.max(0, Number(viewport?.height) || 0);
  const width = Math.max(0, Number(viewport?.width) || 0);
  const isMobile = opts.isMobile ?? (width <= 768);
  const cap = isMobile ? RESULTS_LIST_CAP_MOBILE_PX : RESULTS_LIST_CAP_DESKTOP_PX;
  const fraction = isMobile ? 0.36 : 0.4;
  const fromFraction = Math.round(height * fraction);
  return Math.max(RESULTS_LIST_MIN_PX, Math.min(cap, fromFraction || RESULTS_LIST_MIN_PX));
}

/**
 * Short viewports should scroll the whole Arithmetic panel (form + Top-10),
 * not only the list — otherwise parents with overflow:hidden clip the list away.
 *
 * @param {{ height: number }} viewport
 * @returns {boolean}
 */
export function shouldScrollArithmeticPanel(viewport) {
  return (Number(viewport?.height) || 0) <= 560;
}
