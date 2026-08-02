import { describe, it, expect } from 'vitest';
import { getDivergentColor, DEFAULT_COLOR_ANCHORS } from '../src/visualizer/DivergentShading.js';

describe('Divergent Shading CPU Algorithm (anchor lerp)', () => {
  const A = DEFAULT_COLOR_ANCHORS;

  it('maps peak positive (+1.0) to +1 anchor', () => {
    const { r, g, b, alpha } = getDivergentColor(1.0, 1.0);
    expect(r).toBeCloseTo(A.positive.r, 5);
    expect(g).toBeCloseTo(A.positive.g, 5);
    expect(b).toBeCloseTo(A.positive.b, 5);
    expect(alpha).toBeCloseTo(1.0, 5);
  });

  it('maps mid positive (+0.5) to midpoint lerp 0↔+1', () => {
    const { r, g, b } = getDivergentColor(0.5, 1.0);
    expect(r).toBeCloseTo((A.zero.r + A.positive.r) / 2, 5);
    expect(g).toBeCloseTo((A.zero.g + A.positive.g) / 2, 5);
    expect(b).toBeCloseTo((A.zero.b + A.positive.b) / 2, 5);
  });

  it('maps zero to zero anchor with minimum opacity (~0.05)', () => {
    const { r, g, b, alpha } = getDivergentColor(0.0, 1.0);
    expect(r).toBeCloseTo(A.zero.r, 5);
    expect(g).toBeCloseTo(A.zero.g, 5);
    expect(b).toBeCloseTo(A.zero.b, 5);
    expect(alpha).toBeCloseTo(0.05, 5);
  });

  it('short-circuits |t| < 0.01 to zero anchor with minimum opacity (~0.05)', () => {
    const { r, g, b, alpha } = getDivergentColor(0.005, 1.0);
    expect(r).toBeCloseTo(A.zero.r, 5);
    expect(g).toBeCloseTo(A.zero.g, 5);
    expect(b).toBeCloseTo(A.zero.b, 5);
    expect(alpha).toBeCloseTo(0.05, 5);
  });

  it('maps mid negative (−0.5) to midpoint lerp 0↔−1', () => {
    const { r, g, b } = getDivergentColor(-0.5, 1.0);
    expect(r).toBeCloseTo((A.zero.r + A.negative.r) / 2, 5);
    expect(g).toBeCloseTo((A.zero.g + A.negative.g) / 2, 5);
    expect(b).toBeCloseTo((A.zero.b + A.negative.b) / 2, 5);
  });

  it('maps peak negative (−1.0) to −1 anchor', () => {
    const { r, g, b, alpha } = getDivergentColor(-1.0, 1.0);
    expect(r).toBeCloseTo(A.negative.r, 5);
    expect(g).toBeCloseTo(A.negative.g, 5);
    expect(b).toBeCloseTo(A.negative.b, 5);
    expect(alpha).toBeCloseTo(1.0, 5);
  });

  it('accepts custom anchors', () => {
    const custom = {
      positive: { r: 1, g: 0, b: 0 },
      zero: { r: 0, g: 1, b: 0 },
      negative: { r: 0, g: 0, b: 1 },
    };
    const pos = getDivergentColor(1, 1, custom);
    expect(pos.r).toBeCloseTo(1, 5);
    expect(pos.g).toBeCloseTo(0, 5);
    const neg = getDivergentColor(-1, 1, custom);
    expect(neg.b).toBeCloseTo(1, 5);
  });

  it('zero coverage expands zero band on both signs', () => {
    const at04 = getDivergentColor(0.4, 1.0, null, 50);
    expect(at04.r).toBeCloseTo(A.zero.r, 5);
    expect(at04.g).toBeCloseTo(A.zero.g, 5);
    const neg04 = getDivergentColor(-0.4, 1.0, null, 50);
    expect(neg04.r).toBeCloseTo(A.zero.r, 5);
    expect(neg04.b).toBeCloseTo(A.zero.b, 5);
  });
});
