import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { MeshFactory } from '../src/visualizer/MeshFactory.js';
import { Instancer } from '../src/visualizer/Instancer.js';
import { buildDimRulerSegments } from '../src/visualizer/dimRuler.js';
import { visualizationControlsMarkup } from '../src/ui/VisualizationControls.js';
import {
  DEFAULT_VISUALIZATION_SETTINGS,
  resolveVisualizationSettings,
} from '../src/ui/visualizationControlsDefaults.js';

describe('MeshFactory dim ruler', () => {
  it('returns LineSegments only (no joint squares)', () => {
    const threads = [
      [{ x: 0, y: 10, z: 0 }, { x: 10, y: 12, z: 0 }],
      [{ x: 0, y: 4, z: 0 }, { x: 10, y: 6, z: 0 }],
    ];
    const segs = buildDimRulerSegments(threads, 2);
    const mesh = MeshFactory.createDimRulerMesh(segs, {
      color: '#FFFFFF',
      thickness: 4,
    });
    expect(mesh).toBeTruthy();
    expect(mesh.isLineSegments).toBe(true);
    expect(mesh.userData.kind).toBe('dimRuler');
    MeshFactory.disposeDimRulerMesh(mesh);
  });

  it('createDimRulerMesh returns null for empty segments', () => {
    expect(MeshFactory.createDimRulerMesh([])).toBeNull();
    expect(MeshFactory.createDimRulerMesh(null)).toBeNull();
  });
});

describe('Instancer dim ruler path', () => {
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
        { id: 'c', text: 'gamma', embedding: mk(-0.4), index: 2 },
      ],
    };
  }

  it('mounts LineSegments ruler without joint Points', () => {
    const spatial = {
      threadSpacing: 0.4,
      threadThickness: 0.3,
      vectorDistance: 0.5,
      amplitude: 1,
    };
    instancer.renderCompareData(
      compareFixture(),
      'POINTS',
      spatial,
      'ANALYSIS',
      { rulerPaintedDims: [1, 2], rulerLineCount: 2 },
    );
    let rulers = 0;
    let joints = 0;
    instancer.activeGroup.traverse((o) => {
      if (o.userData?.kind === 'dimRuler') rulers += 1;
      if (o.userData?.kind === 'dimRulerJoints') joints += 1;
    });
    expect(rulers).toBe(1);
    expect(joints).toBe(0);
    expect(instancer.compareRuntime?.rulerMesh?.isLineSegments).toBe(true);
  });
});

describe('Visualization ruler markup', () => {
  it('has ruler controls without Path/Span link toggle', () => {
    const config = resolveVisualizationSettings({
      ...DEFAULT_VISUALIZATION_SETTINGS,
    });
    const html = visualizationControlsMarkup(config);
    expect(html).toContain('id="viz-ruler-plus"');
    expect(html).toContain('id="viz-ruler-minus"');
    expect(html).not.toContain('viz-ruler-link-path');
    expect(html).not.toContain('viz-ruler-link-span');
  });
});
