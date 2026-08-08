import { describe, expect, it } from 'vitest';
import {
  AMIGA_BG_DARKENED,
  AMIGA_TOKEN_HEX,
  MWB_PENS,
} from '../src/amiga/tokenValues.js';
import { PRODUCT_VERSION } from '../src/amiga/version.js';

describe('MagicWB pens', () => {
  it('exposes the canonical 8-pen palette', () => {
    expect(MWB_PENS).toEqual({
      0: '#959595',
      1: '#000000',
      2: '#FFFFFF',
      3: '#3B67A2',
      4: '#7B7B7B',
      5: '#AFAFAF',
      6: '#AA907C',
      7: '#FFA997',
    });
  });
});

describe('amiga semantic tokens', () => {
  it('uses a 25%-darker gray for page background', () => {
    expect(AMIGA_TOKEN_HEX.bg).toBe(AMIGA_BG_DARKENED);
    expect(AMIGA_BG_DARKENED).toBe('#707070');
    expect(AMIGA_TOKEN_HEX.fg).toBe(MWB_PENS[1]);
    expect(AMIGA_TOKEN_HEX.accent).toBe(MWB_PENS[3]);
  });

  it('uses pixel-perfect 16/20 typography sizes', () => {
    expect(AMIGA_TOKEN_HEX.fontSizePx).toBe(16);
    expect(AMIGA_TOKEN_HEX.lineHeightPx).toBe(20);
    expect(AMIGA_TOKEN_HEX.fontSizePx % 8).toBe(0);
  });
});

describe('amiga product version', () => {
  it('starts the 2.4.x line', () => {
    expect(PRODUCT_VERSION).toMatch(/^2\.4\.\d+$/);
  });
});
