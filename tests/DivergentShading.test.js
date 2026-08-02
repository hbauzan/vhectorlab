import { describe, it, expect } from 'vitest';
import { getDivergentColor } from '../src/visualizer/DivergentShading.js';

describe('Divergent Shading CPU Algorithm', () => {
  it('maps peak positive (+1.0) to incandescent yellow', () => {
    const { r, g, b, alpha } = getDivergentColor(1.0, 1.0);
    expect(r).toBeCloseTo(1.0, 5);
    expect(g).toBeCloseTo(0.95, 5);
    expect(b).toBe(0.0);
    expect(alpha).toBeCloseTo(1.0, 5);
  });

  it('maps mid positive (+0.5) to orange', () => {
    const { r, g, b } = getDivergentColor(0.5, 1.0);
    expect(r).toBeCloseTo(1.0, 5);
    expect(g).toBeCloseTo(0.5, 5);
    expect(b).toBe(0.0);
  });

  it('maps zero to black with minimum opacity (~0.05)', () => {
    const { r, g, b, alpha } = getDivergentColor(0.0, 1.0);
    expect(r).toBe(0.0);
    expect(g).toBe(0.0);
    expect(b).toBe(0.0);
    expect(alpha).toBeCloseTo(0.05, 5);
  });

  it('short-circuits |t| < 0.01 to black with minimum opacity (~0.05)', () => {
    const { r, g, b, alpha } = getDivergentColor(0.005, 1.0);
    expect(r).toBe(0.0);
    expect(g).toBe(0.0);
    expect(b).toBe(0.0);
    expect(alpha).toBeCloseTo(0.05, 5);
  });

  it('maps mid negative (-0.5) to electric blue', () => {
    const { r, g, b } = getDivergentColor(-0.5, 1.0);
    expect(r).toBeCloseTo(0.0, 5);
    expect(g).toBeCloseTo(0.25, 5);
    expect(b).toBeCloseTo(1.0, 5);
  });

  it('maps peak negative (-1.0) to neon violet', () => {
    const { r, g, b, alpha } = getDivergentColor(-1.0, 1.0);
    expect(r).toBeCloseTo(0.6, 5);
    expect(g).toBeCloseTo(0.0, 5);
    expect(b).toBeCloseTo(0.9, 5);
    expect(alpha).toBeCloseTo(1.0, 5);
  });
});
