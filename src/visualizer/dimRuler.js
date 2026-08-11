/**
 * Dim-axis ruler: contiguous polyline along display dims 1..D.
 * Cursor / lineCount are 1-based dim indices; lineCount covers dims 1..lineCount.
 * Geometry connects consecutive dims at Y = max thread height per dim (envelope).
 * lineCount=1 → short tick at dim 1 so the first + is visible.
 */

/**
 * @typedef {{
 *   dimCount: number,
 *   cursor: number,
 *   lineCount: number,
 * }} DimRulerState
 */

/**
 * @typedef {{ x: number, y: number, z?: number }} RulerPoint
 */

/**
 * @param {unknown} n
 * @param {number} fallback
 * @returns {number}
 */
function toInt(n, fallback) {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.round(v);
}

/**
 * @param {Partial<DimRulerState>|null|undefined} partial
 * @returns {DimRulerState}
 */
export function clampDimRulerState(partial = null) {
  const src = partial && typeof partial === 'object' ? partial : {};
  const dimCount = Math.max(0, toInt(src.dimCount, 0));
  if (dimCount <= 0) {
    return { dimCount: 0, cursor: 1, lineCount: 0 };
  }
  const cursor = Math.max(1, Math.min(dimCount, toInt(src.cursor, 1)));
  const lineCount = Math.max(0, Math.min(dimCount, toInt(src.lineCount, 0)));
  return { dimCount, cursor, lineCount };
}

/**
 * @param {number} [dimCount=0]
 * @param {Partial<DimRulerState>} [partial]
 * @returns {DimRulerState}
 */
export function createDimRulerState(dimCount = 0, partial = {}) {
  return clampDimRulerState({
    dimCount,
    cursor: 1,
    lineCount: 0,
    ...partial,
  });
}

/**
 * @param {DimRulerState} state
 * @param {unknown} rawCursor
 * @returns {DimRulerState}
 */
export function setDimRulerCursor(state, rawCursor) {
  return clampDimRulerState({
    ...state,
    cursor: toInt(rawCursor, 1),
  });
}

/**
 * Add / extend ruler to include cursor (fill). If already covered, grow by one.
 * @param {DimRulerState} state
 * @returns {DimRulerState}
 */
export function addDimRulerLine(state) {
  const s = clampDimRulerState(state);
  if (s.dimCount <= 0) return s;

  if (s.lineCount < s.cursor) {
    return clampDimRulerState({ ...s, lineCount: s.cursor });
  }

  if (s.lineCount >= s.dimCount) {
    return clampDimRulerState({ ...s, cursor: s.dimCount, lineCount: s.dimCount });
  }

  const next = s.lineCount + 1;
  return clampDimRulerState({ ...s, lineCount: next, cursor: next });
}

/**
 * Remove ruler at cursor (truncate from there), then peel backward on repeat.
 * @param {DimRulerState} state
 * @returns {DimRulerState}
 */
export function removeDimRulerLine(state) {
  const s = clampDimRulerState(state);
  if (s.lineCount <= 0) return s;

  const target = Math.min(s.lineCount, s.cursor);
  const nextCount = Math.max(0, target - 1);
  const nextCursor = nextCount <= 0 ? 1 : nextCount;
  return clampDimRulerState({ ...s, lineCount: nextCount, cursor: nextCursor });
}

/**
 * Per-dim max world Y across thread point arrays (display order).
 * @param {Array<Array<{ x?: number, y?: number, z?: number }|null|undefined>>} threadPointArrays
 * @returns {number[]}
 */
export function computeDimMaxYs(threadPointArrays) {
  const threads = Array.isArray(threadPointArrays) ? threadPointArrays : [];
  let dimCount = 0;
  for (const pts of threads) {
    if (Array.isArray(pts) && pts.length > dimCount) dimCount = pts.length;
  }
  const maxYs = new Array(dimCount).fill(Number.NEGATIVE_INFINITY);
  for (const pts of threads) {
    if (!Array.isArray(pts)) continue;
    for (let i = 0; i < pts.length; i += 1) {
      const y = pts[i]?.y;
      if (typeof y === 'number' && Number.isFinite(y) && y > maxYs[i]) {
        maxYs[i] = y;
      }
    }
  }
  return maxYs.map((y) => (Number.isFinite(y) ? y : 0));
}

/**
 * Infer half-step from consecutive X samples (used for the single-dim tick).
 * @param {number[]} xs
 * @returns {number}
 */
export function inferDimHalfStep(xs) {
  if (!Array.isArray(xs) || xs.length < 2) return 0.5;
  const d = xs[1] - xs[0];
  if (!Number.isFinite(d) || Math.abs(d) < 1e-9) return 0.5;
  return Math.abs(d) * 0.5;
}

/**
 * Connect dims 1..lineCount along the max-Y envelope (polyline).
 * lineCount=1 → short tick at dim 1; lineCount≥2 → segments dim→dim+1.
 * @param {number[]} xs - world X per dim index (0-based)
 * @param {number[]} maxYs - world Y max per dim index
 * @param {number} lineCount
 * @param {number} [z=0]
 * @param {number} [halfStep]
 * @returns {Array<{ start: RulerPoint, end: RulerPoint }>}
 */
export function buildDimRulerSegments(xs, maxYs, lineCount, z = 0, halfStep = null) {
  const n = Math.max(0, toInt(lineCount, 0));
  if (n <= 0 || !Array.isArray(xs) || !Array.isArray(maxYs)) return [];

  /** @type {Array<{ start: RulerPoint, end: RulerPoint }>} */
  const segs = [];

  if (n === 1) {
    const x = xs[0];
    if (!Number.isFinite(x)) return [];
    const half = halfStep == null ? inferDimHalfStep(xs) : Math.max(0, Number(halfStep) || 0);
    const y = Number.isFinite(maxYs[0]) ? maxYs[0] : 0;
    return [{ start: { x: x - half, y, z }, end: { x: x + half, y, z } }];
  }

  for (let i = 0; i < n - 1; i += 1) {
    const x0 = xs[i];
    const x1 = xs[i + 1];
    if (!Number.isFinite(x0) || !Number.isFinite(x1)) continue;
    const y0 = Number.isFinite(maxYs[i]) ? maxYs[i] : 0;
    const y1 = Number.isFinite(maxYs[i + 1]) ? maxYs[i + 1] : 0;
    segs.push({
      start: { x: x0, y: y0, z },
      end: { x: x1, y: y1, z },
    });
  }
  return segs;
}
