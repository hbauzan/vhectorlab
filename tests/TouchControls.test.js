import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { stickToAxes, isUiTouchTarget } from '../src/ui/TouchControls.js';
import { Navigation } from '../src/engine/Navigation.js';

describe('stickToAxes', () => {
  it('maps stick-up to forward (−z) and right to +x', () => {
    const up = stickToAxes(0, -48, 48);
    expect(up.z).toBeCloseTo(1, 5);
    expect(Math.abs(up.x)).toBeLessThan(0.01);

    const right = stickToAxes(48, 0, 48);
    expect(right.x).toBeCloseTo(1, 5);
    expect(Math.abs(right.z)).toBeLessThan(0.01);
  });

  it('clamps magnitude to unit circle', () => {
    const a = stickToAxes(100, 100, 48);
    expect(Math.hypot(a.x, a.z)).toBeCloseTo(1, 5);
  });
});

describe('isUiTouchTarget', () => {
  it('treats dock/hud ancestors as UI', () => {
    const dock = { id: 'left-dock', tagName: 'DIV', closest: (sel) => (sel.includes('#left-dock') ? dock : null) };
    const child = { tagName: 'BUTTON', closest: (sel) => dock.closest(sel) };
    expect(isUiTouchTarget(child)).toBe(true);
  });

  it('treats Visualization sheet as UI', () => {
    const sheet = {
      id: 'visualization-controls-container',
      tagName: 'DIV',
      closest: (sel) => (sel.includes('#visualization-controls-container') ? sheet : null),
    };
    const child = { tagName: 'BUTTON', closest: (sel) => sheet.closest(sel) };
    expect(isUiTouchTarget(child)).toBe(true);
  });

  it('allows bare canvas', () => {
    const canvas = { tagName: 'CANVAS', closest: () => null };
    expect(isUiTouchTarget(canvas)).toBe(false);
  });
});

describe('Navigation touch API', () => {
  let nav;
  let camera;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
    nav = new Navigation(camera, null);
  });

  it('setMoveAxes and setVertical feed update without breaking desktop keys', () => {
    nav.setMoveAxes(0, -1);
    nav.setVertical(1);
    expect(nav.touchAxes.z).toBeCloseTo(-1);
    expect(nav.touchVertical).toBe(1);

    const before = camera.position.clone();
    nav.update(0.016);
    expect(camera.position.distanceTo(before)).toBeGreaterThan(0);

    nav.setMoveAxes(0, 0);
    nav.setVertical(0);
    expect(nav.touchAxes.x).toBe(0);
    expect(nav.touchVertical).toBe(0);
  });

  it('applyLookDelta updates euler pitch/yaw clamps', () => {
    nav.applyLookDelta(100, 0);
    expect(nav.euler.y).toBeLessThan(0);
    nav.applyLookDelta(0, 10000);
    expect(nav.euler.x).toBeGreaterThanOrEqual(-Math.PI / 2 + 0.05);
    expect(nav.euler.x).toBeLessThanOrEqual(Math.PI / 2 - 0.05);
  });
});
