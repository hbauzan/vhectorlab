import { describe, expect, it } from 'vitest';
import {
  AMIGA_COLOR_CSS_VARS,
  AMIGA_COLOR_ENV_KEYS,
  DEFAULT_AMIGA_COLORS,
  applyAmigaCssVars,
  normalizeHex,
  resolveAmigaColors,
} from '../src/amiga/amigaEnvColors.js';

describe('normalizeHex', () => {
  it('accepts #RRGGBB and RRGGBB', () => {
    expect(normalizeHex('#959595')).toBe('#959595');
    expect(normalizeHex('707070')).toBe('#707070');
    expect(normalizeHex('  #3b67a2  ')).toBe('#3B67A2');
  });

  it('rejects empty / invalid', () => {
    expect(normalizeHex('')).toBeNull();
    expect(normalizeHex('#fff')).toBeNull();
    expect(normalizeHex('not-a-color')).toBeNull();
    expect(normalizeHex(undefined)).toBeNull();
  });
});

describe('resolveAmigaColors', () => {
  it('returns defaults when env is empty', () => {
    expect(resolveAmigaColors({})).toEqual(DEFAULT_AMIGA_COLORS);
    expect(resolveAmigaColors(null)).toEqual(DEFAULT_AMIGA_COLORS);
  });

  it('overrides only valid env keys', () => {
    const colors = resolveAmigaColors({
      [AMIGA_COLOR_ENV_KEYS.bg]: '#112233',
      [AMIGA_COLOR_ENV_KEYS.pen3]: 'AABBCC',
      [AMIGA_COLOR_ENV_KEYS.fg]: 'nope',
      VITE_UNRELATED: '#FFFFFF',
    });
    expect(colors.bg).toBe('#112233');
    expect(colors.pen3).toBe('#AABBCC');
    expect(colors.fg).toBe(DEFAULT_AMIGA_COLORS.fg);
    expect(colors.accent).toBe(DEFAULT_AMIGA_COLORS.accent);
  });
});

describe('applyAmigaCssVars', () => {
  it('sets CSS custom properties on the element', () => {
    const props = {};
    const el = {
      style: {
        setProperty(name, value) {
          props[name] = value;
        },
      },
    };
    applyAmigaCssVars(el, DEFAULT_AMIGA_COLORS);
    expect(props[AMIGA_COLOR_CSS_VARS.bg]).toBe(DEFAULT_AMIGA_COLORS.bg);
    expect(props[AMIGA_COLOR_CSS_VARS.pen0]).toBe(DEFAULT_AMIGA_COLORS.pen0);
    expect(props[AMIGA_COLOR_CSS_VARS.accent]).toBe(DEFAULT_AMIGA_COLORS.accent);
    expect(Object.keys(props)).toHaveLength(Object.keys(AMIGA_COLOR_CSS_VARS).length);
  });
});
