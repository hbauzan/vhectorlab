import { describe, it, expect } from 'vitest';
import { normalizeRenderMode, AppState } from '../src/core/State.js';

describe('normalizeRenderMode', () => {
  it('keeps POINTS and RIBBONS', () => {
    expect(normalizeRenderMode('POINTS')).toBe('POINTS');
    expect(normalizeRenderMode('RIBBONS')).toBe('RIBBONS');
  });

  it('falls retired MESH and unknown values back to POINTS', () => {
    expect(normalizeRenderMode('MESH')).toBe('POINTS');
    expect(normalizeRenderMode('')).toBe('POINTS');
    expect(normalizeRenderMode(undefined)).toBe('POINTS');
    expect(normalizeRenderMode('wireframe')).toBe('POINTS');
  });

  it('AppState.setRenderMode normalizes', () => {
    const s = new AppState();
    s.setRenderMode('MESH');
    expect(s.renderMode).toBe('POINTS');
    s.setRenderMode('RIBBONS');
    expect(s.renderMode).toBe('RIBBONS');
  });
});
