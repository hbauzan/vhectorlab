import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { MeshFactory } from '../src/visualizer/MeshFactory.js';
import { Instancer } from '../src/visualizer/Instancer.js';

describe('MeshFactory wide ribbons + base plane', () => {
  it('createWideRibbonMesh builds a Mesh strip (not Line)', () => {
    const pts = Array.from({ length: 10 }, (_, i) => new THREE.Vector3(i, Math.sin(i), 0));
    const acts = pts.map((_, i) => Math.sin(i));
    const mesh = MeshFactory.createWideRibbonMesh(pts, acts, { width: 4 });
    expect(mesh).not.toBeNull();
    expect(mesh.isMesh).toBe(true);
    expect(mesh.isLine).toBeFalsy();
    expect(mesh.frustumCulled).toBe(false);
    expect(mesh.userData.kind).toBe('wideRibbon');
    expect(mesh.geometry.getAttribute('position').count).toBe(20);
  });

  it('createBasePlane is a horizontal translucent mesh', () => {
    const plane = MeshFactory.createBasePlane({ width: 100, depth: 50, y: -20 });
    expect(plane.userData.kind).toBe('basePlane');
    expect(plane.position.y).toBe(-20);
    expect(plane.frustumCulled).toBe(false);
  });
});

describe('Instancer RIBBONS mode', () => {
  let instancer;

  beforeEach(() => {
    instancer = new Instancer(new THREE.Scene());
  });

  function arithmeticFixture() {
    const dim = 10;
    const mk = (s) => Array.from({ length: dim }, (_, i) => Math.sin(i * 0.4) * s);
    return {
      word_a: 'a', word_b: 'b', word_c: 'c',
      vector_res: mk(1),
      components: { vec_a: mk(0.7), vec_b: mk(-0.4), vec_c: mk(0.3), vec_top1: mk(0.8) },
      results: [{ word: 'x', score: 0.8 }],
      top1_word: 'x',
    };
  }

  it('RIBBONS ≠ MESH ≠ POINTS: wide ribbons + base plane, no Points', () => {
    instancer.renderArithmeticData(arithmeticFixture(), 'RIBBONS', {
      threadThickness: 0.4,
      threadSpacing: 0.4,
      threadWidth: 0.2,
      threadAmplitudeY: 16,
    }, 'NAVIGATION');

    const kids = instancer.activeGroup.children;
    const wide = kids.filter((c) => c.userData?.kind === 'wideRibbon');
    const plane = kids.filter((c) => c.userData?.kind === 'basePlane');
    const surface = kids.filter((c) => c.userData?.kind === 'surface');
    const points = kids.filter((c) => c.isPoints);

    expect(wide.length).toBeGreaterThanOrEqual(3);
    expect(plane.length).toBe(1);
    expect(surface.length).toBe(0);
    expect(points.length).toBe(0);
  });

  it('MESH still has surface without base plane / wide ribbons', () => {
    instancer.renderArithmeticData(arithmeticFixture(), 'MESH', null, 'ANALYSIS');
    const kids = instancer.activeGroup.children;
    expect(kids.some((c) => c.userData?.kind === 'surface')).toBe(true);
    expect(kids.some((c) => c.userData?.kind === 'wideRibbon')).toBe(false);
    expect(kids.some((c) => c.userData?.kind === 'basePlane')).toBe(false);
  });
});
