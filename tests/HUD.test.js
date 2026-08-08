import { describe, it, expect, beforeEach } from 'vitest';
import { HUD } from '../src/ui/HUD.js';

// Lightweight mock for document & DOM elements in Node environment
function createMockElement(tagName = 'div') {
  const children = [];
  const attrs = {};
  const classList = new Set();
  let _className = '';

  const element = {
    tagName: tagName.toUpperCase(),
    children,
    classList: {
      add: (cls) => { classList.add(cls); _className = Array.from(classList).join(' '); },
      remove: (cls) => { classList.delete(cls); _className = Array.from(classList).join(' '); },
      contains: (cls) => classList.has(cls)
    },
    style: {},
    appendChild: (child) => { children.push(child); return child; },
    setAttribute: (k, v) => { attrs[k] = v; },
    querySelector: (selector) => {
      const cleanSel = selector.replace('#', '').replace('.', '');
      for (const child of children) {
        if (child.id === cleanSel || child.classList.contains(cleanSel)) return child;
        const found = child.querySelector ? child.querySelector(selector) : null;
        if (found) return found;
      }
      return null;
    },
    set innerHTML(val) {
      if (val === '') children.length = 0;
    },
    set className(val) {
      _className = val;
      String(val).split(' ').forEach((c) => { if (c) classList.add(c); });
    },
    get className() {
      return _className;
    },
    id: '',
    textContent: ''
  };
  return element;
}

if (typeof global.document === 'undefined') {
  global.document = {
    createElement: (tagName) => createMockElement(tagName),
    body: createMockElement('body')
  };
}

describe('HUD camera pose overlay', () => {
  let root;

  beforeEach(() => {
    root = document.createElement('div');
  });

  it('does not mount CAM POSE overlay when showCamPose is false (default)', () => {
    const hud = new HUD(root);
    expect(hud.showCamPose).toBe(false);
    expect(hud.cameraDebugEl).toBeNull();
    expect(root.querySelector('#camera-pose-debug')).toBeNull();
  });

  it('mounts and updates CAM POSE overlay when showCamPose is true', () => {
    const hud = new HUD(root, { showCamPose: true });
    expect(hud.cameraDebugEl).not.toBeNull();
    expect(root.querySelector('#camera-pose-debug')).not.toBeNull();

    const fakeCamera = { position: { x: -178.3, y: 13.5, z: 52.2 } };
    const fakeEuler = { x: (-5.4 * Math.PI) / 180, y: (-51.5 * Math.PI) / 180, z: 0 };
    hud.updateCameraPose(fakeCamera, fakeEuler);

    expect(hud.camPosEl.textContent).toBe('POS: -178.3, 13.5, 52.2');
    expect(hud.camRotEl.textContent).toBe('ROT: -5.4, -51.5, 0.0');
  });
});

describe('HUD activation telemetry', () => {
  let root;

  beforeEach(() => {
    root = document.createElement('div');
  });

  it('shows real activation from pointsData instead of 0.0000', () => {
    const hud = new HUD(root);
    // Node mock lacks innerHTML parsing — attach real-ish readout nodes
    const center = document.createElement('div');
    center.className = 'hud-center';
    Object.defineProperty(center, 'clientWidth', { get: () => 360 });

    const label = document.createElement('span');
    label.className = 'hud-label';
    Object.defineProperty(label, 'offsetWidth', { get: () => 100 });

    const segment = document.createElement('span');
    Object.defineProperty(segment, 'offsetWidth', { get: () => 70 });

    const activation = document.createElement('span');
    const dim = document.createElement('span');
    const coords = document.createElement('span');
    const token = document.createElement('span');

    center.appendChild(label);
    center.appendChild(segment);
    center.appendChild(dim);
    center.appendChild(activation);

    hud.centerEl = center;
    hud.segmentEl = segment;
    hud.dimEl = dim;
    hud.activationEl = activation;
    hud.coordsEl = coords;
    hud.tokenEl = token;

    hud.updateTelemetry({
      index: 0,
      point: { x: 5, y: 1, z: 0 },
      userData: {
        pointsData: [{
          activation: 0.0000421,
          meta: { type: 'compare', token: 'alpha', dim: 3, val: 0.0000421 },
        }],
      },
    });

    expect(activation.textContent).not.toMatch(/0\.0000$/);
    expect(activation.textContent).toMatch(/0\.0000421|4\.21e-/i);
    expect(dim.textContent).toBe('DIM: 3');
    expect(token.textContent).toBe('alpha');
    expect(segment.textContent).toBe('COMPARE');
  });

  it('shows group/token when point has groupLabel', () => {
    const hud = new HUD(root);
    hud.activationEl = document.createElement('span');
    hud.dimEl = document.createElement('span');
    hud.coordsEl = document.createElement('span');
    hud.segmentEl = document.createElement('span');
    hud.tokenEl = document.createElement('span');
    hud.activationEl.style = {};
    hud.activationEl.removeAttribute = () => {};
    hud.tokenEl.removeAttribute = () => {};

    hud.updateTelemetry({
      index: 0,
      point: { x: 1, y: 0, z: 0 },
      userData: {
        pointsData: [{
          activation: 0.5,
          meta: {
            type: 'compare',
            token: 'car',
            dim: 1,
            val: 0.5,
            groupId: 'vehicles',
            groupLabel: 'vehicles',
          },
        }],
      },
    });

    expect(hud.tokenEl.textContent).toBe('vehicles/car');
  });

  it('clears to -- when hover leaves', () => {
    const hud = new HUD(root);
    hud.activationEl = document.createElement('span');
    hud.dimEl = document.createElement('span');
    hud.coordsEl = document.createElement('span');
    hud.segmentEl = document.createElement('span');
    hud.tokenEl = document.createElement('span');
    hud.activationEl.style = {};
    hud.activationEl.removeAttribute = () => {};

    hud.updateTelemetry(null);
    expect(hud.activationEl.textContent).toBe('ACTIVATION: --');
    expect(hud.dimEl.textContent).toBe('DIM: --');
    expect(hud.segmentEl.textContent).toBe('NEUTRAL SPACE');
  });
});
