/**
 * Workbench / MagicWB theme colors from Vite env (`VITE_AMIGA_*`) with built-in defaults.
 * Pure resolve + DOM apply — testable without Vite.
 */

/** Canonical MagicWB 8-pen + semantic chrome defaults (dark gray surfaces). */
export const DEFAULT_AMIGA_COLORS = Object.freeze({
  pen0: '#2A2A2A',
  pen1: '#000000',
  pen2: '#FFFFFF',
  pen3: '#3B67A2',
  pen4: '#1A1A1A',
  pen5: '#3D3D3D',
  pen6: '#AA907C',
  pen7: '#FFA997',
  /** Page / panel background — very dark gray */
  bg: '#222222',
  /** Light text on dark gray surfaces */
  fg: '#F0F0F0',
  accent: '#3B67A2',
});

/** Env key → color field */
export const AMIGA_COLOR_ENV_KEYS = Object.freeze({
  pen0: 'VITE_AMIGA_PEN_0',
  pen1: 'VITE_AMIGA_PEN_1',
  pen2: 'VITE_AMIGA_PEN_2',
  pen3: 'VITE_AMIGA_PEN_3',
  pen4: 'VITE_AMIGA_PEN_4',
  pen5: 'VITE_AMIGA_PEN_5',
  pen6: 'VITE_AMIGA_PEN_6',
  pen7: 'VITE_AMIGA_PEN_7',
  bg: 'VITE_AMIGA_BG',
  fg: 'VITE_AMIGA_FG',
  accent: 'VITE_AMIGA_ACCENT',
});

/** CSS custom property for each field */
export const AMIGA_COLOR_CSS_VARS = Object.freeze({
  pen0: '--mwb-gray',
  pen1: '--mwb-black',
  pen2: '--mwb-white',
  pen3: '--mwb-blue',
  pen4: '--mwb-halfshadow',
  pen5: '--mwb-halfshine',
  pen6: '--mwb-tan',
  pen7: '--mwb-peach',
  bg: '--amiga-bg',
  fg: '--amiga-fg',
  accent: '--amiga-accent',
});

/**
 * @param {unknown} value
 * @returns {string | null} Normalized `#RRGGBB` or null if invalid
 */
export function normalizeHex(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(raw);
  if (!m) return null;
  return `#${m[1].toUpperCase()}`;
}

/**
 * Merge env overrides onto defaults. Invalid / empty env values keep the default.
 *
 * @param {Record<string, string | undefined> | undefined | null} env
 * @returns {Readonly<typeof DEFAULT_AMIGA_COLORS>}
 */
export function resolveAmigaColors(env) {
  const source = env && typeof env === 'object' ? env : {};
  const next = { ...DEFAULT_AMIGA_COLORS };
  for (const [field, envKey] of Object.entries(AMIGA_COLOR_ENV_KEYS)) {
    const parsed = normalizeHex(source[envKey]);
    if (parsed) next[field] = parsed;
  }
  return Object.freeze(next);
}

/**
 * Write resolved colors onto an element as CSS variables.
 *
 * @param {Element & { style: CSSStyleDeclaration }} el
 * @param {Record<string, string>} colors
 */
export function applyAmigaCssVars(el, colors) {
  if (!el?.style?.setProperty) return;
  for (const [field, cssVar] of Object.entries(AMIGA_COLOR_CSS_VARS)) {
    if (colors[field]) el.style.setProperty(cssVar, colors[field]);
  }
}
