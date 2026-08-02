import { describe, it, expect } from 'vitest';
import {
  hasEnoughGroupsForDimSort,
  computeDimContrastScores,
  computeDimContrastPermutation,
  applyDimPermutation,
  identityPermutation,
} from '../src/visualizer/dimContrastSort.js';

describe('dimContrastSort', () => {
  it('requires ≥2 groups', () => {
    expect(hasEnoughGroupsForDimSort([{ groupId: 'G1', embedding: [1, 0] }])).toBe(false);
    expect(hasEnoughGroupsForDimSort([
      { groupId: 'G1', embedding: [1, 0] },
      { groupId: 'G2', embedding: [0, 1] },
    ])).toBe(true);
  });

  it('scores dims by max pairwise |Δmean|', () => {
    // dim0: G1=1, G2=0 → contrast 1
    // dim1: G1=0, G2=0 → contrast 0
    // dim2: G1=0.5, G2=−0.5 → contrast 1
    const items = [
      { groupId: 'G1', embedding: [1, 0, 0.5] },
      { groupId: 'G1', embedding: [1, 0, 0.5] },
      { groupId: 'G2', embedding: [0, 0, -0.5] },
      { groupId: 'G2', embedding: [0, 0, -0.5] },
    ];
    const scores = computeDimContrastScores(items);
    expect(scores).toHaveLength(3);
    expect(scores[0]).toBeCloseTo(1);
    expect(scores[1]).toBeCloseTo(0);
    expect(scores[2]).toBeCloseTo(1);
  });

  it('permutes high-contrast dims first (stable on ties)', () => {
    const items = [
      { groupId: 'G1', embedding: [1, 0, 2] },
      { groupId: 'G2', embedding: [0, 0, 0] },
    ];
    // contrasts: dim0=1, dim1=0, dim2=2 → order [2, 0, 1]
    expect(computeDimContrastPermutation(items)).toEqual([2, 0, 1]);
  });

  it('applyDimPermutation reorders components', () => {
    expect(applyDimPermutation([10, 20, 30], [2, 0, 1])).toEqual([30, 10, 20]);
    expect(applyDimPermutation([1, 2], null)).toEqual([1, 2]);
    expect(identityPermutation(3)).toEqual([0, 1, 2]);
  });

  it('falls back to identity when <2 groups', () => {
    const items = [{ groupId: 'G1', embedding: [1, 2, 3] }];
    expect(computeDimContrastPermutation(items)).toEqual([0, 1, 2]);
  });
});
