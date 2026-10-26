import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { MeshFactory } from '../src/visualizer/MeshFactory.js';
import { Instancer } from '../src/visualizer/Instancer.js';
import {
  divergentVertexShader,
  softStarVertexShader,
  createDivergentMaterial,
  updateDivergentMaterialUniforms,
} from '../src/visualizer/DivergentShading.js';
import {
  calculateVectorNoiseRatio,
  formatNoiseRatio,
  resolveHoverTelemetry,
} from '../src/ui/hoverTelemetry.js';
import { HUD } from '../src/ui/HUD.js';

const SHIELD_BRANCH = 'if (uShieldEnabled > 0.5 && aNoiseMask < 0.5) pos.y = aBaselineY;';

function makeEl(tagName = 'div') {
  const classes = new Set();
  const el = {
    tagName: String(tagName).toUpperCase(),
    id: '',
    className: '',
    textContent: '',
    title: '',
    style: {},
    children: [],
    attrs: {},
    clientWidth: 0,
    offsetWidth: 0,
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    setAttribute(key, value) {
      this.attrs[key] = String(value);
      if (key === 'id') this.id = String(value);
      if (key === 'title') this.title = String(value);
    },
    removeAttribute(key) {
      delete this.attrs[key];
      if (key === 'title') this.title = '';
    },
    querySelector(selector) {
      return findDescendant(this, selector);
    },
  };
  el.classList = {
    add(cls) {
      classes.add(cls);
      el.className = Array.from(classes).join(' ');
    },
    remove(cls) {
      classes.delete(cls);
      el.className = Array.from(classes).join(' ');
    },
    contains(cls) {
      return classes.has(cls);
    },
  };
  Object.defineProperty(el, 'innerHTML', {
    set(html) {
      el.children.length = 0;
      if (!html) return;
      for (const child of parseFragment(String(html))) el.appendChild(child);
    },
  });
  return el;
}

function findDescendant(root, selector) {
  const id = selector.startsWith('#') ? selector.slice(1) : null;
  const cls = selector.startsWith('.') ? selector.slice(1) : null;
  const walk = (node) => {
    if (id && node.id === id) return node;
    if (cls && node.classList.contains(cls)) return node;
    for (const child of node.children) {
      const hit = walk(child);
      if (hit) return hit;
    }
    return null;
  };
  for (const child of root.children) {
    const hit = walk(child);
    if (hit) return hit;
  }
  return null;
}

function parseFragment(html) {
  const root = makeEl('fragment');
  const stack = [root];
  const re = /<\/?([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
  let match = re.exec(html);
  while (match) {
    if (match[3] != null) {
      const text = match[3].replace(/\s+/g, ' ').trim();
      if (text) stack[stack.length - 1].textContent = text;
    } else if (match[0].startsWith('</')) {
      if (stack.length > 1) stack.pop();
    } else {
      const node = makeEl(match[1]);
      const attrRe = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
      let attr = attrRe.exec(match[2]);
      while (attr) {
        if (attr[1] === 'id') node.id = attr[2];
        if (attr[1] === 'class') {
          attr[2].split(/\s+/).filter(Boolean).forEach((cls) => node.classList.add(cls));
        }
        attr = attrRe.exec(match[2]);
      }
      stack[stack.length - 1].appendChild(node);
      stack.push(node);
    }
    match = re.exec(html);
  }
  return root.children;
}

function installDocument() {
  global.document = {
    createElement: (tagName) => makeEl(tagName),
    body: makeEl('body'),
  };
}

function pointsCloud(count, extras = {}) {
  return Array.from({ length: count }, (_, i) => ({
    position: new THREE.Vector3(i, 10 + i, 0),
    activation: i === 10 ? 0.9 : 0.05,
    baselineY: 3.5,
    meta: i === 2 ? { dim: 10 } : undefined,
    ...extras,
  }));
}

function comparePair() {
  const spike = (scale) => {
    const values = new Array(32).fill(0.02);
    values[5] = scale;
    return values;
  };
  return {
    count: 2,
    items: [
      { id: 'tok_0', index: 0, text: 'car', embedding: spike(1) },
      { id: 'tok_1', index: 1, text: 'truck', embedding: spike(1) },
    ],
  };
}

function centerY(mesh, dimIndex) {
  return mesh.geometry.getAttribute('position').getY(dimIndex * 2);
}

describe('shader noise mask', () => {
  it('test_points_geometry_noise_mask_allocation', () => {
    const pointsData = pointsCloud(64);
    const mesh = MeshFactory.createPointsMesh(pointsData, {
      noiseIndices: [10],
      shieldEnabled: true,
    });
    const mask = mesh.geometry.getAttribute('aNoiseMask');
    const baseline = mesh.geometry.getAttribute('aBaselineY');

    expect(mask).toBeTruthy();
    expect(mask.count).toBe(64);
    expect(mask.array.length).toBe(64);
    expect(mask.getX(10)).toBe(0);
    expect(mask.getX(0)).toBe(1);
    expect(mask.getX(11)).toBe(1);
    expect(mask.getX(2)).toBe(0);
    expect(baseline).toBeTruthy();
    expect(baseline.count).toBe(64);
    expect(baseline.getX(0)).toBeCloseTo(3.5, 6);
    expect(baseline.getX(10)).toBeCloseTo(3.5, 6);

    const geometry = mesh.geometry;
    updateDivergentMaterialUniforms(mesh.material, { shieldEnabled: false });
    expect(mesh.geometry).toBe(geometry);
    expect(mesh.geometry.getAttribute('aNoiseMask')).toBe(mask);
    expect(mesh.material.uniforms.uShieldEnabled.value).toBe(0);
  });

  it('test_divergent_shader_flattens_noise_amplitude', () => {
    for (const source of [divergentVertexShader, softStarVertexShader]) {
      expect(source).toContain('attribute float aNoiseMask;');
      expect(source).toContain('attribute float aBaselineY;');
      expect(source).toContain('uniform float uShieldEnabled;');
      expect(source).toContain(SHIELD_BRANCH);
    }

    const material = createDivergentMaterial(12, 0.7, { shieldEnabled: false });
    const uniforms = material.uniforms;
    const vertexShader = material.vertexShader;
    expect(material.uniforms.uShieldEnabled.value).toBe(0);

    updateDivergentMaterialUniforms(material, { shieldEnabled: true });
    expect(material.uniforms).toBe(uniforms);
    expect(material.vertexShader).toBe(vertexShader);
    expect(material.uniforms.uShieldEnabled.value).toBe(1);

    updateDivergentMaterialUniforms(material, { shieldEnabled: false });
    expect(material.uniforms.uShieldEnabled.value).toBe(0);
    expect(material.vertexShader).toBe(vertexShader);
  });

  it('test_dual_path_ribbon_mounting_in_compare', () => {
    const instancer = new Instancer(new THREE.Scene());
    const response = comparePair();
    const expectedY = instancer.layoutEngine.mapVectorTo3DPoints(
      response.items[0].embedding,
      0,
      'NAVIGATION',
      2,
      46,
      16,
    )[5].y;

    instancer.renderCompareData(response, 'RIBBONS', null, 'NAVIGATION', null, {
      noiseShieldEnabled: true,
      dualPathEnabled: true,
      noiseIndices: [5],
    });

    const mounted = instancer.activeGroup.children;
    const primary = mounted.filter((child) => child.userData?.kind === 'wideRibbon');
    const ghosts = mounted.filter((child) => child.userData?.kind === 'dualPathGhostRibbon');
    expect(primary.length).toBe(2);
    expect(ghosts.length).toBe(2);
    for (const mesh of primary) {
      expect(centerY(mesh, 5)).toBeCloseTo(0, 4);
    }
    for (const mesh of ghosts) {
      expect(centerY(mesh, 5)).toBeCloseTo(expectedY, 4);
      expect(Math.abs(expectedY)).toBeGreaterThan(1);
      expect(mesh.material.opacity).toBeCloseTo(0.28, 6);
      expect(mesh.material.transparent).toBe(true);
      expect(mesh.material.depthWrite).toBe(false);
      expect(mesh.material.vertexColors).toBe(false);
      expect(mesh.material.color.getHexString()).toBe('ffa997');
      expect(mesh.frustumCulled).toBe(false);
    }

    instancer.renderCompareData(response, 'RIBBONS', null, 'NAVIGATION', null, {
      noiseShieldEnabled: true,
      dualPathEnabled: false,
      noiseIndices: [5],
    });
    const shielded = instancer.activeGroup.children;
    expect(shielded.some((child) => child.userData?.kind === 'dualPathGhostRibbon')).toBe(false);
    const flatPrimary = shielded.filter((child) => child.userData?.kind === 'wideRibbon');
    expect(flatPrimary.length).toBe(2);
    for (const mesh of flatPrimary) {
      expect(centerY(mesh, 5)).toBeCloseTo(0, 4);
    }

    instancer.renderCompareData(response, 'RIBBONS', null, 'NAVIGATION', null, {
      noiseShieldEnabled: false,
      dualPathEnabled: true,
      noiseIndices: [5],
    });
    const rawKids = instancer.activeGroup.children;
    expect(rawKids.some((child) => child.userData?.kind === 'dualPathGhostRibbon')).toBe(false);
    const rawPrimary = rawKids.filter((child) => child.userData?.kind === 'wideRibbon');
    expect(rawPrimary.length).toBe(2);
    for (const mesh of rawPrimary) {
      expect(centerY(mesh, 5)).toBeCloseTo(expectedY, 4);
    }
  });

  it('flattens ANALYSIS noise coordinates onto the thread baseline and keeps the raw spike in the point buffer', () => {
    const instancer = new Instancer(new THREE.Scene());
    const response = comparePair();
    instancer.renderCompareData(response, 'POINTS', null, 'ANALYSIS', null, {
      noiseShieldEnabled: true,
      dualPathEnabled: true,
      noiseIndices: [5],
    });

    const threads = instancer.compareRuntime.threads;
    expect(threads).toHaveLength(2);
    const baselines = threads.map((thread) => thread._layoutPoints[5].y);
    expect(Math.abs(baselines[0])).toBeGreaterThan(1);
    expect(Math.abs(baselines[0] - baselines[1])).toBeGreaterThan(1);

    const ghosts = instancer.activeGroup.children.filter((child) => child.userData?.kind === 'dualPathGhostRibbon');
    expect(ghosts).toHaveLength(2);
    ghosts.forEach((mesh, index) => {
      expect(Math.abs(centerY(mesh, 5) - baselines[index])).toBeGreaterThan(1);
    });

    const points = instancer.compareRuntime.pointsMesh;
    const mask = points.geometry.getAttribute('aNoiseMask');
    const baseline = points.geometry.getAttribute('aBaselineY');
    const position = points.geometry.getAttribute('position');
    expect(mask.getX(5)).toBe(0);
    expect(mask.getX(0)).toBe(1);
    expect(mask.getX(32 + 5)).toBe(0);
    expect(baseline.getX(5)).toBeCloseTo(baselines[0], 4);
    expect(baseline.getX(32 + 5)).toBeCloseTo(baselines[1], 4);
    expect(Math.abs(position.getY(5) - baseline.getX(5))).toBeGreaterThan(1);
    expect(points.material.uniforms.uShieldEnabled.value).toBe(1);

    const geometry = points.geometry;
    updateDivergentMaterialUniforms(points.material, { shieldEnabled: false });
    expect(points.geometry).toBe(geometry);
    expect(points.material.uniforms.uShieldEnabled.value).toBe(0);
    expect(position.getY(5)).toBeCloseTo(geometry.getAttribute('position').getY(5), 6);
  });

  it('test_hover_telemetry_noise_ratio_calculation', () => {
    const vec = new Array(16).fill(0);
    vec[10] = Math.sqrt(0.6);
    vec[2] = Math.sqrt(0.4);
    const ratio = calculateVectorNoiseRatio(vec, [10]);
    expect(Math.abs(ratio - 0.6)).toBeLessThanOrEqual(0.01);
    expect(formatNoiseRatio(ratio)).toBe('60.0%');

    expect(calculateVectorNoiseRatio([], [10])).toBe(0);
    expect(calculateVectorNoiseRatio([1, 2, 3], [])).toBe(0);
    expect(calculateVectorNoiseRatio([1, 2, 3], null)).toBe(0);
    expect(calculateVectorNoiseRatio([0, 0, 0], [1])).toBe(0);
    expect(formatNoiseRatio(Number.NaN)).toBe('--');
    expect(formatNoiseRatio(0)).toBe('0.0%');

    const ribbonVec = new Array(32).fill(0);
    ribbonVec[5] = 3;
    ribbonVec[1] = 4;
    const fromRibbon = resolveHoverTelemetry({
      index: 0,
      face: { a: 10, b: 11, c: 12 },
      userData: {
        kind: 'wideRibbon',
        activations: ribbonVec,
        sourceDims: Array.from({ length: 32 }, (_, i) => i),
        noiseIndices: [5],
        token: 'car',
        type: 'compare',
      },
    });
    expect(fromRibbon.noiseRatio).toBeCloseTo(0.36, 6);
    expect(fromRibbon.dim).toBe(5);
    expect(fromRibbon.isNoiseDim).toBe(true);
    expect(formatNoiseRatio(fromRibbon.noiseRatio)).toBe('36.0%');
  });

  describe('HUD noise readout', () => {
    beforeEach(() => {
      installDocument();
    });

    it('test_hud_renders_noise_percentage', () => {
      const root = document.createElement('div');
      const hud = new HUD(root);
      const noise = hud.element.querySelector('#hud-noise');
      expect(noise).not.toBeNull();
      expect(noise.textContent).toBe('NOISE: --');

      hud.updateTelemetry({
        point: { x: 0, y: 0, z: 0 },
        userData: {
          pointsData: [{
            activation: 0.28,
            meta: { dim: 386, noiseRatio: 0.198, isNoiseDim: true },
          }],
        },
        index: 0,
      });
      expect(hud.element.querySelector('#hud-noise').textContent).toBe('NOISE: 19.8%');
      expect(noise.classList.contains('is-rogue-dim')).toBe(true);
      expect(noise.title).toBe('Rogue structural noise dimension (Outlier Shield)');

      hud.updateTelemetry({
        point: { x: 1, y: 0, z: 0 },
        userData: {
          pointsData: [{
            activation: 0.02,
            meta: { dim: 3, noiseRatio: 0.247, isNoiseDim: false },
          }],
        },
        index: 0,
      });
      expect(noise.textContent).toBe('NOISE: 24.7%');
      expect(noise.classList.contains('is-rogue-dim')).toBe(false);
      expect(noise.title).toBe('Instantaneous token noise energy ratio');

      hud.updateTelemetry(null);
      expect(noise.textContent).toBe('NOISE: --');
      expect(noise.classList.contains('is-rogue-dim')).toBe(false);
    });
  });
});
