import { describe, it, expect } from 'vitest';
import {
  createDimRulerState,
  setDimRulerCursor,
  addDimRulerLine,
  removeDimRulerLine,
  clampDimRulerState,
  normalizePaintedDims,
  buildDimRulerSegments,
  buildDimRulerJoints,
} from '../src/visualizer/dimRuler.js';

describe('dimRuler state', () => {
  it('starts at cursor 1 with no painted dims', () => {
    expect(createDimRulerState(768)).toEqual({
      dimCount: 768,
      cursor: 1,
      painted: [],
      lineCount: 0,
    });
  });

  it('clamps dimCount and empty data to safe defaults', () => {
    expect(createDimRulerState(0)).toEqual({
      dimCount: 0,
      cursor: 1,
      painted: [],
      lineCount: 0,
    });
    expect(clampDimRulerState({ dimCount: -3, cursor: 9, painted: [1, 4] })).toEqual({
      dimCount: 0,
      cursor: 1,
      painted: [],
      lineCount: 0,
    });
  });

  it('setCursor clamps to [1, dimCount] without changing painted', () => {
    const s = createDimRulerState(10, { painted: [1, 3] });
    expect(setDimRulerCursor(s, 50).cursor).toBe(10);
    expect(setDimRulerCursor(s, 0).cursor).toBe(1);
    expect(setDimRulerCursor(s, 4.7).cursor).toBe(5);
    expect(setDimRulerCursor(s, '3').cursor).toBe(3);
    expect(setDimRulerCursor(s, 'nope').cursor).toBe(1);
    expect(setDimRulerCursor(s, 78).painted).toEqual([1, 3]);
  });

  it('first + paints at cursor 1 then advances to 2', () => {
    let s = createDimRulerState(100, { cursor: 1, painted: [] });
    s = addDimRulerLine(s);
    expect(s).toEqual({
      dimCount: 100,
      cursor: 2,
      painted: [1],
      lineCount: 1,
    });
  });

  it('+ at jumped cursor paints only that dim and keeps prior paints', () => {
    let s = createDimRulerState(100, { cursor: 1, painted: [] });
    s = addDimRulerLine(s); // paint 1 → cursor 2
    s = setDimRulerCursor(s, 78);
    s = addDimRulerLine(s);
    expect(s.painted).toEqual([1, 78]);
    expect(s.cursor).toBe(79);
    expect(s.lineCount).toBe(2);
  });

  it('repeated + from 78 paints 78, 79, 80…', () => {
    let s = createDimRulerState(100, { cursor: 78, painted: [] });
    s = addDimRulerLine(s);
    s = addDimRulerLine(s);
    s = addDimRulerLine(s);
    expect(s.painted).toEqual([78, 79, 80]);
    expect(s.cursor).toBe(81);
  });

  it('+ on already-painted dim is idempotent then still advances', () => {
    let s = createDimRulerState(100, { cursor: 5, painted: [5] });
    s = addDimRulerLine(s);
    expect(s.painted).toEqual([5]);
    expect(s.cursor).toBe(6);
  });

  it('+ at last dim paints and keeps cursor at dimCount', () => {
    let s = createDimRulerState(10, { cursor: 10, painted: [] });
    s = addDimRulerLine(s);
    expect(s.painted).toEqual([10]);
    expect(s.cursor).toBe(10);
  });

  it('− at cursor erases that dim and retreats', () => {
    let s = createDimRulerState(100, {
      cursor: 5,
      painted: [1, 2, 3, 4, 5, 78],
    });
    s = removeDimRulerLine(s);
    expect(s.painted).toEqual([1, 2, 3, 4, 78]);
    expect(s.cursor).toBe(4);
    expect(s.lineCount).toBe(5);
  });

  it('repeated − walks backward erasing at each cursor stop', () => {
    let s = createDimRulerState(100, {
      cursor: 5,
      painted: [3, 4, 5],
    });
    s = removeDimRulerLine(s); // erase 5 → cursor 4
    s = removeDimRulerLine(s); // erase 4 → cursor 3
    s = removeDimRulerLine(s); // erase 3 → cursor 2
    expect(s.painted).toEqual([]);
    expect(s.cursor).toBe(2);
  });

  it('− on unpainted cursor only retreats', () => {
    let s = createDimRulerState(100, { cursor: 50, painted: [1] });
    s = removeDimRulerLine(s);
    expect(s.painted).toEqual([1]);
    expect(s.cursor).toBe(49);
  });

  it('− at cursor 1 with nothing painted is a no-op', () => {
    const s = createDimRulerState(100, { cursor: 1, painted: [] });
    expect(removeDimRulerLine(s)).toEqual(s);
  });

  it('rebind dimCount clamps cursor and drops out-of-range painted', () => {
    const s = clampDimRulerState({
      dimCount: 8,
      cursor: 40,
      painted: [1, 5, 20],
    });
    expect(s).toEqual({
      dimCount: 8,
      cursor: 8,
      painted: [1, 5],
      lineCount: 2,
    });
  });

  it('legacy lineCount expands to painted 1..N when painted missing', () => {
    expect(normalizePaintedDims(null, 100, 4)).toEqual([1, 2, 3, 4]);
    expect(clampDimRulerState({ dimCount: 10, cursor: 1, lineCount: 3 })).toEqual({
      dimCount: 10,
      cursor: 1,
      painted: [1, 2, 3],
      lineCount: 3,
    });
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

  it('links consecutive tokens at each painted dim (sparse ok)', () => {
    const segs = buildDimRulerSegments(threads, [1, 3]);
    expect(segs).toEqual([
      { start: { x: 0, y: 10, z: 0 }, end: { x: 0, y: 4, z: 0 } },
      { start: { x: 0, y: 4, z: 0 }, end: { x: 0, y: 1, z: 0 } },
      { start: { x: 20, y: 8, z: 0 }, end: { x: 20, y: 2, z: 0 } },
      { start: { x: 20, y: 2, z: 0 }, end: { x: 20, y: 0, z: 0 } },
    ]);
  });

  it('legacy numeric lineCount still means dims 1..N', () => {
    const segs = buildDimRulerSegments(threads, 2);
    expect(segs).toEqual([
      { start: { x: 0, y: 10, z: 0 }, end: { x: 0, y: 4, z: 0 } },
      { start: { x: 0, y: 4, z: 0 }, end: { x: 0, y: 1, z: 0 } },
      { start: { x: 10, y: 12, z: 0 }, end: { x: 10, y: 6, z: 0 } },
      { start: { x: 10, y: 6, z: 0 }, end: { x: 10, y: 3, z: 0 } },
    ]);
  });

  it('returns [] when no painted dims or fewer than 2 threads', () => {
    expect(buildDimRulerSegments(threads, [])).toEqual([]);
    expect(buildDimRulerSegments(threads, 0)).toEqual([]);
    expect(buildDimRulerSegments([threads[0]], [1, 2])).toEqual([]);
  });

  it('works with NAVIGATION-style distinct Z per token', () => {
    const nav = [
      [{ x: 5, y: 2, z: 0 }, { x: 15, y: 3, z: 0 }],
      [{ x: 5, y: 1, z: 10 }, { x: 15, y: 4, z: 10 }],
    ];
    const segs = buildDimRulerSegments(nav, [1, 2]);
    expect(segs).toEqual([
      { start: { x: 5, y: 2, z: 0 }, end: { x: 5, y: 1, z: 10 } },
      { start: { x: 15, y: 3, z: 0 }, end: { x: 15, y: 4, z: 10 } },
    ]);
  });

  it('buildDimRulerJoints collects token points on painted dims', () => {
    const joints = buildDimRulerJoints(threads, [1]);
    expect(joints).toEqual([
      { x: 0, y: 10, z: 0 },
      { x: 0, y: 4, z: 0 },
      { x: 0, y: 1, z: 0 },
    ]);
  });
});
