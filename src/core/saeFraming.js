/**
 * Helpers for SAE ON framing: keep visual dim-span similar to RAW 768.
 */

/** Canonical raw embedding dim for VHectorLab (all-mpnet-base-v2). */
export const RAW_EMBEDDING_DIM = 768;

/**
 * Scale factor so SAE feature count spans ~the same world width as RAW.
 * @param {number} rawDim
 * @param {number} saeDim
 * @returns {number}
 */
export function computeDimSpanScale(rawDim, saeDim) {
  const raw = Number(rawDim);
  const sae = Number(saeDim);
  if (!Number.isFinite(raw) || !Number.isFinite(sae) || raw <= 0 || sae <= 0) return 1;
  if (sae >= raw) return 1;
  return raw / sae;
}

/**
 * Infer raw dim from cached arithmetic/compare payload.
 * @param {object|null|undefined} rawData
 * @returns {number}
 */
export function inferRawDim(rawData) {
  if (!rawData) return RAW_EMBEDDING_DIM;
  if (Array.isArray(rawData.vector_res) && rawData.vector_res.length) {
    return rawData.vector_res.length;
  }
  const a = rawData.components?.vec_a;
  if (Array.isArray(a) && a.length) return a.length;
  const emb = rawData.items?.[0]?.embedding;
  if (Array.isArray(emb) && emb.length) return emb.length;
  return RAW_EMBEDDING_DIM;
}

/**
 * Infer SAE dim from encoded payload.
 * @param {object|null|undefined} saeData
 * @returns {number}
 */
export function inferSaeDim(saeData) {
  if (!saeData) return 0;
  if (Array.isArray(saeData.vector_res) && saeData.vector_res.length) {
    return saeData.vector_res.length;
  }
  const a = saeData.components?.vec_a;
  if (Array.isArray(a) && a.length) return a.length;
  const emb = saeData.items?.[0]?.embedding;
  if (Array.isArray(emb) && emb.length) return emb.length;
  return 0;
}
