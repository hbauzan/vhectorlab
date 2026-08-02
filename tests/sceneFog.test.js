import { describe, it, expect } from 'vitest';
import { SCENE_FOG_DENSITY } from '../src/engine/SceneSetup.js';

describe('scene FogExp2 density', () => {
  it('keeps ribbons readable at COMPARE-scale camera distance (~400)', () => {
    // Fog factor ≈ exp(-density * distance). Old 0.008 @ 400 ≈ 0.04 (near black).
    const factorAt400 = Math.exp(-SCENE_FOG_DENSITY * 400);
    expect(factorAt400).toBeGreaterThan(0.5);
  });

  it('stays softer than the legacy density that blacked out far ribbons', () => {
    expect(SCENE_FOG_DENSITY).toBeLessThan(0.008);
    expect(SCENE_FOG_DENSITY).toBeCloseTo(0.0008, 6);
  });
});
