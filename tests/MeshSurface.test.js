import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { MeshFactory } from '../src/visualizer/MeshFactory.js';
import { Instancer } from '../src/visualizer/Instancer.js';

function makeThread(n = 8, z = 0) {
  const points = [];
  const activations = [];
  for (let i = 0; i < n; i++) {
    points.push(new THREE.Vector3(i, Math.sin(i * 0.5), z));
    activations.push(Math.sin(i * 0.5));
  }
  return { points, activations };
}

describe('MeshFactory.createSurfaceMesh', () => {
  it('builds indexed quad surface from multiple thread rows', () => {
    const mesh = MeshFactory.createSurfaceMesh([
      makeThread(6, 0),
      makeThread(6, 10),
      makeThread(6, 20),
    ]);
    expect(mesh).not.toBeNull();
    expect(mesh.isMesh).toBe(true);
    expect(mesh.frustumCulled).toBe(false);
    expect(mesh.geometry.index).not.toBeNull();
    expect(mesh.geometry.getAttribute('position').count).toBe(18);
    expect(mesh.userData.kind).toBe('surface');
  });

  it('creates a strip for a single thread', () => {
    const mesh = MeshFactory.createSurfaceMesh([makeThread(5, 0)]);
    expect(mesh).not.toBeNull();
    expect(mesh.userData.singleThreadStrip).toBe(true);
    expect(mesh.userData.rowCount).toBe(2);
  });
});

describe('Instancer MESH mode switch', () => {
  let scene;
  let instancer;

  beforeEach(() => {
    scene = new THREE.Scene();
    instancer = new Instancer(scene);
  });

  function arithmeticFixture() {
    const dim = 12;
    const mk = (scale) => Array.from({ length: dim }, (_, i) => Math.sin(i * 0.3) * scale);
    return {
      word_a: 'a', word_b: 'b', word_c: 'c',
      vector_res: mk(1),
      components: { vec_a: mk(0.8), vec_b: mk(-0.5), vec_c: mk(0.4), vec_top1: mk(0.9) },
      results: [{ word: 'x', score: 0.9 }],
      top1_word: 'x',
    };
  }

  it('MESH mounts a surface Mesh and no Points', () => {
    instancer.renderArithmeticData(arithmeticFixture(), 'MESH', {
      threadSpacing: 0.4,
      threadWidth: 0.2,
      threadThickness: 0.3,
      threadAmplitudeY: 16,
      threadVectorDistance: 46,
    }, 'NAVIGATION');

    const meshes = instancer.activeGroup.children.filter((c) => c.isMesh && c.userData?.kind === 'surface');
    const points = instancer.activeGroup.children.filter((c) => c.isPoints);
    expect(meshes.length).toBe(1);
    expect(points.length).toBe(0);
  });

  it('POINTS still mounts Points (regression)', () => {
    instancer.renderArithmeticData(arithmeticFixture(), 'POINTS', null, 'NAVIGATION');
    const points = instancer.activeGroup.children.filter((c) => c.isPoints);
    expect(points.length).toBe(1);
  });

  it('spatial sliders affect surface extent via layout', () => {
    const cfgA = { threadSpacing: 0.2, threadWidth: 0.2, threadThickness: 0.3, threadAmplitudeY: 10, threadVectorDistance: 40 };
    const cfgB = { threadSpacing: 1.5, threadWidth: 0.8, threadThickness: 0.3, threadAmplitudeY: 40, threadVectorDistance: 40 };

    instancer.renderArithmeticData(arithmeticFixture(), 'MESH', cfgA, 'NAVIGATION');
    const posA = instancer.activeGroup.children.find((c) => c.userData?.kind === 'surface')
      .geometry.getAttribute('position').array.slice(0, 3);

    instancer.renderArithmeticData(arithmeticFixture(), 'MESH', cfgB, 'NAVIGATION');
    const posB = instancer.activeGroup.children.find((c) => c.userData?.kind === 'surface')
      .geometry.getAttribute('position').array.slice(0, 9);

    // scaleX change should move some vertex X away from cfgA
    expect(posB[0] !== posA[0] || posB[3] !== posA[0]).toBe(true);
  });
});
