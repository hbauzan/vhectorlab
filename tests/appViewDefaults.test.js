import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RENDER_MODE,
  DEFAULT_VIEW_MODE,
  DEFAULT_WORKSPACE_MODE,
} from '../src/ui/appViewDefaults.js';
import { GALAXY_VIEW } from '../src/ui/galaxyChrome.js';
import { resolveCameraPose, VIEW_CAMERA_FALLBACKS } from '../src/engine/cameraViewDefaults.js';
import { resolveSpatialDefaults, GLOBAL_SPATIAL_DEFAULTS } from '../src/ui/spatialSliderDefaults.js';

describe('startup chrome defaults', () => {
  it('is COMPARE | GALAXY | POINTS', () => {
    expect(DEFAULT_WORKSPACE_MODE).toBe('COMPARE');
    expect(DEFAULT_VIEW_MODE).toBe(GALAXY_VIEW);
    expect(DEFAULT_RENDER_MODE).toBe('POINTS');
  });

  it('resolveCameraPose with empty ctx uses GALAXY framing', () => {
    const pose = resolveCameraPose({});
    expect(pose.position).toEqual([...VIEW_CAMERA_FALLBACKS.GALAXY.position]);
    expect(pose.rotationDeg[0]).toBeCloseTo(-23.2, 5);
  });

  it('resolveSpatialDefaults with empty ctx uses global defaults (no Galaxy override yet)', () => {
    const spatial = resolveSpatialDefaults({});
    expect(spatial.threadSpacing).toBe(GLOBAL_SPATIAL_DEFAULTS.threadSpacing);
    expect(spatial.threadThickness).toBe(GLOBAL_SPATIAL_DEFAULTS.threadThickness);
  });
});
