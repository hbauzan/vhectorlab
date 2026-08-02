import { describe, it, expect } from 'vitest';
import {
  countDistinctGroups,
  computeGroupAwareYSlots,
  listDistinctGroupIds,
} from '../src/visualizer/groupStackLayout.js';

describe('groupStackLayout', () => {
  it('counts distinct groupIds', () => {
    expect(countDistinctGroups([])).toBe(0);
    expect(countDistinctGroups([{ groupId: 'G1' }, { groupId: 'G1' }])).toBe(1);
    expect(countDistinctGroups([
      { groupId: 'G1' },
      { groupId: 'G2' },
      { groupId: 'G1' },
    ])).toBe(2);
    expect(listDistinctGroupIds([
      { groupId: 'GROUP_1' },
      { groupId: 'GROUP_2' },
    ])).toEqual(['GROUP_1', 'GROUP_2']);
  });

  it('uses contiguous slots when no group change', () => {
    const items = [{ groupId: 'G1' }, { groupId: 'G1' }, { groupId: 'G1' }];
    expect(computeGroupAwareYSlots(items)).toEqual({ slots: [0, 1, 2], span: 2 });
  });

  it('inserts soft gap (+1 slot) between different groups', () => {
    const items = [
      { groupId: 'G1' },
      { groupId: 'G1' },
      { groupId: 'G2' },
      { groupId: 'G2' },
    ];
    // slots 0,1 | gap | 3,4 → span 4
    expect(computeGroupAwareYSlots(items, { gapSlots: 1 })).toEqual({
      slots: [0, 1, 3, 4],
      span: 4,
    });
  });

  it('skips gap when items lack groupId', () => {
    const items = [{}, {}, {}];
    expect(computeGroupAwareYSlots(items)).toEqual({ slots: [0, 1, 2], span: 2 });
  });

  it('honors gapSlots=0 (no extra separation)', () => {
    const items = [{ groupId: 'A' }, { groupId: 'B' }];
    expect(computeGroupAwareYSlots(items, { gapSlots: 0 })).toEqual({
      slots: [0, 1],
      span: 1,
    });
  });
});
