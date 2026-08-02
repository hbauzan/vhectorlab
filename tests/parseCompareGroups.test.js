import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  parseCompareInput,
  attachCompareGroupMeta,
  buildGroupLabels,
  mergeCompareOverlayLabels,
  enrichLabelsWithGroupMeta,
  splitCompareTokens,
  stripOuterQuotes,
} from '../src/ui/parseCompareGroups.js';

describe('parseCompareInput', () => {
  it('parses flat comma/space lists without group headers', () => {
    const r = parseCompareInput('wheel, engine brake\nclutch');
    expect(r.mode).toBe('flat');
    expect(r.tokens).toEqual(['wheel', 'engine', 'brake', 'clutch']);
    expect(r.tokenMeta.every((m) => m === null)).toBe(true);
    expect(r.groups).toEqual([]);
  });

  it('parses GROUP_name = "…" blocks and concatenates in order', () => {
    const r = parseCompareInput(`
GROUP_1 = "car, truck, van"
GROUP_2 = sophia, isabella, grace
`);
    expect(r.mode).toBe('grouped');
    expect(r.tokens).toEqual(['car', 'truck', 'van', 'sophia', 'isabella', 'grace']);
    expect(r.tokenMeta[0]).toEqual({ groupId: 'GROUP_1', groupLabel: 'GROUP_1' });
    expect(r.tokenMeta[3]).toEqual({ groupId: 'GROUP_2', groupLabel: 'GROUP_2' });
    expect(r.groups.map((g) => g.id)).toEqual(['GROUP_1', 'GROUP_2']);
  });

  it('keeps duplicates across groups', () => {
    const r = parseCompareInput('A = wheel, tire\nB = wheel, brake');
    expect(r.tokens).toEqual(['wheel', 'tire', 'wheel', 'brake']);
  });

  it('puts leading loose tokens into UNGROUPED', () => {
    const r = parseCompareInput('solo\nG1 = a, b');
    expect(r.tokens[0]).toBe('solo');
    expect(r.tokenMeta[0].groupId).toBe('UNGROUPED');
    expect(r.groups[0].id).toBe('UNGROUPED');
  });

  it('respects maxTokens', () => {
    const r = parseCompareInput('G = a b c d e', 3);
    expect(r.tokens).toEqual(['a', 'b', 'c']);
  });
});

describe('splitCompareTokens / stripOuterQuotes', () => {
  it('strips matching outer quotes', () => {
    expect(stripOuterQuotes('"a, b"')).toBe('a, b');
    expect(splitCompareTokens(stripOuterQuotes('"a, b"'))).toEqual(['a', 'b']);
  });
});

describe('attachCompareGroupMeta + buildGroupLabels', () => {
  it('attaches meta by index and builds centroids', () => {
    const meta = [
      { groupId: 'GROUP_1', groupLabel: 'GROUP_1' },
      { groupId: 'GROUP_1', groupLabel: 'GROUP_1' },
      { groupId: 'GROUP_2', groupLabel: 'GROUP_2' },
    ];
    const data = attachCompareGroupMeta({
      count: 3,
      items: [
        { id: 'tok_0', text: 'a', embedding: [1] },
        { id: 'tok_1', text: 'b', embedding: [1] },
        { id: 'tok_2', text: 'c', embedding: [1] },
      ],
    }, meta);

    expect(data.items[0].groupId).toBe('GROUP_1');
    expect(data.items[2].groupLabel).toBe('GROUP_2');

    const tokenLabels = [
      { id: 'tok_0', text: 'a', type: 'compare', groupId: 'GROUP_1', groupLabel: 'GROUP_1', origin3D: new THREE.Vector3(0, 10, 0) },
      { id: 'tok_1', text: 'b', type: 'compare', groupId: 'GROUP_1', groupLabel: 'GROUP_1', origin3D: new THREE.Vector3(0, 0, 0) },
      { id: 'tok_2', text: 'c', type: 'compare', groupId: 'GROUP_2', groupLabel: 'GROUP_2', origin3D: new THREE.Vector3(0, -10, 0) },
    ];
    const groups = buildGroupLabels(tokenLabels);
    expect(groups).toHaveLength(2);
    expect(groups[0].text).toBe('GROUP_1');
    expect(groups[0].origin3D.y).toBeCloseTo(5, 5);
    expect(groups[1].text).toBe('GROUP_2');

    const merged = mergeCompareOverlayLabels(tokenLabels);
    expect(merged).toHaveLength(2);
    expect(merged.every((l) => l.type === 'group')).toBe(true);
    expect(merged.map((l) => l.text)).toEqual(['GROUP_1', 'GROUP_2']);
  });

  it('keeps token labels when no group meta', () => {
    const tokenLabels = [
      { id: 'tok_0', text: 'a', type: 'compare', origin3D: new THREE.Vector3(0, 0, 0) },
    ];
    expect(mergeCompareOverlayLabels(tokenLabels)).toHaveLength(1);
    expect(mergeCompareOverlayLabels(tokenLabels)[0].type).toBe('compare');
  });

  it('enrichLabelsWithGroupMeta recovers ids from compare items', () => {
    const labels = [
      { id: 'tok_0', text: 'car', type: 'compare', origin3D: new THREE.Vector3(0, 1, 0) },
      { id: 'tok_1', text: 'grace', type: 'compare', origin3D: new THREE.Vector3(0, -1, 0) },
    ];
    const items = [
      { id: 'tok_0', groupId: 'GROUP_1', groupLabel: 'GROUP_1' },
      { id: 'tok_1', groupId: 'GROUP_2', groupLabel: 'GROUP_2' },
    ];
    const enriched = enrichLabelsWithGroupMeta(labels, items);
    const merged = mergeCompareOverlayLabels(enriched);
    expect(merged).toHaveLength(2);
    expect(merged.map((l) => l.text)).toEqual(['GROUP_1', 'GROUP_2']);
  });

  it('attachCompareGroupMeta exposes groups summary', () => {
    const meta = [
      { groupId: 'GROUP_1', groupLabel: 'GROUP_1' },
      { groupId: 'GROUP_1', groupLabel: 'GROUP_1' },
      { groupId: 'GROUP_2', groupLabel: 'GROUP_2' },
    ];
    const data = attachCompareGroupMeta({
      count: 3,
      items: [
        { id: 'tok_0', text: 'a' },
        { id: 'tok_1', text: 'b' },
        { id: 'tok_2', text: 'c' },
      ],
    }, meta);
    expect(data.groups).toEqual([
      { id: 'GROUP_1', label: 'GROUP_1', count: 2 },
      { id: 'GROUP_2', label: 'GROUP_2', count: 1 },
    ]);
  });
});

describe('applySaeToCompare preserves group meta', () => {
  it('keeps groupId/groupLabel on every item', async () => {
    const { applySaeToCompare } = await import('../src/core/saeReplace.js');
    const raw = {
      count: 2,
      items: [
        { id: 'tok_0', text: 'a', embedding: [1, 0], groupId: 'GROUP_1', groupLabel: 'GROUP_1' },
        { id: 'tok_1', text: 'b', embedding: [0, 1], groupId: 'GROUP_2', groupLabel: 'GROUP_2' },
      ],
    };
    const next = applySaeToCompare(raw, [
      [1, 0, 0],
      [0, 1, 0],
    ]);
    expect(next.items[0].groupId).toBe('GROUP_1');
    expect(next.items[0].groupLabel).toBe('GROUP_1');
    expect(next.items[1].groupId).toBe('GROUP_2');
    expect(next.items[1].groupLabel).toBe('GROUP_2');
    expect(next.featureSpace).toBe('SAE');
  });
});
