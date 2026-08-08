import { describe, it, expect } from 'vitest';
import {
  resolveHoverTelemetry,
  formatActivationValue,
  formatHoverTokenLabel,
  estimateMonospaceChars,
  activationDisplayBudget,
  MAX_ACTIVATION_DECIMALS,
} from '../src/ui/hoverTelemetry.js';

describe('resolveHoverTelemetry', () => {
  it('returns null for empty hover', () => {
    expect(resolveHoverTelemetry(null)).toBeNull();
    expect(resolveHoverTelemetry(undefined)).toBeNull();
  });

  it('reads activation from pointsData[index] (POINTS mesh)', () => {
    const data = {
      index: 1,
      point: { x: 10, y: 2, z: 0 },
      userData: {
        pointsData: [
          { activation: 0.01, meta: { type: 'compare', token: 'cat', dim: 0, val: 0.01 } },
          { activation: -0.0421, meta: { type: 'compare', token: 'cat', dim: 1, val: -0.0421 } },
        ],
      },
    };
    const t = resolveHoverTelemetry(data);
    expect(t.activation).toBe(-0.0421);
    expect(t.token).toBe('cat');
    expect(t.tokenLabel).toBe('cat');
    expect(t.groupLabel).toBeNull();
    expect(t.type).toBe('COMPARE');
    expect(t.dim).toBe(1);
    expect(t.point).toEqual({ x: 10, y: 2, z: 0 });
  });

  it('formats grouped token as group/token without spaces', () => {
    expect(formatHoverTokenLabel('car', 'vehicles')).toBe('vehicles/car');
    expect(formatHoverTokenLabel('car', null)).toBe('car');
    expect(formatHoverTokenLabel('car', '')).toBe('car');

    const t = resolveHoverTelemetry({
      index: 0,
      userData: {
        pointsData: [{
          activation: 0.2,
          groupId: 'vehicles',
          groupLabel: 'vehicles',
          meta: {
            type: 'compare',
            token: 'car',
            dim: 0,
            val: 0.2,
            groupId: 'vehicles',
            groupLabel: 'vehicles',
          },
        }],
      },
    });
    expect(t.token).toBe('car');
    expect(t.groupLabel).toBe('vehicles');
    expect(t.tokenLabel).toBe('vehicles/car');
  });

  it('maps ribbon actIdx through sourceDims when present', () => {
    const data = {
      index: 4,
      face: { a: 6, b: 7, c: 8 },
      userData: {
        kind: 'wideRibbon',
        activations: [0.1, 0.2, 0.3, 0.4],
        sourceDims: [10, 20, 30, 40],
        token: 'dog',
        type: 'compare',
      },
    };
    const t = resolveHoverTelemetry(data);
    expect(t.activation).toBe(0.4);
    expect(t.dim).toBe(40);
  });

  it('does not fall back to 0 when pointsData has a real value (regression)', () => {
    // Legacy HUD read userData.val / data.activation — both missing on Points meshes
    const data = {
      index: 0,
      point: { x: 1, y: 0, z: 0 },
      userData: {
        pointsData: [{ activation: 1.23e-7, meta: { dim: 0, val: 1.23e-7, type: 'res' } }],
      },
    };
    expect(resolveHoverTelemetry(data).activation).toBe(1.23e-7);
  });

  it('reads activations[] on wideRibbon via face vertex index', () => {
    const data = {
      index: 4,
      face: { a: 6, b: 7, c: 8 },
      userData: {
        kind: 'wideRibbon',
        activations: [0.1, 0.2, 0.3, 0.4, 0.5],
        token: 'dog',
        type: 'compare',
      },
    };
    const t = resolveHoverTelemetry(data);
    expect(t.activation).toBe(0.4); // floor(6/2) = 3
    expect(t.token).toBe('dog');
  });

  it('falls back to DIM #n when no token meta', () => {
    const t = resolveHoverTelemetry({
      index: 12,
      userData: {
        pointsData: [{ activation: 0.5, meta: { dim: 12, val: 0.5 } }],
      },
    });
    expect(t.token).toBe('DIM #12');
  });
});

describe('formatActivationValue', () => {
  it('caps decimals at 32', () => {
    expect(MAX_ACTIVATION_DECIMALS).toBe(32);
    const tiny = 1e-30;
    const s = formatActivationValue(tiny, { maxDecimals: 32, maxChars: 40 });
    expect(s.includes('e') || s.length <= 40).toBe(true);
    // Must not be the old HUD "0.0000"
    expect(s).not.toBe('0.0000');
    expect(Number(s)).not.toBe(0);
  });

  it('shows small magnitudes that toFixed(4) would hide', () => {
    const s = formatActivationValue(0.00001234, { maxDecimals: 32, maxChars: 20 });
    expect(s).not.toMatch(/^0\.0+$/);
    expect(Math.abs(Number(s) - 0.00001234)).toBeLessThan(1e-8);
  });

  it('shrinks to fit maxChars without overflowing', () => {
    const s = formatActivationValue(0.123456789012345, { maxDecimals: 32, maxChars: 8 });
    expect(s.length).toBeLessThanOrEqual(8);
    expect(s).not.toBe('0');
  });

  it('uses scientific when fixed form cannot fit', () => {
    const s = formatActivationValue(1.23456789e-20, { maxDecimals: 32, maxChars: 10 });
    expect(s.length).toBeLessThanOrEqual(10);
    expect(s).toMatch(/e/i);
  });

  it('formats zero as 0', () => {
    expect(formatActivationValue(0, { maxChars: 10 })).toBe('0');
  });
});

describe('activationDisplayBudget', () => {
  it('estimates monospace capacity', () => {
    expect(estimateMonospaceChars(120, 12)).toBeGreaterThan(10);
  });

  it('switches to compact ACT: label when slot is narrow (mobile)', () => {
    const wide = activationDisplayBudget(400, 'ACTIVATION: ', 12);
    expect(wide.compactLabel).toBe(false);

    const narrow = activationDisplayBudget(90, 'ACTIVATION: ', 11);
    expect(narrow.compactLabel).toBe(true);
    expect(narrow.maxChars).toBeGreaterThanOrEqual(4);
  });
});
