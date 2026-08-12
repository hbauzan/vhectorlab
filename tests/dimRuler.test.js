import { describe, it, expect } from 'vitest';
import {
  createDimRulerState,
  setDimRulerCursor,
  addDimRulerLine,
  removeDimRulerLine,
  clampDimRulerState,
  buildDimRulerSegments,
  buildDimRulerJoints,
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

describe('dimRuler cross-token geometry', () => {
  const threads = [
    [
      { x: 0, y: 10, z: 0 },
      { x: 10, y: 12, z: 0 },
      { x: 20, y: 8, z: 0 },
    ],
    [
      { x: 0, y: 4, z: 0 },
      { x: 10, y: 6, z: 0 },
      { x: 20, y: 2, z: 0 },
    ],
    [
      { x: 0, y: 1, z: 0 },
      { x: 10, y: 3, z: 0 },
      { x: 20, y: 0, z: 0 },
    ],
  ];

  it('links consecutive tokens at each covered dim', () => {
    const segs = buildDimRulerSegments(threads, 2);
    // dim0: t0→t1, t1→t2; dim1: t0→t1, t1→t2
    expect(segs).toEqual([
      { start: { x: 0, y: 10, z: 0 }, end: { x: 0, y: 4, z: 0 } },
      { start: { x: 0, y: 4, z: 0 }, end: { x: 0, y: 1, z: 0 } },
      { start: { x: 10, y: 12, z: 0 }, end: { x: 10, y: 6, z: 0 } },
      { start: { x: 10, y: 6, z: 0 }, end: { x: 10, y: 3, z: 0 } },
    ]);
  });

  it('returns [] when lineCount is 0 or fewer than 2 threads', () => {
    expect(buildDimRulerSegments(threads, 0)).toEqual([]);
    expect(buildDimRulerSegments([threads[0]], 2)).toEqual([]);
  });

  it('works with NAVIGATION-style distinct Z per token', () => {
    const nav = [
      [{ x: 5, y: 2, z: 0 }, { x: 15, y: 3, z: 0 }],
      [{ x: 5, y: 1, z: 10 }, { x: 15, y: 4, z: 10 }],
    ];
    const segs = buildDimRulerSegments(nav, 2);
    expect(segs).toEqual([
      { start: { x: 5, y: 2, z: 0 }, end: { x: 5, y: 1, z: 10 } },
      { start: { x: 15, y: 3, z: 0 }, end: { x: 15, y: 4, z: 10 } },
    ]);
  });

  it('buildDimRulerJoints collects all token points on covered dims', () => {
    const joints = buildDimRulerJoints(threads, 1);
    expect(joints).toEqual([
      { x: 0, y: 10, z: 0 },
      { x: 0, y: 4, z: 0 },
      { x: 0, y: 1, z: 0 },
    ]);
  });
});
