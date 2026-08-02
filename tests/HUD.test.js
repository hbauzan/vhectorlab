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
