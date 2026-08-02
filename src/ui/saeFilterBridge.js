/**
 * SAE ↔ Visualization sign-filter bridge (D3/D4).
 * On SAE ON: force + Only. On SAE OFF: restore the pre-SAE filter.
 */

import { normalizeFilterMode } from './visualizationControlsDefaults.js';

/** @typedef {import('./visualizationControlsDefaults.js').VizFilterMode} VizFilterMode */
/** @typedef {{ previousMode: VizFilterMode }} SaeFilterSnapshot */

/** Filter applied automatically when SAE encode succeeds. */
export const SAE_ON_FILTER_MODE = /** @type {VizFilterMode} */ ('positive');

/**
 * Snapshot current filter before overriding for SAE.
 * @param {unknown} currentMode
 * @returns {SaeFilterSnapshot}
 */
export function snapshotFilterForSae(currentMode) {
  return { previousMode: normalizeFilterMode(currentMode) };
}

/**
 * @returns {VizFilterMode}
 */
export function filterModeForSaeOn() {
  return SAE_ON_FILTER_MODE;
}

/**
 * Restore filter after SAE OFF. Null snapshot → null (caller no-ops).
 * @param {SaeFilterSnapshot|null|undefined} snapshot
 * @returns {VizFilterMode|null}
 */
export function restoreFilterAfterSae(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  return normalizeFilterMode(snapshot.previousMode);
}
