/**
 * Camera pose defaults per MODE / VIEW / RENDER.
 *
 * resolveCameraPose merges VIEW fallback → workspace → view → render
 * (more specific keys win). Fill CAMERA_DEFAULT_OVERRIDES as you capture
 * per-context framing from the CAM POSE overlay.
 *
 * Override key forms (same as spatialSliderDefaults):
 *   "ARITHMETIC"
 *   "ARITHMETIC|NAVIGATION"
 *   "COMPARE|NAVIGATION|POINTS"
 *   "COMPARE|GALAXY|POINTS"
 */

import {
  DEFAULT_RENDER_MODE,
  DEFAULT_VIEW_MODE,
  DEFAULT_WORKSPACE_MODE,
} from '../ui/appViewDefaults.js';
import { GALAXY_VIEW } from '../ui/galaxyChrome.js';

/** @typedef {{ position: [number, number, number], rotationDeg: [number, number, number] }} CameraPose */

/**
 * View-level fallbacks (legacy setNavigationView / setAnalysisView poses).
 * @type {Readonly<Record<'NAVIGATION' | 'ANALYSIS' | 'GALAXY', CameraPose>>}
 */
export const VIEW_CAMERA_FALLBACKS = Object.freeze({
  NAVIGATION: Object.freeze({
    // Captured default corridor (king-man+woman @ Spacing 0.4 / Amplitude 7)
    position: Object.freeze([-178.3, 13.5, 52.2]),
    rotationDeg: Object.freeze([-5.4, -51.5, 0]),
  }),
  ANALYSIS: Object.freeze({
    // Captured ARITHMETIC + ANALYSIS + POINTS framing
    position: Object.freeze([-75.2, -0.8, 62.5]),
    rotationDeg: Object.freeze([0, 0, 0]),
  }),
  GALAXY: Object.freeze({
    // Captured COMPARE + GALAXY default (CAM POSE overlay)
    position: Object.freeze([25.5, 155.2, 328.9]),
    rotationDeg: Object.freeze([-23.2, 14.0, 0]),
  }),
});

/**
 * Partial overrides keyed by workspaceMode [|viewMode [|renderMode]].
 * @type {Record<string, Partial<CameraPose>>}
 */
export const CAMERA_DEFAULT_OVERRIDES = {
  // Captured COMPARE + NAVIGATION + POINTS (CAM POSE overlay)
  'COMPARE|NAVIGATION|POINTS': {
    position: [-106.5, 20.4, 390.2],
    rotationDeg: [-3.9, -8.4, 0],
  },
  // Captured COMPARE + ANALYSIS + POINTS (CAM POSE overlay)
  'COMPARE|ANALYSIS|POINTS': {
    position: [-150.3, 0.7, 276.6],
    rotationDeg: [-0.5, 0.9, 0],
  },
  // Captured COMPARE + NAVIGATION + RIBBONS (CAM POSE overlay)
  'COMPARE|NAVIGATION|RIBBONS': {
    position: [-575.8, 43.8, 237.9],
    rotationDeg: [-22.4, -35.7, 0],
  },
  // Captured COMPARE + GALAXY + POINTS (CAM POSE overlay)
  'COMPARE|GALAXY|POINTS': {
    position: [25.5, 155.2, 328.9],
    rotationDeg: [-23.2, 14.0, 0],
  },
};

/**
 * Normalize view id for camera lookup (Galaxy stays Galaxy; unknown → NAVIGATION).
 * @param {string|undefined} rawView
 * @returns {'ANALYSIS'|'NAVIGATION'|'GALAXY'}
 */
export function normalizeCameraViewMode(rawView) {
  if (rawView === 'ANALYSIS') return 'ANALYSIS';
  if (rawView === GALAXY_VIEW || rawView === 'GALAXY') return 'GALAXY';
  return 'NAVIGATION';
}

/**
 * @param {{ workspaceMode?: string, viewMode?: string, renderMode?: string }} [ctx]
 * @returns {CameraPose}
 */
export function resolveCameraPose(ctx = {}) {
  const workspaceMode = ctx.workspaceMode || DEFAULT_WORKSPACE_MODE;
  const viewMode = normalizeCameraViewMode(ctx.viewMode || DEFAULT_VIEW_MODE);
  const renderMode = ctx.renderMode || DEFAULT_RENDER_MODE;

  const fallback = VIEW_CAMERA_FALLBACKS[viewMode] || VIEW_CAMERA_FALLBACKS.NAVIGATION;
  /** @type {CameraPose} */
  let out = {
    position: [...fallback.position],
    rotationDeg: [...fallback.rotationDeg],
  };

  const layers = [
    workspaceMode,
    `${workspaceMode}|${viewMode}`,
    `${workspaceMode}|${viewMode}|${renderMode}`,
  ];

  for (const key of layers) {
    const partial = CAMERA_DEFAULT_OVERRIDES[key];
    if (partial && typeof partial === 'object') {
      if (Array.isArray(partial.position) && partial.position.length >= 3) {
        out.position = [
          Number(partial.position[0]),
          Number(partial.position[1]),
          Number(partial.position[2]),
        ];
      }
      if (Array.isArray(partial.rotationDeg) && partial.rotationDeg.length >= 3) {
        out.rotationDeg = [
          Number(partial.rotationDeg[0]),
          Number(partial.rotationDeg[1]),
          Number(partial.rotationDeg[2]),
        ];
      }
    }
  }

  return out;
}
