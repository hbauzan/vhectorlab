/**
 * Dim-axis ruler: cross-token links at display dims 1..N.
 * Cursor / lineCount are 1-based; lineCount covers dims 1..lineCount.
 * Each covered dim joins tokens (list order): path = consecutive edges,
 * span = single straight segment from min-Y to max-Y point at that dim.
 */

/**
 * @typedef {{
 *   dimCount: number,
 *   cursor: number,
 *   lineCount: number,
 * }} DimRulerState
 */

/**
 * @typedef {'path' | 'span'} DimRulerLinkMode
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
 * @param {unknown} mode
 * @returns {DimRulerLinkMode}
 */
export function normalizeRulerLinkMode(mode) {
  return mode === 'span' ? 'span' : 'path';
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
 * @param {unknown} p
 * @returns {RulerPoint|null}
 */
function asPoint(p) {
  if (!p || typeof p !== 'object') return null;
  const x = p.x;
  const y = p.y;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const z = Number.isFinite(p.z) ? p.z : 0;
  return { x, y, z };
}

/**
 * Collect valid thread points at a 0-based dim index (list order).
 * @param {Array<Array<{ x?: number, y?: number, z?: number }|null|undefined>>} threadPointArrays
 * @param {number} dimIndex
 * @returns {RulerPoint[]}
 */
export function pointsAtDim(threadPointArrays, dimIndex) {
  const threads = Array.isArray(threadPointArrays) ? threadPointArrays : [];
  /** @type {RulerPoint[]} */
  const out = [];
  for (const pts of threads) {
    if (!Array.isArray(pts)) continue;
    const p = asPoint(pts[dimIndex]);
    if (p) out.push(p);
  }
  return out;
}

/**
 * Cross-token segments for dims 1..lineCount.
 * - path: consecutive token→token edges in list order at each dim
 * - span: one straight segment from lowest-Y to highest-Y point at each dim
 *
 * @param {Array<Array<{ x?: number, y?: number, z?: number }|null|undefined>>} threadPointArrays
 * @param {number} lineCount
 * @param {DimRulerLinkMode|string} [mode='path']
 * @returns {Array<{ start: RulerPoint, end: RulerPoint }>}
 */
export function buildDimRulerSegments(threadPointArrays, lineCount, mode = 'path') {
  const n = Math.max(0, toInt(lineCount, 0));
  const linkMode = normalizeRulerLinkMode(mode);
  if (n <= 0 || !Array.isArray(threadPointArrays) || threadPointArrays.length < 2) {
    return [];
  }

  /** @type {Array<{ start: RulerPoint, end: RulerPoint }>} */
  const segs = [];

  for (let k = 0; k < n; k += 1) {
    const pts = pointsAtDim(threadPointArrays, k);
    if (pts.length < 2) continue;

    if (linkMode === 'span') {
      let lo = pts[0];
      let hi = pts[0];
      for (let i = 1; i < pts.length; i += 1) {
        if (pts[i].y < lo.y) lo = pts[i];
        if (pts[i].y > hi.y) hi = pts[i];
      }
      if (lo !== hi) {
        segs.push({ start: { ...lo }, end: { ...hi } });
      }
      continue;
    }

    for (let i = 0; i < pts.length - 1; i += 1) {
      segs.push({
        start: { ...pts[i] },
        end: { ...pts[i + 1] },
      });
    }
  }

  return segs;
}

/**
 * Collect token joints at dims 1..lineCount (for Path markers).
 * @param {Array<Array<{ x?: number, y?: number, z?: number }|null|undefined>>} threadPointArrays
 * @param {number} lineCount
 * @returns {RulerPoint[]}
 */
export function buildDimRulerJoints(threadPointArrays, lineCount) {
  const n = Math.max(0, toInt(lineCount, 0));
  if (n <= 0 || !Array.isArray(threadPointArrays)) return [];
  /** @type {RulerPoint[]} */
  const out = [];
  for (let k = 0; k < n; k += 1) {
    out.push(...pointsAtDim(threadPointArrays, k));
  }
  return out;
}
