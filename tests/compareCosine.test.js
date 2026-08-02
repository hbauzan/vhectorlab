import { describe, it, expect } from 'vitest';
import { cosineDot, recomputeCompareAnchorScores, reorderCompareItems } from '../src/ui/compareCosine.js';

describe('compareCosine helpers', () => {
  const makeItems = () => [
    { id: 'tok_0', text: 'a', embedding: [1, 0, 0], cosine_vs_first: 1 },
    { id: 'tok_1', text: 'b', embedding: [0, 1, 0], cosine_vs_first: 0 },
    { id: 'tok_2', text: 'c', embedding: [0.6, 0.8, 0], cosine_vs_first: 0.6 },
  ];

  it('cosineDot is the plain dot product', () => {
    expect(cosineDot([1, 0], [0, 1])).toBe(0);
    expect(cosineDot([0.6, 0.8], [1, 0])).toBeCloseTo(0.6, 9);
  });

  it('recomputeCompareAnchorScores sets REF=1 and scores vs new #1', () => {
    const reordered = [
      { id: 'tok_2', text: 'c', embedding: [0.6, 0.8, 0] },
      { id: 'tok_0', text: 'a', embedding: [1, 0, 0] },
      { id: 'tok_1', text: 'b', embedding: [0, 1, 0] },
    ];
    const result = recomputeCompareAnchorScores(reordered);

    expect(result.anchor).toEqual({ index: 0, text: 'c' });
    expect(result.items[0].cosine_vs_first).toBe(1);
    expect(result.items[1].cosine_vs_first).toBeCloseTo(0.6, 9);
    expect(result.items[2].cosine_vs_first).toBeCloseTo(0.8, 9);
    expect(result.items.map((i) => i.index)).toEqual([0, 1, 2]);
  });

  it('reorderCompareItems ▲/▼ moves row and recalculates anchor scores', () => {
    const up = reorderCompareItems(makeItems(), 1, -1);
    expect(up.items.map((i) => i.text)).toEqual(['b', 'a', 'c']);
    expect(up.anchor.text).toBe('b');
    expect(up.items[0].cosine_vs_first).toBe(1);
    expect(up.items[1].cosine_vs_first).toBeCloseTo(0, 9);

    const down = reorderCompareItems(makeItems(), 0, 1);
    expect(down.items.map((i) => i.text)).toEqual(['b', 'a', 'c']);
    expect(down.anchor.text).toBe('b');
  });

  it('reorderCompareItems ignores out-of-bounds moves', () => {
    expect(reorderCompareItems(makeItems(), 0, -1)).toBeNull();
    expect(reorderCompareItems(makeItems(), 2, 1)).toBeNull();
  });
});
