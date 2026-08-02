/**
 * Pure helpers for COMPARE cosine-vs-anchor list + in-memory reorder.
 * Cosine = dot(emb_i, emb_0) with L2-normalized embeddings (no backend re-call).
 */

/**
 * @param {number[]|Float32Array} a
 * @param {number[]|Float32Array} b
 * @returns {number}
 */
export function cosineDot(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Recalculate indices, cosine_vs_first vs items[0], and anchor metadata.
 * Mutates nothing — returns a new compare payload slice.
 * @param {Array<{ id: string, text: string, embedding: number[], cosine_vs_first?: number }>} items
 * @returns {{ count: number, anchor: { index: number, text: string }|null, items: Array }}
 */
export function recomputeCompareAnchorScores(items) {
  if (!items || items.length === 0) {
    return { count: 0, anchor: null, items: [] };
  }

  const anchorEmb = items[0].embedding;
  const nextItems = items.map((item, index) => ({
    ...item,
    index,
    cosine_vs_first: index === 0 ? 1 : cosineDot(item.embedding, anchorEmb),
  }));
  // Exact identity for REF row
  nextItems[0].cosine_vs_first = 1;

  return {
    count: nextItems.length,
    anchor: { index: 0, text: nextItems[0].text },
    items: nextItems,
  };
}

/**
 * Move item at fromIndex by delta (-1 up / +1 down), then recompute scores.
 * @param {Array} items
 * @param {number} fromIndex
 * @param {number} delta
 * @returns {{ count: number, anchor: object|null, items: Array }|null}
 */
export function reorderCompareItems(items, fromIndex, delta) {
  if (!items || !items.length) return null;
  const toIndex = fromIndex + delta;
  if (fromIndex < 0 || fromIndex >= items.length) return null;
  if (toIndex < 0 || toIndex >= items.length) return null;
  if (delta === 0) return recomputeCompareAnchorScores(items);

  const next = items.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return recomputeCompareAnchorScores(next);
}
