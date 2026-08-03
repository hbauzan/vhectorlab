import { describe, it, expect } from 'vitest';
import { getTabsScrollState, nextTabsScrollLeft } from '../src/ui/navbarTabsScroll.js';

describe('getTabsScrollState', () => {
  it('reports no overflow when content fits', () => {
    expect(getTabsScrollState(0, 200, 180)).toEqual({
      canPrev: false,
      canNext: false,
      overflow: false,
    });
  });

  it('enables next only at the start of an overflowing strip', () => {
    expect(getTabsScrollState(0, 100, 300)).toEqual({
      canPrev: false,
      canNext: true,
      overflow: true,
    });
  });

  it('enables both arrows in the middle', () => {
    expect(getTabsScrollState(80, 100, 300)).toEqual({
      canPrev: true,
      canNext: true,
      overflow: true,
    });
  });

  it('enables prev only at the end', () => {
    expect(getTabsScrollState(200, 100, 300)).toEqual({
      canPrev: true,
      canNext: false,
      overflow: true,
    });
  });
});

describe('nextTabsScrollLeft', () => {
  it('steps forward and clamps to max', () => {
    expect(nextTabsScrollLeft(0, 100, 300, 1)).toBe(70);
    expect(nextTabsScrollLeft(180, 100, 300, 1)).toBe(200);
  });

  it('steps backward and clamps to zero', () => {
    expect(nextTabsScrollLeft(100, 100, 300, -1)).toBe(30);
    expect(nextTabsScrollLeft(40, 100, 300, -1)).toBe(0);
  });
});
