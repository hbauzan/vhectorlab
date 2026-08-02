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
  it('setAnalysisView uses captured ARITHMETIC|ANALYSIS|POINTS pose', () => {
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
});
