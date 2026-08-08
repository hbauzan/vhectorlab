/**
 * Visualization Controls defaults, hex validation, and localStorage persistence.
 * Global (not per MODE|VIEW|RENDER). Filter applies to normalized activations (post z-score/tanh).
 */

/** @typedef {'all' | 'positive' | 'negative'} VizFilterMode */

/** @typedef {{
 *   vizFilterMode: VizFilterMode,
 *   colorPositive: string,
 *   colorZero: string,
 *   colorNegative: string,
 *   zeroCoverageEnabled: boolean,
 *   zeroCoverage: number,
 *   labelsVisible: boolean,
 *   sameSignCancelEnabled: boolean,
 *   sameSignCancelCoverage: number,
 *   oppositeHighlightEnabled: boolean,
 *   oppositeHighlightColor: string,
 *   oppositeHighlightStrength: number,
 *   oppositeCancelCoverage: number,
 * }} VisualizationSettings */

export const VIZ_STORAGE_PREFIX = 'vl3d.viz.';

export const VIZ_STORAGE_KEYS = Object.freeze({
  filter: `${VIZ_STORAGE_PREFIX}filter`,
  colorPositive: `${VIZ_STORAGE_PREFIX}colorPositive`,
  colorZero: `${VIZ_STORAGE_PREFIX}colorZero`,
  colorNegative: `${VIZ_STORAGE_PREFIX}colorNegative`,
  zeroCoverageEnabled: `${VIZ_STORAGE_PREFIX}zeroCoverageEnabled`,
  zeroCoverage: `${VIZ_STORAGE_PREFIX}zeroCoverage`,
  labelsVisible: `${VIZ_STORAGE_PREFIX}labelsVisible`,
  sameSignCancelEnabled: `${VIZ_STORAGE_PREFIX}sameSignCancelEnabled`,
  sameSignCancelCoverage: `${VIZ_STORAGE_PREFIX}sameSignCancelCoverage`,
  oppositeHighlightEnabled: `${VIZ_STORAGE_PREFIX}oppositeHighlightEnabled`,
  oppositeHighlightColor: `${VIZ_STORAGE_PREFIX}oppositeHighlightColor`,
  oppositeHighlightStrength: `${VIZ_STORAGE_PREFIX}oppositeHighlightStrength`,
  oppositeCancelCoverage: `${VIZ_STORAGE_PREFIX}oppositeCancelCoverage`,
});

/** Default anchors match former ramp endpoints (§0.2). */
export const DEFAULT_VIZ_COLORS = Object.freeze({
  colorPositive: '#FFE600',
  colorZero: '#000000',
  colorNegative: '#9900E6',
});

/** Default highlight for opposite-sign dims (cyan). */
export const DEFAULT_OPPOSITE_HIGHLIGHT_COLOR = '#00E5FF';

export const DEFAULT_VIZ_FILTER = /** @type {VizFilterMode} */ ('all');

/** Thread / group floating labels visible by default. */
export const DEFAULT_LABELS_VISIBLE = true;

/**
 * Zero coverage + Shared noise similarity: 30% … 99.9999%.
 * Slider uses 0…10000 positions for usable fine control near the top.
 */
export const HIGH_COVERAGE_MIN = 30;
export const HIGH_COVERAGE_MAX = 99.9999;
export const HIGH_COVERAGE_SLIDER_MAX = 10000;
export const DEFAULT_HIGH_COVERAGE = HIGH_COVERAGE_MIN;
export const COVERAGE_UNIT_MAX = HIGH_COVERAGE_MAX / 100;

/** Conflict cover only: 0–90% linear. */
export const CONFLICT_COVER_MIN = 0;
export const CONFLICT_COVER_MAX = 90;
export const DEFAULT_CONFLICT_COVER = 0;

/** @deprecated Use CONFLICT_COVER_* or HIGH_COVERAGE_* */
export const ZERO_COVERAGE_MIN = CONFLICT_COVER_MIN;
/** @deprecated */
export const ZERO_COVERAGE_MAX = CONFLICT_COVER_MAX;
/** @deprecated */
export const DEFAULT_ZERO_COVERAGE = DEFAULT_HIGH_COVERAGE;

export const HIGHLIGHT_STRENGTH_MIN = 0;
export const HIGHLIGHT_STRENGTH_MAX = 100;
export const DEFAULT_OPPOSITE_HIGHLIGHT_STRENGTH = 70;

/** @type {VisualizationSettings} */
export const DEFAULT_VISUALIZATION_SETTINGS = Object.freeze({
  vizFilterMode: DEFAULT_VIZ_FILTER,
  ...DEFAULT_VIZ_COLORS,
  zeroCoverageEnabled: false,
  zeroCoverage: DEFAULT_HIGH_COVERAGE,
  labelsVisible: DEFAULT_LABELS_VISIBLE,
  sameSignCancelEnabled: false,
  sameSignCancelCoverage: DEFAULT_HIGH_COVERAGE,
  oppositeHighlightEnabled: false,
  oppositeHighlightColor: DEFAULT_OPPOSITE_HIGHLIGHT_COLOR,
  oppositeHighlightStrength: DEFAULT_OPPOSITE_HIGHLIGHT_STRENGTH,
  oppositeCancelCoverage: DEFAULT_CONFLICT_COVER,
});
const HEX_RE = /^#([0-9A-Fa-f]{6})$/;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidHex(value) {
  return typeof value === 'string' && HEX_RE.test(value);
}

/**
 * Normalize hex to uppercase #RRGGBB, or null if invalid.
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeHex(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (!isValidHex(withHash)) return null;
  return withHash.toUpperCase();
}

/**
 * Parse #RRGGBB → RGB in [0, 1].
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number }|null}
 */
export function hexToRgb01(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const n = parseInt(normalized.slice(1), 16);
  return {
    r: ((n >> 16) & 0xff) / 255,
    g: ((n >> 8) & 0xff) / 255,
    b: (n & 0xff) / 255,
  };
}

/**
 * @param {unknown} mode
 * @returns {VizFilterMode}
 */
export function normalizeFilterMode(mode) {
  if (mode === 'positive' || mode === 'negative' || mode === 'all') return mode;
  return DEFAULT_VIZ_FILTER;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function normalizeLabelsVisible(value) {
  if (value === false || value === 'false' || value === '0') return false;
  if (value === true || value === 'true' || value === '1') return true;
  if (value == null || value === '') return DEFAULT_LABELS_VISIBLE;
  return DEFAULT_LABELS_VISIBLE;
}

/**
 * @param {unknown} value
 * @param {boolean} [fallback=false]
 * @returns {boolean}
 */
export function normalizeBoolFlag(value, fallback = false) {
  if (value === false || value === 'false' || value === '0') return false;
  if (value === true || value === 'true' || value === '1') return true;
  if (value == null || value === '') return fallback;
  return fallback;
}

/**
 * Clamp highlight strength % to [0, 100].
 * @param {unknown} value
 * @returns {number}
 */
export function normalizeHighlightStrength(value) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_OPPOSITE_HIGHLIGHT_STRENGTH;
  return Math.max(HIGHLIGHT_STRENGTH_MIN, Math.min(HIGHLIGHT_STRENGTH_MAX, Math.round(n)));
}

/**
 * Clamp conflict-cover percent to [0, 90]. Invalid → default.
 * @param {unknown} value
 * @returns {number}
 */
export function normalizeConflictCover(value) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_CONFLICT_COVER;
  return Math.max(CONFLICT_COVER_MIN, Math.min(CONFLICT_COVER_MAX, Math.round(n)));
}

/**
 * @deprecated Prefer normalizeConflictCover or normalizeHighCoverage
 * @param {unknown} value
 * @returns {number}
 */
export function normalizeZeroCoverage(value) {
  return normalizeConflictCover(value);
}

/**
 * Clamp Zero coverage / Shared noise percent to [30, 99.9999].
 * @param {unknown} value
 * @returns {number}
 */
export function normalizeHighCoverage(value) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_HIGH_COVERAGE;
  const clamped = Math.max(HIGH_COVERAGE_MIN, Math.min(HIGH_COVERAGE_MAX, n));
  // Keep up to 4 decimal places (matches 99.9999)
  return Math.round(clamped * 10000) / 10000;
}

/**
 * Linear map slider position 0…10000 → high coverage %.
 * @param {unknown} pos
 * @returns {number}
 */
export function highCoverageFromSlider(pos) {
  const p = typeof pos === 'number' ? pos : Number(pos);
  if (!Number.isFinite(p)) return DEFAULT_HIGH_COVERAGE;
  const t = Math.max(0, Math.min(1, p / HIGH_COVERAGE_SLIDER_MAX));
  return normalizeHighCoverage(
    HIGH_COVERAGE_MIN + t * (HIGH_COVERAGE_MAX - HIGH_COVERAGE_MIN)
  );
}

/**
 * Inverse: high coverage % → slider position 0…10000.
 * @param {unknown} percent
 * @returns {number}
 */
export function highCoverageToSlider(percent) {
  const v = normalizeHighCoverage(percent);
  const t = (v - HIGH_COVERAGE_MIN) / (HIGH_COVERAGE_MAX - HIGH_COVERAGE_MIN);
  return Math.round(Math.max(0, Math.min(1, t)) * HIGH_COVERAGE_SLIDER_MAX);
}

/**
 * Display label for high coverage (trim trailing zeros, up to 4 decimals).
 * @param {unknown} percent
 * @returns {string}
 */
export function formatHighCoverage(percent) {
  const v = normalizeHighCoverage(percent);
  const rounded = Math.round(v * 10000) / 10000;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
    return `${Math.round(rounded)}%`;
  }
  return `${parseFloat(rounded.toFixed(4))}%`;
}

/**
 * Coverage % → unit fraction for ramp remapping (supports up to ~0.999999).
 * @param {number} percent
 * @returns {number}
 */
export function coveragePercentToUnit(percent) {
  const n = typeof percent === 'number' ? percent : Number(percent);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(0, Math.min(COVERAGE_UNIT_MAX, n / 100));
}

/**
 * @param {number} percent
 * @returns {number}
 */
export function zeroCoverageToUnit(percent) {
  return coveragePercentToUnit(percent);
}

/**
 * High coverage unit for Zero coverage / Shared noise.
 * @param {number} percent
 * @returns {number}
 */
export function highCoverageToUnit(percent) {
  return coveragePercentToUnit(normalizeHighCoverage(percent));
}

/**
 * Effective Zero coverage % (0 when toggle Off).
 * @param {{ zeroCoverageEnabled?: boolean, zeroCoverage?: number }|null|undefined} settings
 * @returns {number}
 */
export function effectiveZeroCoveragePercent(settings) {
  if (!settings || !settings.zeroCoverageEnabled) return 0;
  return normalizeHighCoverage(settings.zeroCoverage);
}

/**
 * Remap |t| so the zero color occupies `coverage01` of the range before lerping to ±1.
 * coverage=0 → identity; coverage=0.5 → |t|≤0.5 stays zero, then stretches 0.5→1 onto 0→1.
 *
 * @param {number} absT - Absolute normalized activation in [0, 1]
 * @param {number} coverage01 - Fraction in [0, COVERAGE_UNIT_MAX]
 * @returns {number} Blend factor in [0, 1]
 */
export function remapAbsTWithZeroCoverage(absT, coverage01 = 0) {
  const a = Math.max(0, Math.min(1, absT));
  const c = Math.max(0, Math.min(COVERAGE_UNIT_MAX, coverage01));
  if (c <= 1e-12) return a;
  if (a <= c) return 0;
  return (a - c) / Math.max(1 - c, 1e-12);
}

/**
 * @param {Partial<VisualizationSettings>|null|undefined} partial
 * @returns {VisualizationSettings}
 */
export function resolveVisualizationSettings(partial = null) {
  const src = partial && typeof partial === 'object' ? partial : {};
  return {
    vizFilterMode: normalizeFilterMode(src.vizFilterMode),
    colorPositive: normalizeHex(src.colorPositive) || DEFAULT_VIZ_COLORS.colorPositive,
    colorZero: normalizeHex(src.colorZero) || DEFAULT_VIZ_COLORS.colorZero,
    colorNegative: normalizeHex(src.colorNegative) || DEFAULT_VIZ_COLORS.colorNegative,
    zeroCoverageEnabled: normalizeBoolFlag(
      src.zeroCoverageEnabled,
      DEFAULT_VISUALIZATION_SETTINGS.zeroCoverageEnabled
    ),
    zeroCoverage: normalizeHighCoverage(
      src.zeroCoverage !== undefined && src.zeroCoverage !== null
        ? src.zeroCoverage
        : DEFAULT_HIGH_COVERAGE
    ),
    labelsVisible: normalizeLabelsVisible(
      src.labelsVisible !== undefined && src.labelsVisible !== null
        ? src.labelsVisible
        : DEFAULT_LABELS_VISIBLE
    ),
    sameSignCancelEnabled: normalizeBoolFlag(
      src.sameSignCancelEnabled,
      DEFAULT_VISUALIZATION_SETTINGS.sameSignCancelEnabled
    ),
    sameSignCancelCoverage: normalizeHighCoverage(
      src.sameSignCancelCoverage !== undefined && src.sameSignCancelCoverage !== null
        ? src.sameSignCancelCoverage
        : DEFAULT_HIGH_COVERAGE
    ),
    oppositeHighlightEnabled: normalizeBoolFlag(
      src.oppositeHighlightEnabled,
      DEFAULT_VISUALIZATION_SETTINGS.oppositeHighlightEnabled
    ),
    oppositeHighlightColor:
      normalizeHex(src.oppositeHighlightColor) || DEFAULT_OPPOSITE_HIGHLIGHT_COLOR,
    oppositeHighlightStrength: normalizeHighlightStrength(
      src.oppositeHighlightStrength !== undefined && src.oppositeHighlightStrength !== null
        ? src.oppositeHighlightStrength
        : DEFAULT_OPPOSITE_HIGHLIGHT_STRENGTH
    ),
    oppositeCancelCoverage: normalizeConflictCover(
      src.oppositeCancelCoverage !== undefined && src.oppositeCancelCoverage !== null
        ? src.oppositeCancelCoverage
        : DEFAULT_CONFLICT_COVER
    ),
  };
}
/**
 * @param {Storage|null|undefined} storage
 * @returns {VisualizationSettings}
 */
export function loadVisualizationSettings(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return { ...DEFAULT_VISUALIZATION_SETTINGS };
  try {
    return resolveVisualizationSettings({
      vizFilterMode: storage.getItem(VIZ_STORAGE_KEYS.filter),
      colorPositive: storage.getItem(VIZ_STORAGE_KEYS.colorPositive),
      colorZero: storage.getItem(VIZ_STORAGE_KEYS.colorZero),
      colorNegative: storage.getItem(VIZ_STORAGE_KEYS.colorNegative),
      zeroCoverageEnabled: storage.getItem(VIZ_STORAGE_KEYS.zeroCoverageEnabled),
      zeroCoverage: storage.getItem(VIZ_STORAGE_KEYS.zeroCoverage),
      labelsVisible: storage.getItem(VIZ_STORAGE_KEYS.labelsVisible),
      sameSignCancelEnabled: storage.getItem(VIZ_STORAGE_KEYS.sameSignCancelEnabled),
      sameSignCancelCoverage: storage.getItem(VIZ_STORAGE_KEYS.sameSignCancelCoverage),
      oppositeHighlightEnabled: storage.getItem(VIZ_STORAGE_KEYS.oppositeHighlightEnabled),
      oppositeHighlightColor: storage.getItem(VIZ_STORAGE_KEYS.oppositeHighlightColor),
      oppositeHighlightStrength: storage.getItem(VIZ_STORAGE_KEYS.oppositeHighlightStrength),
      oppositeCancelCoverage: storage.getItem(VIZ_STORAGE_KEYS.oppositeCancelCoverage),
    });
  } catch {
    return { ...DEFAULT_VISUALIZATION_SETTINGS };
  }
}
/**
 * @param {VisualizationSettings} settings
 * @param {Storage|null|undefined} storage
 */
export function saveVisualizationSettings(settings, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return;
  const resolved = resolveVisualizationSettings(settings);
  try {
    storage.setItem(VIZ_STORAGE_KEYS.filter, resolved.vizFilterMode);
    storage.setItem(VIZ_STORAGE_KEYS.colorPositive, resolved.colorPositive);
    storage.setItem(VIZ_STORAGE_KEYS.colorZero, resolved.colorZero);
    storage.setItem(VIZ_STORAGE_KEYS.colorNegative, resolved.colorNegative);
    storage.setItem(VIZ_STORAGE_KEYS.zeroCoverageEnabled, String(resolved.zeroCoverageEnabled));
    storage.setItem(VIZ_STORAGE_KEYS.zeroCoverage, String(resolved.zeroCoverage));
    storage.setItem(VIZ_STORAGE_KEYS.labelsVisible, String(resolved.labelsVisible));
    storage.setItem(VIZ_STORAGE_KEYS.sameSignCancelEnabled, String(resolved.sameSignCancelEnabled));
    storage.setItem(VIZ_STORAGE_KEYS.sameSignCancelCoverage, String(resolved.sameSignCancelCoverage));
    storage.setItem(VIZ_STORAGE_KEYS.oppositeHighlightEnabled, String(resolved.oppositeHighlightEnabled));
    storage.setItem(VIZ_STORAGE_KEYS.oppositeHighlightColor, resolved.oppositeHighlightColor);
    storage.setItem(VIZ_STORAGE_KEYS.oppositeHighlightStrength, String(resolved.oppositeHighlightStrength));
    storage.setItem(VIZ_STORAGE_KEYS.oppositeCancelCoverage, String(resolved.oppositeCancelCoverage));
  } catch {
    // Quota / private mode — ignore
  }
}

/**
 * @param {Storage|null|undefined} storage
 * @returns {VisualizationSettings}
 */
export function resetVisualizationSettings(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  const defaults = { ...DEFAULT_VISUALIZATION_SETTINGS };
  saveVisualizationSettings(defaults, storage);
  return defaults;
}

/**
 * RGB01 anchors for DivergentShading from settings hex trio.
 * @param {VisualizationSettings} settings
 * @returns {{ positive: {r:number,g:number,b:number}, zero: {r:number,g:number,b:number}, negative: {r:number,g:number,b:number} }}
 */
export function anchorsFromSettings(settings) {
  const resolved = resolveVisualizationSettings(settings);
  return {
    positive: hexToRgb01(resolved.colorPositive),
    zero: hexToRgb01(resolved.colorZero),
    negative: hexToRgb01(resolved.colorNegative),
  };
}
