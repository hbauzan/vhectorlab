import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Navigation } from '../src/engine/Navigation.js';

function stubCamera() {
  return {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    lookAt() {},
  };
}

describe('Navigation default poses', () => {
  it('setAnalysisView uses ANALYSIS view fallback pose', () => {
    const camera = stubCamera();
    const nav = new Navigation(camera, { addEventListener() {} });
    nav.setAnalysisView();

    expect(nav.camera.position.x).toBeCloseTo(-75.2, 5);
    expect(nav.camera.position.y).toBeCloseTo(-0.8, 5);
    expect(nav.camera.position.z).toBeCloseTo(62.5, 5);
    expect(nav.euler.x).toBeCloseTo(0, 5);
    expect(nav.euler.y).toBeCloseTo(0, 5);
    expect(nav.euler.z).toBeCloseTo(0, 5);
  });

  it('setNavigationView keeps corridor pose', () => {
    const camera = stubCamera();
    const nav = new Navigation(camera, { addEventListener() {} });
    nav.setNavigationView();

    expect(nav.camera.position.x).toBeCloseTo(-178.3, 5);
    expect(nav.camera.position.y).toBeCloseTo(13.5, 5);
    expect(nav.camera.position.z).toBeCloseTo(52.2, 5);
  });

  it('setContextView applies COMPARE|NAVIGATION|POINTS captured pose', () => {
    const camera = stubCamera();
    const nav = new Navigation(camera, { addEventListener() {} });
    nav.setContextView({
      workspaceMode: 'COMPARE',
      viewMode: 'NAVIGATION',
      renderMode: 'POINTS',
    });

    expect(nav.camera.position.x).toBeCloseTo(-106.5, 5);
    expect(nav.camera.position.y).toBeCloseTo(20.4, 5);
    expect(nav.camera.position.z).toBeCloseTo(390.2, 5);
    const deg2rad = Math.PI / 180;
    expect(nav.euler.x).toBeCloseTo(-3.9 * deg2rad, 5);
    expect(nav.euler.y).toBeCloseTo(-8.4 * deg2rad, 5);
    expect(nav.euler.z).toBeCloseTo(0, 5);
  });

  it('setContextView does not leak COMPARE pose into ARITHMETIC|NAVIGATION', () => {
    const camera = stubCamera();
    const nav = new Navigation(camera, { addEventListener() {} });
    nav.setContextView({
      workspaceMode: 'ARITHMETIC',
      viewMode: 'NAVIGATION',
      renderMode: 'POINTS',
    });

    expect(nav.camera.position.x).toBeCloseTo(-178.3, 5);
    expect(nav.camera.position.y).toBeCloseTo(13.5, 5);
    expect(nav.camera.position.z).toBeCloseTo(52.2, 5);
  });
});
