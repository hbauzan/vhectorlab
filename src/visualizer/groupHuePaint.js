/**
 * Group hue paint: black (−1) → per-group picked color (+1).
 * Replaces divergent base when enabled; Shared noise / Sign conflict stay on top.
 */

import {
  hexToRgb01,
  normalizeHex,
  remapAbsTWithZeroCoverage,
  zeroCoverageToUnit,
  DEFAULT_GROUP_HUE_PALETTE,
  defaultGroupHueHexAt,
  normalizeGroupHueColors,
  ensureGroupHueColors,
} from '../ui/visualizationControlsDefaults.js';
import { listDistinctGroupIds } from './groupStackLayout.js';
import { getDivergentColor } from './DivergentShading.js';
import { applyGroupDimPaint } from './groupDimContrast.js';

export {
  DEFAULT_GROUP_HUE_PALETTE,
  defaultGroupHueHexAt,
  normalizeGroupHueColors,
  ensureGroupHueColors,
};

const BLACK = Object.freeze({ r: 0, g: 0, b: 0 });

/**
 * Black → groupColor ramp with optional zero-coverage remap on |t|.
 * t in [-1, 1]; midpoint 0 = mid black↔color.
 *
 * @param {number} tNorm
 * @param {string} groupHex
 * @param {number} [zeroCoveragePercent=0]
 * @returns {{ r: number, g: number, b: number, alpha: number }}
 */
export function getGroupHueColor(tNorm, groupHex, zeroCoveragePercent = 0) {
  const target = hexToRgb01(groupHex) || { r: 0, g: 1, b: 1 };
  const t = Math.max(-1, Math.min(1, Number(tNorm) || 0));
  const absT = Math.abs(t);
  const coverage01 = zeroCoverageToUnit(zeroCoveragePercent);
  const k = remapAbsTWithZeroCoverage(absT, coverage01);
  const signedK = t >= 0 ? k : -k;
  const u = (signedK + 1) * 0.5; // −1→0, 0→0.5, +1→1
  const r = BLACK.r + (target.r - BLACK.r) * u;
  const g = BLACK.g + (target.g - BLACK.g) * u;
  const b = BLACK.b + (target.b - BLACK.b) * u;
  const alpha = absT < 0.01
    ? 0.05
    : Math.min(Math.max(Math.pow(Math.max(k, absT * 0.15), 1.2), 0.05), 1.0);
  return { r, g, b, alpha };
}

/**
 * Base paint: group hue or divergent; then Shared noise / Sign conflict.
 *
 * @param {number} normVal
 * @param {number|undefined} sourceDim
 * @param {{
 *   viz: object,
 *   anchors: object,
 *   zeroCoverage: number,
 *   groupDimMetrics?: Array|null,
 *   groupId?: string|null,
 * }} resolved
 */
export function colorForActivationWithGroupHue(normVal, sourceDim, resolved) {
  const viz = resolved.viz;
  const groupId = resolved.groupId;
  const hueOn = Boolean(viz?.groupHueEnabled);
  const hex = hueOn && groupId && viz.groupHueColors
    ? normalizeHex(viz.groupHueColors[groupId])
    : null;

  const base = hex
    ? getGroupHueColor(normVal, hex, resolved.zeroCoverage)
    : getDivergentColor(normVal, 1.0, resolved.anchors, resolved.zeroCoverage);

  const metrics = resolved.groupDimMetrics;
  if (!metrics?.length || sourceDim == null) return base;
  const metric = metrics[sourceDim];
  const zero = resolved.anchors?.zero || BLACK;
  const hi = hexToRgb01(viz?.oppositeHighlightColor);
  return applyGroupDimPaint(base, metric, viz, zero, hi);
}

/**
 * Group ids from compare items for UI rows.
 * @param {Array<{ groupId?: string }>|null|undefined} items
 * @returns {string[]}
 */
export function groupIdsForHueUi(items) {
  return listDistinctGroupIds(items || []);
}
