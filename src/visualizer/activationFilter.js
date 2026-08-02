/**
 * Sign filter over **normalized** activations (post z-score/tanh), not raw embedding dims.
 * ε aligns with DivergentShading near-zero short-circuit (|t| < 0.01).
 */

/** @typedef {'all' | 'positive' | 'negative'} VizFilterMode */

export const NEAR_ZERO_EPS = 0.01;

/**
 * Whether a normalized activation t should be drawn for the given filter mode.
 * + only: hide negatives and near-zero. − only: hide positives and near-zero.
 *
 * @param {number} t - Normalized activation in roughly [-1, 1]
 * @param {VizFilterMode} mode
 * @param {number} [eps=NEAR_ZERO_EPS]
 * @returns {boolean}
 */
export function shouldShowActivation(t, mode = 'all', eps = NEAR_ZERO_EPS) {
  if (mode === 'all') return true;
  const absT = Math.abs(t);
  if (absT < eps) return false;
  if (mode === 'positive') return t > 0;
  if (mode === 'negative') return t < 0;
  return true;
}

/**
 * Boolean mask parallel to `normalized`.
 * @param {ArrayLike<number>} normalized
 * @param {VizFilterMode} mode
 * @param {number} [eps]
 * @returns {boolean[]}
 */
export function activationVisibilityMask(normalized, mode = 'all', eps = NEAR_ZERO_EPS) {
  const n = normalized.length;
  const mask = new Array(n);
  for (let i = 0; i < n; i++) {
    mask[i] = shouldShowActivation(normalized[i], mode, eps);
  }
  return mask;
}

/**
 * Flat index pairs for THREE.LineSegments: only consecutive endpoints that both pass.
 * Keeps full vertex buffer intact for in-situ position updates.
 *
 * @param {ArrayLike<number>} normalized
 * @param {VizFilterMode} mode
 * @param {number} [eps]
 * @returns {number[]}
 */
export function lineSegmentIndices(normalized, mode = 'all', eps = NEAR_ZERO_EPS) {
  const n = normalized.length;
  if (n < 2) return [];
  const indices = [];
  for (let i = 0; i < n - 1; i++) {
    if (
      shouldShowActivation(normalized[i], mode, eps)
      && shouldShowActivation(normalized[i + 1], mode, eps)
    ) {
      indices.push(i, i + 1);
    }
  }
  return indices;
}

/**
 * Quad strip triangle indices (same winding as MeshFactory wide ribbon) for
 * consecutive centerline samples that both pass the filter.
 *
 * @param {ArrayLike<number>} normalized - one value per centerline sample
 * @param {VizFilterMode} mode
 * @param {number} [eps]
 * @returns {number[]}
 */
export function wideRibbonQuadIndices(normalized, mode = 'all', eps = NEAR_ZERO_EPS) {
  const n = normalized.length;
  if (n < 2) return [];
  const indices = [];
  for (let i = 0; i < n - 1; i++) {
    if (
      !shouldShowActivation(normalized[i], mode, eps)
      || !shouldShowActivation(normalized[i + 1], mode, eps)
    ) {
      continue;
    }
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b);
    indices.push(b, c, d);
  }
  return indices;
}

/**
 * Filter pointsData entries by normalized activations of the whole set.
 * Caller must pass already-normalized values aligned 1:1 with pointsData.
 *
 * @template T
 * @param {T[]} pointsData
 * @param {ArrayLike<number>} normalized
 * @param {VizFilterMode} mode
 * @param {number} [eps]
 * @returns {T[]}
 */
export function filterPointsData(pointsData, normalized, mode = 'all', eps = NEAR_ZERO_EPS) {
  if (!pointsData?.length) return [];
  if (mode === 'all') return pointsData.slice();
  const out = [];
  for (let i = 0; i < pointsData.length; i++) {
    if (shouldShowActivation(normalized[i], mode, eps)) out.push(pointsData[i]);
  }
  return out;
}
