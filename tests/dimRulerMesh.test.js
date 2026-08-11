import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { MeshFactory } from '../src/visualizer/MeshFactory.js';
import { Instancer } from '../src/visualizer/Instancer.js';
import { buildDimRulerSegments } from '../src/visualizer/dimRuler.js';
import {
  visualizationControlsMarkup,
  syncDimRulerControlsFromConfig,
} from '../src/ui/VisualizationControls.js';
import {
  DEFAULT_VISUALIZATION_SETTINGS,
  resolveVisualizationSettings,
} from '../src/ui/visualizationControlsDefaults.js';

describe('MeshFactory dim ruler', () => {
  it('path mode returns a group with line + joint points', () => {
    const threads = [
      [{ x: 0, y: 10, z: 0 }, { x: 10, y: 12, z: 0 }],
      [{ x: 0, y: 4, z: 0 }, { x: 10, y: 6, z: 0 }],
    ];
    const segs = buildDimRulerSegments(threads, 2, 'path');
    const joints = [
      { x: 0, y: 10, z: 0 },
      { x: 0, y: 4, z: 0 },
      { x: 10, y: 12, z: 0 },
      { x: 10, y: 6, z: 0 },
    ];
    const mesh = MeshFactory.createDimRulerMesh(segs, {
      color: '#FFFFFF',
      thickness: 4,
      linkMode: 'path',
      joints,
    });
    expect(mesh).toBeTruthy();
    expect(mesh.isGroup).toBe(true);
    expect(mesh.userData.kind).toBe('dimRuler');
    expect(mesh.userData.linkMode).toBe('path');
    expect(mesh.children.some((c) => c.isLineSegments)).toBe(true);
    expect(mesh.children.some((c) => c.isPoints)).toBe(true);
    MeshFactory.disposeDimRulerMesh(mesh);
  });

  it('span mode returns bare LineSegments (no joint dots)', () => {
    const threads = [
      [{ x: 0, y: 10, z: 0 }],
      [{ x: 0, y: 4, z: 0 }],
      [{ x: 0, y: 1, z: 0 }],
    ];
    const segs = buildDimRulerSegments(threads, 1, 'span');
    expect(segs).toHaveLength(1);
    const mesh = MeshFactory.createDimRulerMesh(segs, {
      color: '#FFFFFF',
      linkMode: 'span',
    });
    expect(mesh.isLineSegments).toBe(true);
    expect(mesh.userData.linkMode).toBe('span');
    MeshFactory.disposeDimRulerMesh(mesh);
  });

  it('createDimRulerMesh returns null for empty segments', () => {
    expect(MeshFactory.createDimRulerMesh([])).toBeNull();
    expect(MeshFactory.createDimRulerMesh(null)).toBeNull();
  });
});

describe('Instancer dim ruler link modes', () => {
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

  it('path mode mounts joint markers; span does not', () => {
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
      { rulerLineCount: 2, rulerLinkMode: 'path' },
    );
    let pathJoints = 0;
    instancer.activeGroup.traverse((o) => {
      if (o.userData?.kind === 'dimRulerJoints') pathJoints += 1;
    });
    expect(pathJoints).toBe(1);

    instancer.renderCompareData(
      compareFixture(),
      'POINTS',
      spatial,
      'ANALYSIS',
      { rulerLineCount: 2, rulerLinkMode: 'span' },
    );
    let spanJoints = 0;
    instancer.activeGroup.traverse((o) => {
      if (o.userData?.kind === 'dimRulerJoints') spanJoints += 1;
    });
    expect(spanJoints).toBe(0);
    expect(instancer.compareRuntime?.rulerMesh?.userData?.linkMode).toBe('span');
  });
});

describe('Visualization ruler link toggle', () => {
  it('Path/Span buttons update config.rulerLinkMode', () => {
    const config = resolveVisualizationSettings({
      ...DEFAULT_VISUALIZATION_SETTINGS,
      rulerLinkMode: 'path',
    });
    const host = {
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      classList: { contains: () => false, toggle: () => {} },
      dataset: {},
    };
    // Lightweight DOM via markup + manual button dispatch isn't available in node;
    // assert markup + sync contract instead.
    const html = visualizationControlsMarkup(config);
    expect(html).toContain('id="viz-ruler-link-path"');
    expect(html).toContain('id="viz-ruler-link-span"');
    expect(html).toContain('aria-pressed="true"'); // path default
    expect(html).toMatch(/viz-ruler-link-path[^>]*aria-pressed="true"/);
    expect(html).toMatch(/viz-ruler-link-span[^>]*aria-pressed="false"/);

    const spanHtml = visualizationControlsMarkup({
      ...config,
      rulerLinkMode: 'span',
    });
    expect(spanHtml).toMatch(/viz-ruler-link-span[^>]*aria-pressed="true"/);
    expect(spanHtml).toMatch(/viz-ruler-link-path[^>]*aria-pressed="false"/);
  });

  it('syncDimRulerControlsFromConfig mirrors link mode onto buttons', () => {
    const buttons = {
      path: { setAttribute: viSet('path'), attrs: {} },
      span: { setAttribute: viSet('span'), attrs: {} },
    };
    function viSet(key) {
      return (name, value) => { buttons[key].attrs[name] = value; };
    }
    const container = {
      dataset: { vizRulerDimCount: '10' },
      querySelector: (sel) => {
        if (sel === '#viz-ruler-link-path') return buttons.path;
        if (sel === '#viz-ruler-link-span') return buttons.span;
        if (sel === '#viz-ruler-swatch') return { value: '' };
        if (sel === '#viz-ruler-hex') return { value: '' };
        if (sel === '#viz-ruler-thickness') return { value: '' };
        if (sel === '#viz-ruler-cursor') return { value: '', min: '', max: '' };
        if (sel === '#viz-ruler-line-count') return { textContent: '' };
        if (sel === '#viz-ruler-dim-total') return { textContent: '' };
        return null;
      },
    };
    const config = resolveVisualizationSettings({ rulerLinkMode: 'span' });
    syncDimRulerControlsFromConfig(container, config, 10);
    expect(buttons.path.attrs['aria-pressed']).toBe('false');
    expect(buttons.span.attrs['aria-pressed']).toBe('true');
  });
});
