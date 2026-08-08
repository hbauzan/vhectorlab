/**
 * Magic Workbench palette defaults (mirrored by CSS fallbacks + `.env.example`).
 * Runtime overrides: `resolveAmigaColors(import.meta.env)` via `VITE_AMIGA_*`.
 */
import { DEFAULT_AMIGA_COLORS } from './magicwbEnvColors.js';

export const MWB_PENS = Object.freeze({
  0: DEFAULT_AMIGA_COLORS.pen0,
  1: DEFAULT_AMIGA_COLORS.pen1,
  2: DEFAULT_AMIGA_COLORS.pen2,
  3: DEFAULT_AMIGA_COLORS.pen3,
  4: DEFAULT_AMIGA_COLORS.pen4,
  5: DEFAULT_AMIGA_COLORS.pen5,
  6: DEFAULT_AMIGA_COLORS.pen6,
  7: DEFAULT_AMIGA_COLORS.pen7,
});

export const AMIGA_BG_DARKENED = DEFAULT_AMIGA_COLORS.bg;

export const AMIGA_TOKEN_HEX = Object.freeze({
  bg: DEFAULT_AMIGA_COLORS.bg,
  fg: DEFAULT_AMIGA_COLORS.fg,
  white: DEFAULT_AMIGA_COLORS.pen2,
  accent: DEFAULT_AMIGA_COLORS.accent,
  halfshadow: DEFAULT_AMIGA_COLORS.pen4,
  halfshine: DEFAULT_AMIGA_COLORS.pen5,
  tan: DEFAULT_AMIGA_COLORS.pen6,
  peach: DEFAULT_AMIGA_COLORS.pen7,
  fontSizePx: 16,
  lineHeightPx: 20,
});
