/**
 * Group-dim shared-noise cancel + opposite-sign highlight (paint only).
 * Means from raw embeddings; cancel/highlight applied in color space after divergent shading.
 * Active only when ≥2 groups (first two distinct groupIds = G1 vs G2).
 */

import { countDistinctGroups, listDistinctGroupIds } from './groupStackLayout.js';
import { hexToRgb01, normalizeConflictCover, highCoverageToUnit } from '../ui/visualizationControlsDefaults.js';

/**
 * @typedef {{
 *   meanA: number,
 *   meanB: number,
 *   sameSign: boolean,
 *   similarity: number,
 *   difference: number,
 *   conflictBalance: number,
 * }} DimRelationMetric
 */

/**
 * @param {number} v
 * @returns {number} Always ±1 (0 treated as +).
 */
export function signedUnit(v) {
  return v >= 0 ? 1 : -1;
}

/**
 * Shared-noise similarity: 1 − |a−b|/(|a|+|b|). Exact zeros → 1.
 * @param {number} a
 * @param {number} b
 * @returns {number} [0, 1]
 */
export function sharedNoiseSimilarity(a, b) {
  const aa = Math.abs(Number(a) || 0);
  const bb = Math.abs(Number(b) || 0);
  const den = aa + bb;
  if (den <= 1e-12) return 1;
  return Math.max(0, Math.min(1, 1 - Math.abs(a - b) / den));
}

/**
 * Relative magnitude difference |a−b|/(|a|+|b|). Exact zeros → 0.
 * Note: for opposite signs this is always ~1 — do not use for gradual cover.
 * @param {number} a
 * @param {number} b
 * @returns {number} [0, 1]
 */
export function relativeDifference(a, b) {
  const aa = Math.abs(Number(a) || 0);
  const bb = Math.abs(Number(b) || 0);
  const den = aa + bb;
  if (den <= 1e-12) return 0;
  return Math.max(0, Math.min(1, Math.abs(a - b) / den));
}

/**
 * How balanced an opposite-sign pair is: 2·min(|a|,|b|)/(|a|+|b|).
 * 1 = equal magnitude opposition; 0 = one side near zero.
 * @param {number} a
 * @param {number} b
 * @returns {number} [0, 1]
 */
export function oppositeConflictBalance(a, b) {
  const aa = Math.abs(Number(a) || 0);
  const bb = Math.abs(Number(b) || 0);
  const den = aa + bb;
  if (den <= 1e-12) return 0;
  return Math.max(0, Math.min(1, (2 * Math.min(aa, bb)) / den));
}

/**
 * Linear cover toward black for opposite-sign dims (0–90% → 0–1).
 * Avoids cancelAmountFromMetric(|Δ|) which is always 1 when signs differ.
 * @param {number} coveragePercent - 0–90
 * @returns {number} [0, 1]
 */
export function oppositeCoverCancel(coveragePercent) {
  const c = normalizeConflictCover(coveragePercent) / 100;
  if (c <= 1e-9) return 0;
  return Math.max(0, Math.min(1, c / 0.9));
}

/**
 * High-metric → black, Zero-coverage style.
 * coverage=0 → never; coverage=0.5 → metric≤0.5 untouched, metric→1 fully cancelled.
 *
 * @param {number} metric01
 * @param {number} coverage01 - [0, 0.9]
 * @returns {number} cancel amount [0, 1]
 */
export function cancelAmountFromMetric(metric01, coverage01) {
  const m = Math.max(0, Math.min(1, Number(metric01) || 0));
  const c = Math.max(0, Math.min(0.999999, Number(coverage01) || 0));
  if (c <= 1e-12) return 0;
  const floor = 1 - c;
  if (m <= floor) return 0;
  return (m - floor) / Math.max(c, 1e-12);
}

/**
 * @param {Array<{ groupId?: string, embedding?: number[] }|null|undefined>|null|undefined} items
 * @returns {boolean}
 */
export function hasGroupsForDimContrast(items) {
  return countDistinctGroups(items) >= 2;
}

/**
 * Per-dim G1 vs G2 means (first two distinct groupIds in encounter order).
 * @param {Array<{ groupId?: string, embedding?: number[] }|null|undefined>|null|undefined} items
 * @returns {DimRelationMetric[]}
 */
export function computeDimRelationMetrics(items) {
  const list = (items || []).filter(
    (it) => it?.groupId && Array.isArray(it.embedding) && it.embedding.length
  );
  const groupIds = listDistinctGroupIds(list);
  if (groupIds.length < 2) return [];

  const idA = groupIds[0];
  const idB = groupIds[1];
  const dim = list[0].embedding.length;
  if (!list.every((it) => it.embedding.length === dim)) return [];

  const sumA = new Float64Array(dim);
  const sumB = new Float64Array(dim);
  let countA = 0;
  let countB = 0;

  for (const it of list) {
    if (it.groupId === idA) {
      for (let d = 0; d < dim; d++) sumA[d] += it.embedding[d];
      countA += 1;
    } else if (it.groupId === idB) {
      for (let d = 0; d < dim; d++) sumB[d] += it.embedding[d];
      countB += 1;
    }
  }
  if (countA < 1 || countB < 1) return [];

  /** @type {DimRelationMetric[]} */
  const out = new Array(dim);
  for (let d = 0; d < dim; d++) {
    const meanA = sumA[d] / countA;
    const meanB = sumB[d] / countB;
    const sameSign = signedUnit(meanA) === signedUnit(meanB);
    out[d] = {
      meanA,
      meanB,
      sameSign,
      similarity: sharedNoiseSimilarity(meanA, meanB),
      difference: relativeDifference(meanA, meanB),
      conflictBalance: oppositeConflictBalance(meanA, meanB),
    };
  }
  return out;
}

/**
 * Paint weights for one dim given resolved viz settings.
 * @param {DimRelationMetric|null|undefined} metric
 * @param {{
 *   sameSignCancelEnabled?: boolean,
 *   sameSignCancelCoverage?: number,
 *   oppositeHighlightEnabled?: boolean,
 *   oppositeHighlightStrength?: number,
 *   oppositeCancelCoverage?: number,
 * }} settings
 * @returns {{ cancel: number, highlight: number }}
 */
export function paintWeightsForDim(metric, settings = {}) {
  if (!metric) return { cancel: 0, highlight: 0 };

  let cancel = 0;
  let highlight = 0;

  if (metric.sameSign && settings.sameSignCancelEnabled) {
    const c = highCoverageToUnit(settings.sameSignCancelCoverage ?? 30);
    cancel = Math.max(cancel, cancelAmountFromMetric(metric.similarity, c));
  }

  if (!metric.sameSign && settings.oppositeHighlightEnabled) {
    const strength = Math.max(0, Math.min(100, Number(settings.oppositeHighlightStrength) || 0)) / 100;
    const balance = metric.conflictBalance != null
      ? metric.conflictBalance
      : oppositeConflictBalance(metric.meanA, metric.meanB);
    highlight = Math.max(0, Math.min(1, strength * balance));
    cancel = Math.max(cancel, oppositeCoverCancel(settings.oppositeCancelCoverage ?? 0));
  }

  return { cancel, highlight };
}

/**
 * @param {{ r: number, g: number, b: number, alpha?: number }} color
 * @param {{ r: number, g: number, b: number }} target
 * @param {number} k
 */
function lerpRgb(color, target, k) {
  const t = Math.max(0, Math.min(1, k));
  return {
    r: color.r + (target.r - color.r) * t,
    g: color.g + (target.g - color.g) * t,
    b: color.b + (target.b - color.b) * t,
    alpha: color.alpha,
  };
}

/**
 * Apply group-dim paint on top of a divergent CPU color (Y/geometry untouched).
 *
 * @param {{ r: number, g: number, b: number, alpha?: number }} baseColor
 * @param {DimRelationMetric|null|undefined} metric
 * @param {object} settings - VisualizationSettings-like
 * @param {{ r: number, g: number, b: number }|null} [zeroRgb]
 * @param {{ r: number, g: number, b: number }|null} [highlightRgb]
 * @returns {{ r: number, g: number, b: number, alpha?: number }}
 */
export function applyGroupDimPaint(baseColor, metric, settings, zeroRgb = null, highlightRgb = null) {
  const weights = paintWeightsForDim(metric, settings);
  if (weights.cancel <= 1e-9 && weights.highlight <= 1e-9) {
    return { ...baseColor };
  }

  const zero = zeroRgb || { r: 0, g: 0, b: 0 };
  let out = { ...baseColor };

  if (weights.highlight > 1e-9) {
    const hi = highlightRgb
      || hexToRgb01(settings?.oppositeHighlightColor)
      || { r: 0, g: 229 / 255, b: 1 };
    out = lerpRgb(out, hi, weights.highlight);
  }
  if (weights.cancel > 1e-9) {
    out = lerpRgb(out, zero, weights.cancel);
    if (typeof out.alpha === 'number') {
      out.alpha = Math.max(0.05, out.alpha * (1 - 0.85 * weights.cancel));
    }
  }
  return out;
}

/**
 * Build parallel cancel/highlight attribute arrays for POINTS (length = points).
 *
 * @param {Array<{ meta?: { dim?: number } }>} pointsData
 * @param {DimRelationMetric[]|null|undefined} metrics
 * @param {object} settings
 * @returns {{ cancel: Float32Array, highlight: Float32Array }}
 */
export function buildPointGroupPaintAttributes(pointsData, metrics, settings) {
  const n = pointsData?.length || 0;
  const cancel = new Float32Array(n);
  const highlight = new Float32Array(n);
  if (!n || !metrics?.length) return { cancel, highlight };

  const groupFxOn = settings?.sameSignCancelEnabled || settings?.oppositeHighlightEnabled;
  if (!groupFxOn) return { cancel, highlight };

  for (let i = 0; i < n; i++) {
    const dim = pointsData[i]?.meta?.dim;
    const metric = typeof dim === 'number' ? metrics[dim] : null;
    const w = paintWeightsForDim(metric, settings);
    cancel[i] = w.cancel;
    highlight[i] = w.highlight;
  }
  return { cancel, highlight };
}
