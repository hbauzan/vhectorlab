import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { MeshFactory } from '../src/visualizer/MeshFactory.js';
import { Instancer } from '../src/visualizer/Instancer.js';

describe('MeshFactory wide ribbons', () => {
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

  it('createBasePlane helper still builds a horizontal mesh (unused by Instancer)', () => {
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

  it('RIBBONS mounts wide ribbons without base plane or Points', () => {
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
    expect(plane.length).toBe(0);
    expect(surface.length).toBe(0);
    expect(points.length).toBe(0);
  });

  it('legacy MESH falls back to POINTS (no surface mesh)', () => {
    instancer.renderArithmeticData(arithmeticFixture(), 'MESH', null, 'ANALYSIS');
    const kids = instancer.activeGroup.children;
    expect(kids.some((c) => c.userData?.kind === 'surface')).toBe(false);
    expect(kids.some((c) => c.isPoints)).toBe(true);
    expect(instancer.renderMode).toBe('POINTS');
  });

  it('COMPARE RIBBONS mounts wide ribbons without Points cloud', () => {
    const mock = {
      count: 3,
      items: [
        { id: 'tok_0', index: 0, text: 'a', embedding: new Array(16).fill(0.1) },
        { id: 'tok_1', index: 1, text: 'b', embedding: new Array(16).fill(-0.1) },
        { id: 'tok_2', index: 2, text: 'c', embedding: new Array(16).fill(0.05) },
      ],
    };
    instancer.renderCompareData(mock, 'RIBBONS', { threadThickness: 0.05 }, 'NAVIGATION');
    const kids = instancer.activeGroup.children;
    expect(kids.filter((c) => c.userData?.kind === 'wideRibbon').length).toBe(3);
    expect(kids.filter((c) => c.isPoints).length).toBe(0);
    expect(instancer.compareRuntime.pointsMesh).toBeNull();
  });
});
