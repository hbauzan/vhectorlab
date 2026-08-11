import { describe, it, expect } from 'vitest';
import {
  createDimRulerState,
  setDimRulerCursor,
  addDimRulerLine,
  removeDimRulerLine,
  clampDimRulerState,
  computeDimMaxYs,
  buildDimRulerSegments,
} from '../src/visualizer/dimRuler.js';

describe('dimRuler state', () => {
  it('starts at cursor 1 with 0 lines', () => {
    expect(createDimRulerState(768)).toEqual({
      dimCount: 768,
      cursor: 1,
      lineCount: 0,
    });
  });

  it('clamps dimCount and empty data to safe defaults', () => {
    expect(createDimRulerState(0)).toEqual({
      dimCount: 0,
      cursor: 1,
      lineCount: 0,
    });
    expect(clampDimRulerState({ dimCount: -3, cursor: 9, lineCount: 4 })).toEqual({
      dimCount: 0,
      cursor: 1,
      lineCount: 0,
    });
  });

  it('setCursor clamps to [1, dimCount]', () => {
    const s = createDimRulerState(10);
    expect(setDimRulerCursor(s, 50).cursor).toBe(10);
    expect(setDimRulerCursor(s, 0).cursor).toBe(1);
    expect(setDimRulerCursor(s, 4.7).cursor).toBe(5);
    expect(setDimRulerCursor(s, '3').cursor).toBe(3);
    expect(setDimRulerCursor(s, 'nope').cursor).toBe(1);
  });

  it('first + from 0 lines extends to cursor (fill)', () => {
    let s = createDimRulerState(100, { cursor: 1, lineCount: 0 });
    s = addDimRulerLine(s);
    expect(s).toEqual({ dimCount: 100, cursor: 1, lineCount: 1 });
  });

  it('+ with cursor past lineCount fills contiguous prefix', () => {
    let s = createDimRulerState(100, { cursor: 50, lineCount: 10 });
    s = addDimRulerLine(s);
    expect(s.lineCount).toBe(50);
    expect(s.cursor).toBe(50);
  });

  it('+ when cursor already covered extends one more and moves cursor', () => {
    let s = createDimRulerState(100, { cursor: 5, lineCount: 10 });
    s = addDimRulerLine(s);
    expect(s.lineCount).toBe(11);
    expect(s.cursor).toBe(11);
  });

  it('+ at last dim is a no-op for lineCount when already full', () => {
    let s = createDimRulerState(10, { cursor: 10, lineCount: 10 });
    s = addDimRulerLine(s);
    expect(s.lineCount).toBe(10);
    expect(s.cursor).toBe(10);
  });

  it('− at cursor truncates from that dim backward', () => {
    let s = createDimRulerState(100, { cursor: 5, lineCount: 10 });
    s = removeDimRulerLine(s);
    expect(s.lineCount).toBe(4);
    expect(s.cursor).toBe(4);
  });

  it('repeated − walks backward one by one', () => {
    let s = createDimRulerState(100, { cursor: 5, lineCount: 10 });
    s = removeDimRulerLine(s); // → 4
    s = removeDimRulerLine(s); // → 3
    s = removeDimRulerLine(s); // → 2
    expect(s.lineCount).toBe(2);
    expect(s.cursor).toBe(2);
  });

  it('− with cursor past lineCount peels from the end', () => {
    let s = createDimRulerState(100, { cursor: 80, lineCount: 10 });
    s = removeDimRulerLine(s);
    expect(s.lineCount).toBe(9);
    expect(s.cursor).toBe(9);
  });

  it('− at 0 lines is a no-op', () => {
    const s = createDimRulerState(100, { cursor: 1, lineCount: 0 });
    expect(removeDimRulerLine(s)).toEqual(s);
  });

  it('rebind dimCount clamps lineCount and cursor', () => {
    const s = clampDimRulerState({ dimCount: 8, cursor: 40, lineCount: 20 });
    expect(s).toEqual({ dimCount: 8, cursor: 8, lineCount: 8 });
  });
});

describe('dimRuler geometry', () => {
  it('computeDimMaxYs takes per-dim max Y across threads', () => {
    const threads = [
      [{ x: 0, y: 1, z: 0 }, { x: 1, y: 5, z: 0 }, { x: 2, y: 2, z: 0 }],
      [{ x: 0, y: 3, z: 0 }, { x: 1, y: 2, z: 0 }, { x: 2, y: 9, z: 0 }],
    ];
    expect(computeDimMaxYs(threads)).toEqual([3, 5, 9]);
  });

  it('buildDimRulerSegments emits horizontal ticks at each dim max Y', () => {
    const xs = [0, 10, 20, 30];
    const maxYs = [1, 5, 8, 2];
    const segs = buildDimRulerSegments(xs, maxYs, 2);
    // half-step = |10-0|/2 = 5
    expect(segs).toEqual([
      { start: { x: -5, y: 1, z: 0 }, end: { x: 5, y: 1, z: 0 } },
      { start: { x: 5, y: 5, z: 0 }, end: { x: 15, y: 5, z: 0 } },
    ]);
  });

  it('buildDimRulerSegments returns [] when lineCount is 0', () => {
    expect(buildDimRulerSegments([0, 1], [0, 1], 0)).toEqual([]);
  });
});
