/**
 * Pure helpers for COMPARE cosine-vs-anchor list + in-memory reorder.
 * Cosine = dot(emb_i, emb_0) with L2-normalized embeddings (no backend re-call).
 *
 * Group mode (≥2 GROUP_*): panel lists group centroids vs the first group
 * in textarea/item order. Centroid = mean of per-token L2 unit vectors, then re-L2.
 * Viewer / 3D reorder stay on the flat token payload — this is panel chrome only.
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
 * @param {number[]|Float32Array|null|undefined} v
 * @returns {Float32Array|null}
 */
export function l2Normalize(v) {
  if (!v || v.length === 0) return null;
  let ss = 0;
  for (let i = 0; i < v.length; i++) ss += v[i] * v[i];
  if (!(ss > 0)) return null;
  const inv = 1 / Math.sqrt(ss);
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] * inv;
  return out;
}

/**
 * Prototype vector for a concept: mean of L2-normalized member embeddings, then re-L2.
 * @param {Array<number[]|Float32Array|null|undefined>} embeddings
 * @returns {Float32Array|null}
 */
export function groupCentroid(embeddings) {
  if (!embeddings || embeddings.length === 0) return null;
  let dim = 0;
  /** @type {Float32Array[]} */
  const units = [];
  for (const emb of embeddings) {
    const u = l2Normalize(emb);
    if (!u) continue;
    if (!dim) dim = u.length;
    if (u.length !== dim) continue;
    units.push(u);
  }
  if (!units.length || !dim) return null;

  const mean = new Float32Array(dim);
  for (const u of units) {
    for (let i = 0; i < dim; i++) mean[i] += u[i];
  }
  const invN = 1 / units.length;
  for (let i = 0; i < dim; i++) mean[i] *= invN;
  return l2Normalize(mean);
}

/**
 * Build group-vs-first-group cosine rows for the Compare panel.
 * Returns null when &lt;2 distinct groupIds (caller keeps token-vs-anchor list).
 *
 * @param {Array<{
 *   embedding?: number[]|Float32Array,
 *   groupId?: string,
 *   groupLabel?: string,
 *   text?: string,
 * }>|null|undefined} items
 * @returns {{
 *   anchor: { index: number, text: string, groupId: string },
 *   items: Array<{
 *     id: string,
 *     text: string,
 *     groupId: string,
 *     cosine_vs_first: number,
 *     memberCount: number,
 *     isGroupRow: true,
 *     index: number,
 *   }>,
 * }|null}
 */
export function buildGroupCosineRows(items) {
  if (!items || items.length === 0) return null;

  /** @type {Map<string, { id: string, label: string, embeddings: Array }>} */
  const byGroup = new Map();
  for (const it of items) {
    const gid = it?.groupId;
    if (!gid) continue;
    let bucket = byGroup.get(gid);
    if (!bucket) {
      bucket = {
        id: gid,
        label: it.groupLabel || gid,
        embeddings: [],
      };
      byGroup.set(gid, bucket);
    }
    bucket.embeddings.push(it.embedding);
  }

  if (byGroup.size < 2) return null;

  /** @type {Array<{ id: string, label: string, centroid: Float32Array|null, memberCount: number }>} */
  const groups = [];
  for (const g of byGroup.values()) {
    groups.push({
      id: g.id,
      label: g.label,
      centroid: groupCentroid(g.embeddings),
      memberCount: g.embeddings.length,
    });
  }

  const ref = groups[0];
  const refEmb = ref.centroid;
  const rows = groups.map((g, index) => {
    let score = 0;
    if (index === 0) {
      score = 1;
    } else if (refEmb && g.centroid) {
      score = cosineDot(g.centroid, refEmb);
    }
    return {
      id: `group_${g.id}`,
      text: g.label,
      groupId: g.id,
      cosine_vs_first: score,
      memberCount: g.memberCount,
      isGroupRow: true,
      index,
    };
  });

  return {
    anchor: { index: 0, text: ref.label, groupId: ref.id },
    items: rows,
  };
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

/**
 * Sort non-anchor rows by cosine_vs_first. Anchor (#1 REF) stays fixed at index 0.
 * @param {Array} items
 * @param {'asc'|'desc'} direction
 * @returns {{ count: number, anchor: object|null, items: Array }|null}
 */
export function sortCompareItemsByCosine(items, direction = 'desc') {
  if (!items || !items.length) return null;
  if (direction !== 'asc' && direction !== 'desc') return null;

  const [anchor, ...rest] = items;
  const sortedRest = rest.slice().sort((a, b) => {
    const sa = typeof a.cosine_vs_first === 'number' ? a.cosine_vs_first : 0;
    const sb = typeof b.cosine_vs_first === 'number' ? b.cosine_vs_first : 0;
    return direction === 'asc' ? sa - sb : sb - sa;
  });

  // Same anchor → scores unchanged; reindex only
  return recomputeCompareAnchorScores([anchor, ...sortedRest]);
}
