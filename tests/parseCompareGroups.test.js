import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  parseCompareInput,
  attachCompareGroupMeta,
  buildGroupLabels,
  mergeCompareOverlayLabels,
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
    expect(merged[0].type).toBe('group');
    expect(merged.length).toBe(5);
  });
});
