/**
 * Dim paint: Shared-noise cancel (per-point median-distance, RAW) + Sign-conflict highlight (G1↔G2).
 * Shared noise is a 2D cancel[item][dim]; no same-sign batch veto. Paint only — Y untouched.
 */

import { countDistinctGroups, listDistinctGroupIds } from './groupStackLayout.js';
import { hexToRgb01, normalizeConflictCover, highCoverageToUnit } from '../ui/visualizationControlsDefaults.js';

const REL_DIST_EPS = 1e-12;
const COVERAGE_EPS = 1e-9;

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
 * Cached batch stats for Shared noise (coverage-independent).
 * relDist is row-major: index = itemIndex * dim + sourceDim.
 * @typedef {{
 *   itemCount: number,
 *   dim: number,
 *   median: Float64Array,
 *   maxDist: Float64Array,
 *   relDist: Float32Array,
 * }} SharedNoiseBatchMetrics
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
 * Used by Sign-conflict group means, not by the per-point cancel engine.
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
 * @param {number} metric01
 * @param {number} coverage01 - [0, 1]
 * @returns {number} cancel amount [0, 1]
 */
export function cancelAmountFromMetric(metric01, coverage01) {
  const m = Math.max(0, Math.min(1, Number(metric01) || 0));
  const c = Math.max(0, Math.min(1, Number(coverage01) || 0));
  if (c <= 1e-12) return 0;
  const floor = 1 - c;
  if (m <= floor) return 0;
  return (m - floor) / Math.max(c, 1e-12);
}

/**
 * Statistical median. Odd N → middle; even N → mean of two middles.
 * @param {ArrayLike<number>|null|undefined} values
 * @returns {number}
 */
export function medianValue(values) {
  const n = values?.length || 0;
  if (!n) return 0;
  const sorted = Float64Array.from(values);
  sorted.sort();
  const mid = n >> 1;
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Gradual per-point cancel from relative distance to batch median.
 * Closest to median cancel first; outliers resist until coverage → 1.
 * @param {number} relDist - [0, 1]
 * @param {number} coverage - UI knob [0, 1]
 * @returns {number} [0, 1]
 */
export function cancelFromRelDist(relDist, coverage) {
  const r = Math.max(0, Math.min(1, Number(relDist) || 0));
  const c = Math.max(0, Math.min(1, Number(coverage) || 0));
  if (c <= COVERAGE_EPS) return 0;
  if (c >= 1 - COVERAGE_EPS) return 1;
  if (r > c) return 0;
  const denom = Math.max(0.01, c * 0.5);
  return Math.max(0, Math.min(1, (c - r) / denom + 0.5));
}

/**
 * @param {Array<{ groupId?: string, embedding?: number[] }|null|undefined>|null|undefined} items
 * @returns {boolean}
 */
export function hasGroupsForDimContrast(items) {
  return countDistinctGroups(items) >= 2;
}

/**
 * Compare batch has ≥2 equal-width embeddings (groupId ignored).
 * @param {Array<{ embedding?: number[] }|null|undefined>|null|undefined} items
 * @returns {boolean}
 */
export function hasEnoughTokensForSharedNoise(items) {
  const list = (items || []).filter(
    (it) => Array.isArray(it?.embedding) && it.embedding.length
  );
  if (list.length < 2) return false;
  const dim = list[0].embedding.length;
  return list.every((it) => it.embedding.length === dim);
}

/**
 * @param {Array<{ embedding?: number[] }|null|undefined>|null|undefined} items
 * @returns {Array<{ embedding: number[] }>}
 */
function embeddingList(items) {
  return (items || []).filter(
    (it) => Array.isArray(it?.embedding) && it.embedding.length
  );
}

/**
 * Cheap fingerprint of RAW embeddings so median is not recomputed on viz ticks.
 * @param {Array<{ embedding?: number[] }|null|undefined>|null|undefined} items
 * @returns {string}
 */
export function sharedNoiseCacheKey(items) {
  const all = Array.isArray(items) ? items : [];
  const list = embeddingList(all);
  if (list.length < 2) return '';
  const dim = list[0].embedding.length;
  let h = (all.length * 1000003 + list.length * 10007 + dim) | 0;
  for (let i = 0; i < list.length; i++) {
    const e = list[i].embedding;
    if (e.length !== dim) return `bad:${i}`;
    for (let d = 0; d < dim; d++) {
      h = (Math.imul(h, 31) + ((e[d] * 1e6) | 0)) | 0;
    }
  }
  return `${all.length}:${list.length}:${dim}:${h}`;
}

/**
 * @returns {{ key: string, metrics: SharedNoiseBatchMetrics|null }}
 */
export function createSharedNoiseCache() {
  return { key: '', metrics: null };
}

/**
 * @param {{ key: string, metrics: SharedNoiseBatchMetrics|null }} cache
 * @param {Array<{ embedding?: number[] }|null|undefined>|null|undefined} items
 * @returns {SharedNoiseBatchMetrics|null}
 */
export function cachedSharedNoiseMetrics(cache, items) {
  const key = sharedNoiseCacheKey(items);
  if (cache.key === key) return cache.metrics;
  cache.key = key;
  cache.metrics = computeSharedNoiseBatchMetrics(items);
  return cache.metrics;
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
 * Batch median / maxDist / relDist per token per dim (RAW floats, groupId ignored).
 * `itemIndex` is the original Compare list index (holes without embeddings stay 0).
 * @param {Array<{ embedding?: number[] }|null|undefined>|null|undefined} items
 * @returns {SharedNoiseBatchMetrics|null}
 */
export function computeSharedNoiseBatchMetrics(items) {
  const all = Array.isArray(items) ? items : [];
  /** @type {number[]} */
  const valid = [];
  for (let i = 0; i < all.length; i++) {
    if (Array.isArray(all[i]?.embedding) && all[i].embedding.length) valid.push(i);
  }
  if (valid.length < 2) return null;
  const dim = all[valid[0]].embedding.length;
  if (!valid.every((i) => all[i].embedding.length === dim)) return null;

  const itemCount = all.length;
  const nValid = valid.length;
  const median = new Float64Array(dim);
  const maxDist = new Float64Array(dim);
  const relDist = new Float32Array(itemCount * dim);
  const col = new Float64Array(nValid);

  for (let d = 0; d < dim; d++) {
    for (let k = 0; k < nValid; k++) col[k] = all[valid[k]].embedding[d];
    const med = medianValue(col);
    median[d] = med;
    let maxD = 0;
    for (let k = 0; k < nValid; k++) {
      const i = valid[k];
      const dist = Math.abs(all[i].embedding[d] - med);
      relDist[i * dim + d] = dist;
      if (dist > maxD) maxD = dist;
    }
    maxDist[d] = maxD;
    if (maxD <= REL_DIST_EPS) {
      for (let k = 0; k < nValid; k++) relDist[valid[k] * dim + d] = 0;
    } else {
      const inv = 1 / maxD;
      for (let k = 0; k < nValid; k++) {
        const idx = valid[k] * dim + d;
        relDist[idx] = Math.max(0, Math.min(1, relDist[idx] * inv));
      }
    }
  }

  return { itemCount, dim, median, maxDist, relDist };
}

/**
 * @param {SharedNoiseBatchMetrics|null|undefined} metrics
 * @param {number} itemIndex
 * @param {number} sourceDim
 * @returns {number} [0, 1]
 */
export function getPointRelDist(metrics, itemIndex, sourceDim) {
  if (!metrics) return 0;
  if (!Number.isInteger(itemIndex) || !Number.isInteger(sourceDim)) return 0;
  if (itemIndex < 0 || itemIndex >= metrics.itemCount) return 0;
  if (sourceDim < 0 || sourceDim >= metrics.dim) return 0;
  return metrics.relDist[itemIndex * metrics.dim + sourceDim];
}

/**
 * Per-point Shared-noise cancel. SAE lockout → 0.
 * @param {SharedNoiseBatchMetrics|null|undefined} metrics
 * @param {number} itemIndex
 * @param {number} sourceDim
 * @param {number} coverage01
 * @param {{ isSaeActive?: boolean }} [options]
 * @returns {number} [0, 1]
 */
export function getPointCancel(metrics, itemIndex, sourceDim, coverage01, options = {}) {
  if (options.isSaeActive) return 0;
  return cancelFromRelDist(getPointRelDist(metrics, itemIndex, sourceDim), coverage01);
}

function isSaeActiveSettings(settings) {
  return settings?.isSaeActive === true;
}

/**
 * Shared-noise coverage unit, or 0 when toggle off / SAE on.
 * @param {object} [settings]
 * @returns {number} [0, 1]
 */
export function sharedNoiseCoverage01(settings) {
  if (!settings?.sameSignCancelEnabled) return 0;
  if (isSaeActiveSettings(settings)) return 0;
  return highCoverageToUnit(settings.sameSignCancelCoverage ?? 30);
}

/**
 * Paint weights for one point: shared cancel (scalar) + G1↔G2 highlight.
 *
 * @param {number|null|undefined} sharedCancel
 * @param {DimRelationMetric|null|undefined} groupMetric
 * @param {{
 *   sameSignCancelEnabled?: boolean,
 *   sameSignCancelCoverage?: number,
 *   isSaeActive?: boolean,
 *   oppositeHighlightEnabled?: boolean,
 *   oppositeHighlightStrength?: number,
 *   oppositeCancelCoverage?: number,
 * }} settings
 * @returns {{ cancel: number, highlight: number }}
 */
export function paintWeightsForDim(sharedCancel, groupMetric, settings = {}) {
  let cancel = 0;
  let highlight = 0;

  if (settings.sameSignCancelEnabled && !isSaeActiveSettings(settings)) {
    cancel = Math.max(0, Math.min(1, Number(sharedCancel) || 0));
  }

  if (groupMetric && !groupMetric.sameSign && settings.oppositeHighlightEnabled) {
    const strength = Math.max(0, Math.min(100, Number(settings.oppositeHighlightStrength) || 0)) / 100;
    const balance = groupMetric.conflictBalance != null
      ? groupMetric.conflictBalance
      : oppositeConflictBalance(groupMetric.meanA, groupMetric.meanB);
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
 * Apply Shared-noise cancel + Sign-conflict highlight on top of a divergent CPU color.
 *
 * @param {{ r: number, g: number, b: number, alpha?: number }} baseColor
 * @param {number|null|undefined} sharedCancel
 * @param {DimRelationMetric|null|undefined} groupMetric
 * @param {object} settings - VisualizationSettings-like
 * @param {{ r: number, g: number, b: number }|null} [zeroRgb]
 * @param {{ r: number, g: number, b: number }|null} [highlightRgb]
 * @returns {{ r: number, g: number, b: number, alpha?: number }}
 */
export function applyGroupDimPaint(
  baseColor,
  sharedCancel,
  groupMetric,
  settings,
  zeroRgb = null,
  highlightRgb = null
) {
  const weights = paintWeightsForDim(sharedCancel, groupMetric, settings);
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
 * Looks up cancel via meta.itemIndex + meta.dim (source dim).
 *
 * @param {Array<{ meta?: { dim?: number, itemIndex?: number } }>} pointsData
 * @param {SharedNoiseBatchMetrics|null|undefined} sharedNoiseMetrics
 * @param {DimRelationMetric[]|null|undefined} groupMetrics
 * @param {object} settings
 * @returns {{ cancel: Float32Array, highlight: Float32Array }}
 */
export function buildPointGroupPaintAttributes(pointsData, sharedNoiseMetrics, groupMetrics, settings) {
  const n = pointsData?.length || 0;
  const cancel = new Float32Array(n);
  const highlight = new Float32Array(n);
  if (!n) return { cancel, highlight };

  const fxOn = settings?.sameSignCancelEnabled || settings?.oppositeHighlightEnabled;
  if (!fxOn) return { cancel, highlight };
  if (!sharedNoiseMetrics && !groupMetrics?.length) return { cancel, highlight };

  const coverage = sharedNoiseCoverage01(settings);
  const sae = isSaeActiveSettings(settings);

  for (let i = 0; i < n; i++) {
    const dim = pointsData[i]?.meta?.dim;
    const itemIndex = pointsData[i]?.meta?.itemIndex;
    const sharedCancel = typeof dim === 'number'
      ? getPointCancel(sharedNoiseMetrics, itemIndex, dim, coverage, { isSaeActive: sae })
      : 0;
    const groupMetric = typeof dim === 'number' && groupMetrics?.length
      ? groupMetrics[dim]
      : null;
    const w = paintWeightsForDim(sharedCancel, groupMetric, settings);
    cancel[i] = w.cancel;
    highlight[i] = w.highlight;
  }
  return { cancel, highlight };
}
