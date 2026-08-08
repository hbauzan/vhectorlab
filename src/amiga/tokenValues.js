/**
 * Magic Workbench 8-pen palette + semantic aliases.
 * Keep hex in sync with `tokens.css`.
 * Source: MagicWB canonical RGB (Wikipedia / MagicWB docs).
 */
export const MWB_PENS = Object.freeze({
  0: '#959595',
  1: '#000000',
  2: '#FFFFFF',
  3: '#3B67A2',
  4: '#7B7B7B',
  5: '#AFAFAF',
  6: '#AA907C',
  7: '#FFA997',
});

export const AMIGA_TOKEN_HEX = Object.freeze({
  bg: MWB_PENS[0],
  fg: MWB_PENS[1],
  white: MWB_PENS[2],
  accent: MWB_PENS[3],
  halfshadow: MWB_PENS[4],
  halfshine: MWB_PENS[5],
  tan: MWB_PENS[6],
  peach: MWB_PENS[7],
  fontSizePx: 16,
  lineHeightPx: 20,
});
