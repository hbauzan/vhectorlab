/**
 * Spatial slider defaults for 3D Spatial Controls.
 *
 * Today every MODE / VIEW / RENDER shares GLOBAL_SPATIAL_DEFAULTS.
 * Fill SPATIAL_DEFAULT_OVERRIDES as you define per-context presets;
 * resolveSpatialDefaults merges GLOBAL → workspace → view → render
 * (more specific keys win).
 *
 * Override key forms:
 *   "ARITHMETIC"
 *   "ARITHMETIC|NAVIGATION"
 *   "ARITHMETIC|NAVIGATION|POINTS"
 *   "COMPARE|ANALYSIS|MESH"
 */

/** @typedef {{ threadSpacing: number, threadVectorDistance: number, threadAmplitudeY: number, threadWidth: number, threadThickness: number }} SpatialSliderValues */

/** @type {SpatialSliderValues} */
export const GLOBAL_SPATIAL_DEFAULTS = Object.freeze({
  threadSpacing: 0.4,
  threadVectorDistance: 10.0,
  threadAmplitudeY: 7.0,
  threadWidth: 0.2,
  threadThickness: 0.05,
});

/**
 * Partial overrides keyed by workspaceMode [|viewMode [|renderMode]].
 * @type {Record<string, Partial<SpatialSliderValues>>}
 */
export const SPATIAL_DEFAULT_OVERRIDES = {
  // Captured ARITHMETIC + ANALYSIS + POINTS (Spatial Controls + sweet-spot framing)
  'ARITHMETIC|ANALYSIS|POINTS': {
    threadSpacing: 0.4,
    threadVectorDistance: 10.0,
    threadAmplitudeY: 40.0,
    threadWidth: 0.2,
    threadThickness: 0.05,
  },
  // Captured COMPARE + NAVIGATION + POINTS (Spatial Controls + CAM POSE framing)
  'COMPARE|NAVIGATION|POINTS': {
    threadSpacing: 0.7,
    threadVectorDistance: 10.0,
    threadAmplitudeY: 4.9,
    threadWidth: 0.1,
    threadThickness: 0.01,
  },
  // Captured COMPARE + NAVIGATION + RIBBONS
  'COMPARE|NAVIGATION|RIBBONS': {
    threadSpacing: 1.55,
    threadVectorDistance: 10.0,
    threadAmplitudeY: 7.0,
    threadWidth: 0.057,
    threadThickness: 0.05,
  },
};

/**
 * @param {{ workspaceMode?: string, viewMode?: string, renderMode?: string }} [ctx]
 * @returns {SpatialSliderValues}
 */
export function resolveSpatialDefaults(ctx = {}) {
  const workspaceMode = ctx.workspaceMode || 'ARITHMETIC';
  const viewMode = ctx.viewMode || 'NAVIGATION';
  const renderMode = ctx.renderMode || 'POINTS';

  const layers = [
    workspaceMode,
    `${workspaceMode}|${viewMode}`,
    `${workspaceMode}|${viewMode}|${renderMode}`,
  ];

  /** @type {SpatialSliderValues} */
  let out = { ...GLOBAL_SPATIAL_DEFAULTS };
  for (const key of layers) {
    const partial = SPATIAL_DEFAULT_OVERRIDES[key];
    if (partial && typeof partial === 'object') {
      out = { ...out, ...partial };
    }
  }
  // Keep legacy alias in sync for LayoutEngine callers.
  out.threadSpacingY = out.threadVectorDistance;
  return out;
}

/** Slider DOM id → config field + label decimals (for dblclick reset). */
export const SPATIAL_SLIDER_BINDINGS = Object.freeze([
  {
    inputId: 'thread-spacing-slider',
    labelId: 'thread-spacing-val',
    configKey: 'threadSpacing',
    decimals: 2,
  },
  {
    inputId: 'thread-vector-dist-slider',
    labelId: 'thread-vector-dist-val',
    configKey: 'threadVectorDistance',
    decimals: 1,
    aliasKeys: ['threadSpacingY'],
  },
  {
    inputId: 'thread-amplitude-y-slider',
    labelId: 'thread-amplitude-y-val',
    configKey: 'threadAmplitudeY',
    decimals: 1,
  },
  {
    inputId: 'thread-width-slider',
    labelId: 'thread-width-val',
    configKey: 'threadWidth',
    decimals: 3,
  },
  {
    inputId: 'thread-thickness-slider',
    labelId: 'thread-thickness-val',
    configKey: 'threadThickness',
    decimals: 2,
  },
]);
