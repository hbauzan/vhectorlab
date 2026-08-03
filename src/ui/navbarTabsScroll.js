/**
 * Pure scroll helpers for the mobile navbar tab strip (overflow arrows).
 */

/**
 * @param {number} scrollLeft
 * @param {number} clientWidth
 * @param {number} scrollWidth
 * @param {number} [epsilon=1]
 * @returns {{ canPrev: boolean, canNext: boolean, overflow: boolean }}
 */
export function getTabsScrollState(scrollLeft, clientWidth, scrollWidth, epsilon = 1) {
  const max = Math.max(0, scrollWidth - clientWidth);
  return {
    canPrev: scrollLeft > epsilon,
    canNext: scrollLeft < max - epsilon,
    overflow: max > epsilon,
  };
}

/**
 * @param {number} scrollLeft
 * @param {number} clientWidth
 * @param {number} scrollWidth
 * @param {-1 | 1} direction
 * @param {number} [fraction=0.7]
 * @returns {number}
 */
export function nextTabsScrollLeft(scrollLeft, clientWidth, scrollWidth, direction, fraction = 0.7) {
  const step = Math.max(48, Math.round(clientWidth * fraction));
  const max = Math.max(0, scrollWidth - clientWidth);
  return Math.min(max, Math.max(0, scrollLeft + direction * step));
}
