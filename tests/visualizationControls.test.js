import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_VISUALIZATION_SETTINGS,
  DEFAULT_VIZ_COLORS,
  DEFAULT_VIZ_FILTER,
  VIZ_STORAGE_KEYS,
  isValidHex,
  normalizeHex,
  hexToRgb01,
  resolveVisualizationSettings,
  loadVisualizationSettings,
  saveVisualizationSettings,
  resetVisualizationSettings,
  anchorsFromSettings,
} from '../src/ui/visualizationControlsDefaults.js';
import {
  NEAR_ZERO_EPS,
  shouldShowActivation,
  filterPointsData,
  lineSegmentIndices,
  wideRibbonQuadIndices,
} from '../src/visualizer/activationFilter.js';
import { getDivergentColor } from '../src/visualizer/DivergentShading.js';

function mockStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    _map: map,
  };
}

describe('visualizationControlsDefaults', () => {
  it('defaults match §0.2 anchors and filter All', () => {
    expect(DEFAULT_VIZ_FILTER).toBe('all');
    expect(DEFAULT_VIZ_COLORS.colorPositive).toBe('#FFE600');
    expect(DEFAULT_VIZ_COLORS.colorZero).toBe('#000000');
    expect(DEFAULT_VIZ_COLORS.colorNegative).toBe('#9900E6');
    expect(DEFAULT_VISUALIZATION_SETTINGS).toEqual({
      vizFilterMode: 'all',
      colorPositive: '#FFE600',
      colorZero: '#000000',
      colorNegative: '#9900E6',
    });
  });

  it('validates and normalizes hex', () => {
    expect(isValidHex('#FFE600')).toBe(true);
    expect(isValidHex('#ff00')).toBe(false);
    expect(isValidHex('not-a-color')).toBe(false);
    expect(normalizeHex('ffe600')).toBe('#FFE600');
    expect(normalizeHex('#abc')).toBeNull();
  });

  it('hexToRgb01 parses endpoints', () => {
    expect(hexToRgb01('#FFE600')).toEqual({
      r: 1,
      g: 230 / 255,
      b: 0,
    });
    expect(hexToRgb01('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb01('#9900E6')).toEqual({
      r: 153 / 255,
      g: 0,
      b: 230 / 255,
    });
  });

  it('resolveVisualizationSettings falls back invalid hex and mode', () => {
    const resolved = resolveVisualizationSettings({
      vizFilterMode: 'nope',
      colorPositive: 'bad',
      colorZero: '#112233',
      colorNegative: '#9900E6',
    });
    expect(resolved.vizFilterMode).toBe('all');
    expect(resolved.colorPositive).toBe('#FFE600');
    expect(resolved.colorZero).toBe('#112233');
    expect(resolved.colorNegative).toBe('#9900E6');
  });

  it('persist round-trip via mock localStorage', () => {
    const storage = mockStorage();
    const settings = resolveVisualizationSettings({
      vizFilterMode: 'positive',
      colorPositive: '#FF0000',
      colorZero: '#111111',
      colorNegative: '#0000FF',
    });
    saveVisualizationSettings(settings, storage);
    expect(storage.getItem(VIZ_STORAGE_KEYS.filter)).toBe('positive');
    expect(loadVisualizationSettings(storage)).toEqual(settings);
  });

  it('reset restores defaults and All', () => {
    const storage = mockStorage({
      [VIZ_STORAGE_KEYS.filter]: 'negative',
      [VIZ_STORAGE_KEYS.colorPositive]: '#FF0000',
    });
    const reset = resetVisualizationSettings(storage);
    expect(reset).toEqual(DEFAULT_VISUALIZATION_SETTINGS);
    expect(loadVisualizationSettings(storage)).toEqual(DEFAULT_VISUALIZATION_SETTINGS);
  });

  it('anchorsFromSettings yields RGB01 trio', () => {
    const a = anchorsFromSettings(DEFAULT_VISUALIZATION_SETTINGS);
    expect(a.positive.r).toBeCloseTo(1, 5);
    expect(a.zero).toEqual({ r: 0, g: 0, b: 0 });
    expect(a.negative.b).toBeCloseTo(230 / 255, 5);
  });
});

describe('shouldShowActivation / filter helpers', () => {
  const samples = [1, 0.5, 0.005, -0.5, -1];

  it('all mode shows every sample', () => {
    for (const v of samples) {
      expect(shouldShowActivation(v, 'all')).toBe(true);
    }
  });

  it('+ only hides negatives and near-zero', () => {
    expect(shouldShowActivation(1, 'positive')).toBe(true);
    expect(shouldShowActivation(0.5, 'positive')).toBe(true);
    expect(shouldShowActivation(0.005, 'positive')).toBe(false);
    expect(shouldShowActivation(-0.5, 'positive')).toBe(false);
    expect(shouldShowActivation(-1, 'positive')).toBe(false);
  });

  it('− only hides positives and near-zero', () => {
    expect(shouldShowActivation(1, 'negative')).toBe(false);
    expect(shouldShowActivation(0.5, 'negative')).toBe(false);
    expect(shouldShowActivation(0.005, 'negative')).toBe(false);
    expect(shouldShowActivation(-0.5, 'negative')).toBe(true);
    expect(shouldShowActivation(-1, 'negative')).toBe(true);
  });

  it('uses ε = 0.01 by default', () => {
    expect(NEAR_ZERO_EPS).toBe(0.01);
    expect(shouldShowActivation(0.009, 'positive')).toBe(false);
    expect(shouldShowActivation(0.01, 'positive')).toBe(true);
  });

  it('filterPointsData keeps aligned entries', () => {
    const points = samples.map((activation, i) => ({ i, activation }));
    const kept = filterPointsData(points, samples, 'positive');
    expect(kept.map((p) => p.i)).toEqual([0, 1]);
  });

  it('lineSegmentIndices breaks across hidden signs', () => {
    // visible, visible, near-zero, visible-neg → only first segment
    const norm = [0.5, 0.8, 0.0, -0.5];
    expect(lineSegmentIndices(norm, 'positive')).toEqual([0, 1]);
    expect(lineSegmentIndices(norm, 'all')).toEqual([0, 1, 1, 2, 2, 3]);
  });

  it('wideRibbonQuadIndices omits quads for filtered pairs', () => {
    const norm = [0.5, 0.8, -0.5];
    expect(wideRibbonQuadIndices(norm, 'positive')).toEqual([0, 2, 1, 1, 2, 3]);
    expect(wideRibbonQuadIndices(norm, 'negative')).toEqual([]);
  });
});

describe('getDivergentColor with color anchors', () => {
  const anchors = anchorsFromSettings(DEFAULT_VISUALIZATION_SETTINGS);

  it('t=1 → +1 hex', () => {
    const c = getDivergentColor(1, 1, anchors);
    expect(c.r).toBeCloseTo(anchors.positive.r, 5);
    expect(c.g).toBeCloseTo(anchors.positive.g, 5);
    expect(c.b).toBeCloseTo(anchors.positive.b, 5);
  });

  it('t=0 → 0 hex with low alpha', () => {
    const c = getDivergentColor(0, 1, anchors);
    expect(c.r).toBeCloseTo(anchors.zero.r, 5);
    expect(c.g).toBeCloseTo(anchors.zero.g, 5);
    expect(c.b).toBeCloseTo(anchors.zero.b, 5);
    expect(c.alpha).toBeCloseTo(0.05, 5);
  });

  it('t=-1 → −1 hex', () => {
    const c = getDivergentColor(-1, 1, anchors);
    expect(c.r).toBeCloseTo(anchors.negative.r, 5);
    expect(c.g).toBeCloseTo(anchors.negative.g, 5);
    expect(c.b).toBeCloseTo(anchors.negative.b, 5);
  });

  it('t=0.5 → midpoint lerp 0↔+1', () => {
    const c = getDivergentColor(0.5, 1, anchors);
    expect(c.r).toBeCloseTo((anchors.zero.r + anchors.positive.r) / 2, 5);
    expect(c.g).toBeCloseTo((anchors.zero.g + anchors.positive.g) / 2, 5);
    expect(c.b).toBeCloseTo((anchors.zero.b + anchors.positive.b) / 2, 5);
  });
});
