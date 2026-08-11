import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { MeshFactory } from '../src/visualizer/MeshFactory.js';
import { Instancer } from '../src/visualizer/Instancer.js';
import { buildDimRulerSegments } from '../src/visualizer/dimRuler.js';

describe('MeshFactory dim ruler', () => {
  it('createDimRulerMesh returns LineSegments like token continuity threads', () => {
    const threads = [
      [{ x: 0, y: 10, z: 0 }, { x: 10, y: 12, z: 0 }],
      [{ x: 0, y: 4, z: 0 }, { x: 10, y: 6, z: 0 }],
    ];
    const segs = buildDimRulerSegments(threads, 2, 'path');
    const mesh = MeshFactory.createDimRulerMesh(segs, {
      color: '#FFFFFF',
      thickness: 4,
    });
    expect(mesh).toBeTruthy();
    expect(mesh.isLineSegments).toBe(true);
    expect(mesh.name).toBe('DimRuler');
    expect(mesh.userData.kind).toBe('dimRuler');
    expect(mesh.frustumCulled).toBe(false);
    expect(mesh.material).toBeTruthy();
    expect(mesh.material.type).toBe('LineBasicMaterial');
    MeshFactory.disposeDimRulerMesh(mesh);
  });

  it('createDimRulerMesh returns null for empty segments', () => {
    expect(MeshFactory.createDimRulerMesh([])).toBeNull();
    expect(MeshFactory.createDimRulerMesh(null)).toBeNull();
  });
});

describe('Instancer dim ruler', () => {
  /** @type {Instancer} */
  let instancer;

  beforeEach(() => {
    instancer = new Instancer(new THREE.Scene());
  });

  function compareFixture(dim = 8) {
    const mk = (s) => Array.from({ length: dim }, (_, i) => Math.sin(i * 0.5) * s);
    return {
      items: [
        { id: 'a', text: 'alpha', embedding: mk(1.2), index: 0 },
        { id: 'b', text: 'beta', embedding: mk(0.6), index: 1 },
      ],
    };
  }

  it('mounts ruler group when rulerLineCount > 0 (path across tokens)', () => {
    instancer.renderCompareData(
      compareFixture(),
      'POINTS',
      { threadSpacing: 0.4, threadThickness: 0.3, vectorDistance: 0.5, amplitude: 1 },
      'ANALYSIS',
      { rulerLineCount: 3, rulerColor: '#FF0000', rulerThickness: 5, rulerLinkMode: 'path' },
    );
    const rulers = [];
    instancer.activeGroup.traverse((o) => {
      if (o.userData?.kind === 'dimRuler') rulers.push(o);
    });
    expect(rulers.length).toBe(1);
    expect(instancer.compareRuntime?.rulerMesh).toBeTruthy();
  });

  it('mounts ruler in NAVIGATION with span mode', () => {
    instancer.renderCompareData(
      compareFixture(),
      'POINTS',
      { threadSpacing: 0.4, threadThickness: 0.3, vectorDistance: 0.5, amplitude: 1 },
      'NAVIGATION',
      { rulerLineCount: 2, rulerLinkMode: 'span' },
    );
    expect(instancer.compareRuntime?.rulerMesh).toBeTruthy();
  });

  it('skips ruler when lineCount is 0', () => {
    instancer.renderCompareData(
      compareFixture(),
      'POINTS',
      { threadSpacing: 0.4, threadThickness: 0.3, vectorDistance: 0.5, amplitude: 1 },
      'ANALYSIS',
      { rulerLineCount: 0 },
    );
    expect(instancer.compareRuntime?.rulerMesh).toBeNull();
  });
});
