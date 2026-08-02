/**
 * Dimension permutation by between-group mean contrast (L2 / D6).
 * Score per dim = max pairwise |mean_Gi − mean_Gj| across distinct groupIds.
 */

import { countDistinctGroups, listDistinctGroupIds } from './groupStackLayout.js';

/**
 * @param {Array<{ groupId?: string, embedding?: number[] }|null|undefined>|null|undefined} items
 * @returns {boolean}
 */
export function hasEnoughGroupsForDimSort(items) {
  return countDistinctGroups(items) >= 2;
}

/**
 * Identity permutation [0, 1, …, dim-1].
 * @param {number} dim
 * @returns {number[]}
 */
export function identityPermutation(dim) {
  const n = Math.max(0, Math.floor(Number(dim) || 0));
  return Array.from({ length: n }, (_, i) => i);
}

/**
 * Per-dimension contrast scores (max pairwise |Δmean|). Length = embedding dim.
 * Returns [] if <2 groups or empty/mismatched embeddings.
 *
 * @param {Array<{ groupId?: string, embedding?: number[] }|null|undefined>|null|undefined} items
 * @returns {number[]}
 */
export function computeDimContrastScores(items) {
  const list = (items || []).filter((it) => it?.groupId && Array.isArray(it.embedding) && it.embedding.length);
  const groupIds = listDistinctGroupIds(list);
  if (groupIds.length < 2) return [];

  const dim = list[0].embedding.length;
  if (!list.every((it) => it.embedding.length === dim)) return [];

  /** @type {Map<string, { sum: Float64Array, count: number }>} */
  const acc = new Map();
  for (const gid of groupIds) {
    acc.set(gid, { sum: new Float64Array(dim), count: 0 });
  }

  for (const it of list) {
    const bucket = acc.get(it.groupId);
    if (!bucket) continue;
    const emb = it.embedding;
    for (let d = 0; d < dim; d++) {
      bucket.sum[d] += emb[d];
    }
    bucket.count += 1;
  }

  /** @type {Float64Array[]} */
  const means = [];
  for (const gid of groupIds) {
    const bucket = acc.get(gid);
    if (!bucket || bucket.count < 1) continue;
    const mean = new Float64Array(dim);
    for (let d = 0; d < dim; d++) {
      mean[d] = bucket.sum[d] / bucket.count;
    }
    means.push(mean);
  }
  if (means.length < 2) return [];

  /** @type {number[]} */
  const scores = new Array(dim);
  for (let d = 0; d < dim; d++) {
    let peak = 0;
    for (let i = 0; i < means.length; i++) {
      for (let j = i + 1; j < means.length; j++) {
        const delta = Math.abs(means[i][d] - means[j][d]);
        if (delta > peak) peak = delta;
      }
    }
    scores[d] = peak;
  }
  return scores;
}

/**
 * Permutation of dim indices sorted by contrast descending (stable on ties by index).
 * Identity when contrast cannot be computed.
 *
 * @param {Array<{ groupId?: string, embedding?: number[] }|null|undefined>|null|undefined} items
 * @returns {number[]}
 */
export function computeDimContrastPermutation(items) {
  const scores = computeDimContrastScores(items);
  if (!scores.length) {
    const dim = items?.find((it) => Array.isArray(it?.embedding))?.embedding?.length ?? 0;
    return identityPermutation(dim);
  }
  return scores
    .map((score, index) => ({ score, index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.index);
}

/**
 * Reorder vector components by permutation (displayIndex → sourceDim).
 * @param {number[]} vector
 * @param {number[]|null|undefined} permutation
 * @returns {number[]}
 */
export function applyDimPermutation(vector, permutation) {
  if (!Array.isArray(vector)) return [];
  if (!Array.isArray(permutation) || permutation.length !== vector.length) {
    return vector.slice();
  }
  return permutation.map((src) => vector[src]);
}
