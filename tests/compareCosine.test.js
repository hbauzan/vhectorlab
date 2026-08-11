import { describe, it, expect } from 'vitest';
import {
  cosineDot,
  recomputeCompareAnchorScores,
  reorderCompareItems,
  sortCompareItemsByCosine,
  buildGroupCosineRows,
} from '../src/ui/compareCosine.js';

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

  describe('buildGroupCosineRows (centroid vs first group)', () => {
    it('returns null when fewer than 2 groups (flat / single group stay token list)', () => {
      expect(buildGroupCosineRows(makeItems())).toBeNull();
      expect(buildGroupCosineRows([
        { text: 'a', embedding: [1, 0], groupId: 'only', groupLabel: 'only' },
        { text: 'b', embedding: [0, 1], groupId: 'only', groupLabel: 'only' },
      ])).toBeNull();
      expect(buildGroupCosineRows(null)).toBeNull();
      expect(buildGroupCosineRows([])).toBeNull();
    });

    it('REF = first group in item order; cosine = centroid(L2) vs REF', () => {
      // G1 along +X, G2 along +Y → centroids orthogonal → cosine 0
      const items = [
        { text: 'car', embedding: [1, 0], groupId: 'vehicles', groupLabel: 'vehicles' },
        { text: 'truck', embedding: [1, 0], groupId: 'vehicles', groupLabel: 'vehicles' },
        { text: 'sophia', embedding: [0, 1], groupId: 'women', groupLabel: 'women' },
        { text: 'emma', embedding: [0, 1], groupId: 'women', groupLabel: 'women' },
      ];
      const rows = buildGroupCosineRows(items);
      expect(rows).not.toBeNull();
      expect(rows.anchor).toEqual({ index: 0, text: 'vehicles', groupId: 'vehicles' });
      expect(rows.items).toHaveLength(2);
      expect(rows.items[0]).toMatchObject({
        text: 'vehicles',
        groupId: 'vehicles',
        cosine_vs_first: 1,
        memberCount: 2,
        isGroupRow: true,
      });
      expect(rows.items[1].text).toBe('women');
      expect(rows.items[1].cosine_vs_first).toBeCloseTo(0, 9);
      expect(rows.items[1].memberCount).toBe(2);
    });

    it('mean of L2-normalized members then re-L2 (not raw mean of unnormalized)', () => {
      // Two G1 vectors of different magnitudes along +X; G2 = 45° unit vector
      const items = [
        { text: 'a', embedding: [2, 0], groupId: 'g1', groupLabel: 'g1' },
        { text: 'b', embedding: [4, 0], groupId: 'g1', groupLabel: 'g1' },
        { text: 'c', embedding: [1, 1], groupId: 'g2', groupLabel: 'g2' },
      ];
      const rows = buildGroupCosineRows(items);
      // After L2: G1 centroid = [1,0]; G2 = [1/√2, 1/√2]; cosine = 1/√2
      expect(rows.items[1].cosine_vs_first).toBeCloseTo(Math.SQRT1_2, 5);
    });

    it('preserves first-appearance group order (not alphabetical)', () => {
      const items = [
        { text: 'z', embedding: [0, 1], groupId: 'zebra', groupLabel: 'zebra' },
        { text: 'a', embedding: [1, 0], groupId: 'alpha', groupLabel: 'alpha' },
      ];
      const rows = buildGroupCosineRows(items);
      expect(rows.items.map((r) => r.text)).toEqual(['zebra', 'alpha']);
      expect(rows.anchor.text).toBe('zebra');
    });
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

  it('sortCompareItemsByCosine keeps REF #1 and sorts the rest asc/desc', () => {
    const items = [
      { id: 'tok_0', text: 'a', embedding: [1, 0, 0], cosine_vs_first: 1 },
      { id: 'tok_1', text: 'mid', embedding: [0.5, 0.866, 0], cosine_vs_first: 0.5 },
      { id: 'tok_2', text: 'low', embedding: [0, 1, 0], cosine_vs_first: 0 },
      { id: 'tok_3', text: 'high', embedding: [0.9, 0.435, 0], cosine_vs_first: 0.9 },
    ];

    const desc = sortCompareItemsByCosine(items, 'desc');
    expect(desc.items.map((i) => i.text)).toEqual(['a', 'high', 'mid', 'low']);
    expect(desc.anchor.text).toBe('a');
    expect(desc.items[0].cosine_vs_first).toBe(1);

    const asc = sortCompareItemsByCosine(items, 'asc');
    expect(asc.items.map((i) => i.text)).toEqual(['a', 'low', 'mid', 'high']);
    expect(asc.anchor.text).toBe('a');
  });
});
