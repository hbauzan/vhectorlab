import { describe, it, expect, afterEach } from 'vitest';
import {
  VIEW_CAMERA_FALLBACKS,
  CAMERA_DEFAULT_OVERRIDES,
  resolveCameraPose,
} from '../src/engine/cameraViewDefaults.js';

describe('resolveCameraPose', () => {
  const savedKeys = [];

  afterEach(() => {
    for (const key of savedKeys.splice(0)) {
      delete CAMERA_DEFAULT_OVERRIDES[key];
    }
  });

  function setOverride(key, partial) {
    CAMERA_DEFAULT_OVERRIDES[key] = partial;
    savedKeys.push(key);
  }

  it('falls back to NAVIGATION corridor pose when no overrides exist', () => {
    const pose = resolveCameraPose({
      workspaceMode: 'ARITHMETIC',
      viewMode: 'NAVIGATION',
      renderMode: 'POINTS',
    });
    expect(pose.position).toEqual(VIEW_CAMERA_FALLBACKS.NAVIGATION.position);
    expect(pose.rotationDeg).toEqual(VIEW_CAMERA_FALLBACKS.NAVIGATION.rotationDeg);
  });

  it('falls back to ANALYSIS framing when no overrides exist', () => {
    const pose = resolveCameraPose({
      workspaceMode: 'COMPARE',
      viewMode: 'ANALYSIS',
      renderMode: 'RIBBONS',
    });
    expect(pose.position).toEqual(VIEW_CAMERA_FALLBACKS.ANALYSIS.position);
    expect(pose.rotationDeg).toEqual(VIEW_CAMERA_FALLBACKS.ANALYSIS.rotationDeg);
  });

  it('applies workspace → view → render layers (more specific wins)', () => {
    setOverride('ARITHMETIC', {
      position: [1, 2, 3],
      rotationDeg: [10, 20, 30],
    });
    setOverride('ARITHMETIC|NAVIGATION', {
      rotationDeg: [1, 2, 3],
    });
    setOverride('ARITHMETIC|NAVIGATION|RIBBONS', {
      position: [9, 8, 7],
    });

    const pose = resolveCameraPose({
      workspaceMode: 'ARITHMETIC',
      viewMode: 'NAVIGATION',
      renderMode: 'RIBBONS',
    });
    expect(pose.position).toEqual([9, 8, 7]);
    expect(pose.rotationDeg).toEqual([1, 2, 3]);
  });

  it('does not leak overrides from a different context', () => {
    setOverride('COMPARE|ANALYSIS|RIBBONS', {
      position: [-1, -2, -3],
      rotationDeg: [9, 8, 7],
    });

    const pose = resolveCameraPose({
      workspaceMode: 'ARITHMETIC',
      viewMode: 'NAVIGATION',
      renderMode: 'POINTS',
    });
    expect(pose.position).toEqual(VIEW_CAMERA_FALLBACKS.NAVIGATION.position);
  });

  it('applies captured COMPARE|NAVIGATION|POINTS pose', () => {
    const pose = resolveCameraPose({
      workspaceMode: 'COMPARE',
      viewMode: 'NAVIGATION',
      renderMode: 'POINTS',
    });
    expect(pose.position[0]).toBeCloseTo(-106.5, 5);
    expect(pose.position[1]).toBeCloseTo(20.4, 5);
    expect(pose.position[2]).toBeCloseTo(390.2, 5);
    expect(pose.rotationDeg[0]).toBeCloseTo(-3.9, 5);
    expect(pose.rotationDeg[1]).toBeCloseTo(-8.4, 5);
    expect(pose.rotationDeg[2]).toBeCloseTo(0, 5);
  });

  it('applies captured COMPARE|NAVIGATION|RIBBONS pose', () => {
    const pose = resolveCameraPose({
      workspaceMode: 'COMPARE',
      viewMode: 'NAVIGATION',
      renderMode: 'RIBBONS',
    });
    expect(pose.position[0]).toBeCloseTo(-575.8, 5);
    expect(pose.position[1]).toBeCloseTo(43.8, 5);
    expect(pose.position[2]).toBeCloseTo(237.9, 5);
    expect(pose.rotationDeg[0]).toBeCloseTo(-22.4, 5);
    expect(pose.rotationDeg[1]).toBeCloseTo(-35.7, 5);
    expect(pose.rotationDeg[2]).toBeCloseTo(0, 5);
  });
});
