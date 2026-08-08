import { describe, expect, it } from 'vitest';
import {
  AMIGA_BG_DARKENED,
  AMIGA_TOKEN_HEX,
  MWB_PENS,
} from '../src/amiga/tokenValues.js';
import { PRODUCT_VERSION } from '../src/amiga/version.js';

describe('MagicWB pens', () => {
  it('exposes dark-gray palette defaults', () => {
    expect(MWB_PENS).toEqual({
      0: '#2A2A2A',
      1: '#000000',
      2: '#FFFFFF',
      3: '#3B67A2',
      4: '#1A1A1A',
      5: '#3D3D3D',
      6: '#AA907C',
      7: '#FFA997',
    });
  });
});

describe('amiga semantic tokens', () => {
  it('uses very dark gray bg with light fg', () => {
    expect(AMIGA_TOKEN_HEX.bg).toBe(AMIGA_BG_DARKENED);
    expect(AMIGA_BG_DARKENED).toBe('#222222');
    expect(AMIGA_TOKEN_HEX.fg).toBe('#F0F0F0');
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
