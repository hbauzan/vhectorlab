import { describe, it, expect, afterEach } from 'vitest';
import {
  GLOBAL_SPATIAL_DEFAULTS,
  SPATIAL_DEFAULT_OVERRIDES,
  resolveSpatialDefaults,
} from '../src/ui/spatialSliderDefaults.js';

describe('resolveSpatialDefaults', () => {
  const savedKeys = [];

  afterEach(() => {
    for (const key of savedKeys.splice(0)) {
      delete SPATIAL_DEFAULT_OVERRIDES[key];
    }
  });

  function setOverride(key, partial) {
    SPATIAL_DEFAULT_OVERRIDES[key] = partial;
    savedKeys.push(key);
  }

  it('returns global mid defaults when no overrides exist', () => {
    const d = resolveSpatialDefaults({
      workspaceMode: 'COMPARE',
      viewMode: 'ANALYSIS',
      renderMode: 'RIBBONS',
    });
    expect(d.threadSpacing).toBe(GLOBAL_SPATIAL_DEFAULTS.threadSpacing);
    expect(d.threadVectorDistance).toBe(GLOBAL_SPATIAL_DEFAULTS.threadVectorDistance);
    expect(d.threadAmplitudeY).toBe(GLOBAL_SPATIAL_DEFAULTS.threadAmplitudeY);
    expect(d.threadWidth).toBe(GLOBAL_SPATIAL_DEFAULTS.threadWidth);
    expect(d.threadThickness).toBe(GLOBAL_SPATIAL_DEFAULTS.threadThickness);
    expect(d.threadSpacingY).toBe(d.threadVectorDistance);
  });

  it('applies workspace → view → render layers (more specific wins)', () => {
    setOverride('ARITHMETIC', { threadSpacing: 0.5 });
    setOverride('ARITHMETIC|NAVIGATION', { threadAmplitudeY: 9.0 });
    setOverride('ARITHMETIC|NAVIGATION|POINTS', { threadThickness: 0.12 });

    const d = resolveSpatialDefaults({
      workspaceMode: 'ARITHMETIC',
      viewMode: 'NAVIGATION',
      renderMode: 'POINTS',
    });
    expect(d.threadSpacing).toBe(0.5);
    expect(d.threadAmplitudeY).toBe(9.0);
    expect(d.threadThickness).toBe(0.12);
    expect(d.threadWidth).toBe(GLOBAL_SPATIAL_DEFAULTS.threadWidth);
  });

  it('does not leak overrides from a different context', () => {
    setOverride('COMPARE|ANALYSIS|RIBBONS', { threadWidth: 0.25 });

    const d = resolveSpatialDefaults({
      workspaceMode: 'ARITHMETIC',
      viewMode: 'NAVIGATION',
      renderMode: 'POINTS',
    });
    expect(d.threadWidth).toBe(GLOBAL_SPATIAL_DEFAULTS.threadWidth);
  });

  it('applies captured ARITHMETIC|ANALYSIS|POINTS preset (Amplitude 40)', () => {
    // Production override lives in SPATIAL_DEFAULT_OVERRIDES — assert the seam.
    const d = resolveSpatialDefaults({
      workspaceMode: 'ARITHMETIC',
      viewMode: 'ANALYSIS',
      renderMode: 'POINTS',
    });
    expect(d.threadSpacing).toBe(0.4);
    expect(d.threadVectorDistance).toBe(10.0);
    expect(d.threadAmplitudeY).toBe(40.0);
    expect(d.threadWidth).toBe(0.2);
    expect(d.threadThickness).toBe(0.05);
  });

  it('applies captured COMPARE|NAVIGATION|POINTS preset', () => {
    const d = resolveSpatialDefaults({
      workspaceMode: 'COMPARE',
      viewMode: 'NAVIGATION',
      renderMode: 'POINTS',
    });
    expect(d.threadSpacing).toBe(0.7);
    expect(d.threadVectorDistance).toBe(10.0);
    expect(d.threadAmplitudeY).toBe(4.9);
    expect(d.threadWidth).toBe(0.1);
    expect(d.threadThickness).toBe(0.01);
  });

  it('applies captured COMPARE|ANALYSIS|POINTS preset', () => {
    const d = resolveSpatialDefaults({
      workspaceMode: 'COMPARE',
      viewMode: 'ANALYSIS',
      renderMode: 'POINTS',
    });
    expect(d.threadSpacing).toBe(1.45);
    expect(d.threadVectorDistance).toBe(1.0);
    expect(d.threadAmplitudeY).toBe(1.0);
    expect(d.threadWidth).toBe(0.2);
    expect(d.threadThickness).toBe(0.01);
  });

  it('applies captured COMPARE|NAVIGATION|RIBBONS preset', () => {
    const d = resolveSpatialDefaults({
      workspaceMode: 'COMPARE',
      viewMode: 'NAVIGATION',
      renderMode: 'RIBBONS',
    });
    expect(d.threadSpacing).toBe(1.55);
    expect(d.threadVectorDistance).toBe(10.0);
    expect(d.threadAmplitudeY).toBe(7.0);
    expect(d.threadWidth).toBe(0.057);
    expect(d.threadThickness).toBe(0.05);
  });
});
