import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RENDER_MODE,
  DEFAULT_VIEW_MODE,
  DEFAULT_WORKSPACE_MODE,
} from '../src/ui/appViewDefaults.js';
import { resolveCameraPose, VIEW_CAMERA_FALLBACKS } from '../src/engine/cameraViewDefaults.js';
import { resolveSpatialDefaults, SPATIAL_DEFAULT_OVERRIDES } from '../src/ui/spatialSliderDefaults.js';

describe('startup chrome defaults', () => {
  it('is ARITHMETIC | ANALYSIS | POINTS', () => {
    expect(DEFAULT_WORKSPACE_MODE).toBe('ARITHMETIC');
    expect(DEFAULT_VIEW_MODE).toBe('ANALYSIS');
    expect(DEFAULT_RENDER_MODE).toBe('POINTS');
  });

  it('resolveCameraPose with empty ctx uses ANALYSIS framing', () => {
    const pose = resolveCameraPose({});
    expect(pose.position).toEqual(VIEW_CAMERA_FALLBACKS.ANALYSIS.position);
  });

  it('resolveSpatialDefaults with empty ctx applies ARITHMETIC|ANALYSIS|POINTS override', () => {
    const spatial = resolveSpatialDefaults({});
    const expected = SPATIAL_DEFAULT_OVERRIDES['ARITHMETIC|ANALYSIS|POINTS'];
    expect(spatial.threadAmplitudeY).toBe(expected.threadAmplitudeY);
    expect(spatial.threadThickness).toBe(expected.threadThickness);
  });
});
