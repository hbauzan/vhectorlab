/**
 * Dim-axis ruler: cross-token links at selected display dims.
 * Cursor is a paint head: + paints at cursor then advances; − erases at cursor then retreats.
 * Painted dims persist as a sparse set (jumping the cursor does not clear them).
 */

/**
 * @typedef {{
 *   dimCount: number,
 *   cursor: number,
 *   painted: number[],
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
 * Normalize 1-based painted dim indices (unique, sorted, optional dimCount clamp).
 * Legacy: if `painted` empty/missing and `legacyLineCount` > 0 → dims 1..legacyLineCount.
 * @param {unknown} painted
 * @param {number} [dimCount=0]
 * @param {unknown} [legacyLineCount]
 * @returns {number[]}
 */
export function normalizePaintedDims(painted, dimCount = 0, legacyLineCount = null) {
  const cap = Math.max(0, toInt(dimCount, 0));
  /** @type {number[]} */
  let raw = [];
  if (Array.isArray(painted)) {
    for (const item of painted) {
      const d = toInt(item, 0);
      if (d >= 1) raw.push(d);
    }
  } else {
    const n = Math.max(0, toInt(legacyLineCount, 0));
    if (n > 0) {
      const end = cap > 0 ? Math.min(n, cap) : n;
      for (let i = 1; i <= end; i += 1) raw.push(i);
    }
  }
  const seen = new Set();
  /** @type {number[]} */
  const out = [];
  for (const d of raw) {
    if (cap > 0 && d > cap) continue;
    if (seen.has(d)) continue;
    seen.add(d);
    out.push(d);
  }
  out.sort((a, b) => a - b);
  return out;
}

/**
 * @param {Partial<DimRulerState>|null|undefined} partial
 * @returns {DimRulerState}
 */
export function clampDimRulerState(partial = null) {
  const src = partial && typeof partial === 'object' ? partial : {};
  const dimCount = Math.max(0, toInt(src.dimCount, 0));
  if (dimCount <= 0) {
    return { dimCount: 0, cursor: 1, painted: [], lineCount: 0 };
  }
  const cursor = Math.max(1, Math.min(dimCount, toInt(src.cursor, 1)));
  const painted = normalizePaintedDims(
    src.painted,
    dimCount,
    src.lineCount
  );
  return {
    dimCount,
    cursor,
    painted,
    lineCount: painted.length,
  };
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
    painted: [],
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
 * Paint at cursor (idempotent), then advance cursor by one.
 * @param {DimRulerState} state
 * @returns {DimRulerState}
 */
export function addDimRulerLine(state) {
  const s = clampDimRulerState(state);
  if (s.dimCount <= 0) return s;

  const painted = normalizePaintedDims([...s.painted, s.cursor], s.dimCount);
  const nextCursor = Math.min(s.dimCount, s.cursor + 1);
  return clampDimRulerState({
    ...s,
    painted,
    cursor: nextCursor,
    lineCount: painted.length,
  });
}

/**
 * Erase at cursor (if painted), then retreat cursor by one.
 * @param {DimRulerState} state
 * @returns {DimRulerState}
 */
export function removeDimRulerLine(state) {
  const s = clampDimRulerState(state);
  if (s.dimCount <= 0) return s;
  if (s.painted.length <= 0 && s.cursor <= 1) return s;

  const painted = s.painted.filter((d) => d !== s.cursor);
  const nextCursor = Math.max(1, s.cursor - 1);
  return clampDimRulerState({
    ...s,
    painted,
    cursor: nextCursor,
    lineCount: painted.length,
  });
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
 * Resolve 1-based painted dims from an explicit list or legacy lineCount prefix.
 * @param {unknown} paintedOrLineCount
 * @param {unknown} [legacyLineCount]
 * @returns {number[]}
 */
function resolvePaintedArg(paintedOrLineCount, legacyLineCount = null) {
  if (Array.isArray(paintedOrLineCount)) {
    return normalizePaintedDims(paintedOrLineCount, 0, legacyLineCount);
  }
  return normalizePaintedDims(null, 0, paintedOrLineCount);
}

/**
 * Cross-token segments for each painted dim: consecutive token→token edges
 * in list order at that dim.
 *
 * @param {Array<Array<{ x?: number, y?: number, z?: number }|null|undefined>>} threadPointArrays
 * @param {number[]|number} paintedDimsOrLineCount - 1-based dims, or legacy contiguous count
 * @returns {Array<{ start: RulerPoint, end: RulerPoint }>}
 */
export function buildDimRulerSegments(threadPointArrays, paintedDimsOrLineCount) {
  const painted = resolvePaintedArg(paintedDimsOrLineCount);
  if (!painted.length || !Array.isArray(threadPointArrays) || threadPointArrays.length < 2) {
    return [];
  }

  /** @type {Array<{ start: RulerPoint, end: RulerPoint }>} */
  const segs = [];

  for (const dim1 of painted) {
    const pts = pointsAtDim(threadPointArrays, dim1 - 1);
    if (pts.length < 2) continue;

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
 * Collect token joints at painted dims (markers on the path).
 * @param {Array<Array<{ x?: number, y?: number, z?: number }|null|undefined>>} threadPointArrays
 * @param {number[]|number} paintedDimsOrLineCount
 * @returns {RulerPoint[]}
 */
export function buildDimRulerJoints(threadPointArrays, paintedDimsOrLineCount) {
  const painted = resolvePaintedArg(paintedDimsOrLineCount);
  if (!painted.length || !Array.isArray(threadPointArrays)) return [];
  /** @type {RulerPoint[]} */
  const out = [];
  for (const dim1 of painted) {
    out.push(...pointsAtDim(threadPointArrays, dim1 - 1));
  }
  return out;
}
