import { describe, expect, it } from 'vitest';
import { resolveSpatialDefaults } from '../src/ui/spatialSliderDefaults.js';
import {
  canvasStartupContext,
  mergeSpatialConfig,
} from '../src/v25/canvasHost.js';

describe('v25 spatial wire', () => {
  it('startup spatial defaults use ANALYSIS amplitude override', () => {
    const spatial = resolveSpatialDefaults(canvasStartupContext());
    expect(spatial.threadAmplitudeY).toBe(40);
    expect(spatial.threadThickness).toBe(0.05);
    expect(spatial.threadSpacing).toBe(0.4);
  });

  it('mergeSpatialConfig patches known keys and keeps Y alias', () => {
    const base = resolveSpatialDefaults(canvasStartupContext());
    const next = mergeSpatialConfig(base, {
      threadVectorDistance: 12.5,
      threadAmplitudeY: 20,
      ignoreMe: 1,
    });
    expect(next.threadVectorDistance).toBe(12.5);
    expect(next.threadSpacingY).toBe(12.5);
    expect(next.threadAmplitudeY).toBe(20);
    expect(next.threadSpacing).toBe(base.threadSpacing);
    expect(next).not.toHaveProperty('ignoreMe');
    // Immutable relative to input
    expect(base.threadVectorDistance).toBe(10);
  });

  it('mergeSpatialConfig no-ops empty patch', () => {
    const base = resolveSpatialDefaults(canvasStartupContext());
    expect(mergeSpatialConfig(base, null)).toEqual(base);
    expect(mergeSpatialConfig(base, {})).toEqual(base);
  });
});
