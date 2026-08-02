/**
 * Replace raw Compare embeddings with SAE activations (or restore).
 */

/**
 * Dot-product cosine for L2-ish vectors (activations are sparse, not unit-norm).
 * @param {number[]} a
 * @param {number[]} b
 */
export function cosineSimilarity(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom < 1e-12) return 0;
  return dot / denom;
}

/**
 * Expand Top-K sparse SAE encode payload → dense rows [N][dimension].
 * Wire format ships only K indices/values per row (~99% smaller than dense JSON).
 *
 * @param {{
 *   indices?: number[][],
 *   values?: number[][],
 *   dimension?: number,
 *   activations?: number[][],
 * }} encoded
 * @returns {number[][]}
 */
export function densifyTopKActivations(encoded) {
  if (!encoded) {
    throw new Error('densifyTopKActivations requires encode payload');
  }
  const useSparse =
    encoded.format === 'topk_sparse'
    || (Array.isArray(encoded.indices) && Array.isArray(encoded.values));
  if (!useSparse) {
    if (Array.isArray(encoded.activations)) return encoded.activations;
    throw new Error('SAE encode payload missing activations or sparse indices/values');
  }
  const indices = encoded.indices;
  const values = encoded.values;
  const dimension = encoded.dimension | 0;
  if (!Array.isArray(indices) || !Array.isArray(values)) {
    throw new Error('SAE encode sparse payload missing indices/values');
  }
  if (!dimension || dimension < 1) {
    throw new Error('SAE encode sparse payload missing dimension');
  }
  if (indices.length !== values.length) {
    throw new Error(
      `SAE sparse length mismatch: indices ${indices.length} vs values ${values.length}`
    );
  }
  const out = new Array(indices.length);
  for (let i = 0; i < indices.length; i++) {
    const row = new Array(dimension).fill(0);
    const idx = indices[i] || [];
    const val = values[i] || [];
    const m = Math.min(idx.length, val.length);
    for (let j = 0; j < m; j++) {
      const d = idx[j] | 0;
      if (d >= 0 && d < dimension) row[d] = val[j];
    }
    out[i] = row;
  }
  return out;
}

/**
 * Deep-clone compare payload for raw cache.
 * @param {object} data
 */
export function cloneCompareRaw(data) {
  return structuredClone(data);
}

/**
 * Apply SAE activations to compare item embeddings; recompute cosine_vs_first.
 * Preserves groupId / groupLabel (and any other item meta) from rawData.
 * @param {object} rawData
 * @param {number[][]} activations
 * @returns {object}
 */
export function applySaeToCompare(rawData, activations) {
  if (!rawData?.items || !activations) {
    throw new Error('SAE compare encode requires items + activations');
  }
  if (activations.length !== rawData.items.length) {
    throw new Error(
      `SAE compare encode length mismatch: ${activations.length} vs ${rawData.items.length}`
    );
  }
  const next = structuredClone(rawData);
  const anchor = activations[0];
  next.items = next.items.map((item, i) => ({
    ...item,
    embedding: activations[i],
    cosine_vs_first: i === 0 ? 1 : cosineSimilarity(activations[i], anchor),
    // Explicit keep — do not let callers overwrite with stale/wrong keys
    groupId: item.groupId,
    groupLabel: item.groupLabel,
  }));
  next.featureSpace = 'SAE';
  return next;
}

/**
 * @param {object} data
 * @returns {number[][]}
 */
export function collectCompareEmbeddings(data) {
  return (data.items || []).map((item) => item.embedding);
}
