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
 * }} VisualizationSettings */

export const VIZ_STORAGE_PREFIX = 'vl3d.viz.';

export const VIZ_STORAGE_KEYS = Object.freeze({
  filter: `${VIZ_STORAGE_PREFIX}filter`,
  colorPositive: `${VIZ_STORAGE_PREFIX}colorPositive`,
  colorZero: `${VIZ_STORAGE_PREFIX}colorZero`,
  colorNegative: `${VIZ_STORAGE_PREFIX}colorNegative`,
});

/** Default anchors match former ramp endpoints (§0.2). */
export const DEFAULT_VIZ_COLORS = Object.freeze({
  colorPositive: '#FFE600',
  colorZero: '#000000',
  colorNegative: '#9900E6',
});

export const DEFAULT_VIZ_FILTER = /** @type {VizFilterMode} */ ('all');

/** @type {VisualizationSettings} */
export const DEFAULT_VISUALIZATION_SETTINGS = Object.freeze({
  vizFilterMode: DEFAULT_VIZ_FILTER,
  ...DEFAULT_VIZ_COLORS,
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
