import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RENDER_MODE,
  DEFAULT_VIEW_MODE,
  DEFAULT_WORKSPACE_MODE,
} from '../src/ui/appViewDefaults.js';
import { resolveCameraPose, VIEW_CAMERA_FALLBACKS } from '../src/engine/cameraViewDefaults.js';
import { resolveSpatialDefaults } from '../src/ui/spatialSliderDefaults.js';

describe('startup chrome defaults', () => {
  it('is ARITHMETIC | ANALYSIS | POINTS (desktop + mobile)', () => {
    expect(DEFAULT_WORKSPACE_MODE).toBe('ARITHMETIC');
    expect(DEFAULT_VIEW_MODE).toBe('ANALYSIS');
    expect(DEFAULT_RENDER_MODE).toBe('POINTS');
  });

  it('resolveCameraPose with empty ctx uses ANALYSIS framing', () => {
    const pose = resolveCameraPose({});
    expect(pose.position).toEqual([...VIEW_CAMERA_FALLBACKS.ANALYSIS.position]);
    expect(pose.rotationDeg).toEqual([...VIEW_CAMERA_FALLBACKS.ANALYSIS.rotationDeg]);
  });

  it('resolveSpatialDefaults with empty ctx uses ARITHMETIC|ANALYSIS|POINTS override', () => {
    const spatial = resolveSpatialDefaults({});
    expect(spatial.threadSpacing).toBe(0.4);
    expect(spatial.threadAmplitudeY).toBe(40.0);
    expect(spatial.threadThickness).toBe(0.05);
  });
});
