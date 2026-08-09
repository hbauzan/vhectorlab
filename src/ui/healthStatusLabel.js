/**
 * Format navbar ONLINE chip from /health fields.
 * Example: ONLINE (local-comfort · MiniLM-multi · 384D · mps)
 */

/**
 * @param {object} opts
 * @param {string} [opts.model]
 * @param {string|null} [opts.modelProfile]
 * @param {string|null} [opts.shortLabel]
 * @param {number|null} [opts.embeddingDim]
 * @param {string} [opts.device]
 * @returns {string}
 */
export function formatOnlineStatusLabel({
  model = '',
  modelProfile = null,
  shortLabel = null,
  embeddingDim = null,
  device = '',
} = {}) {
  const parts = [];
  const profile = modelProfile != null ? String(modelProfile).trim() : '';
  if (profile) parts.push(profile);

  let label = shortLabel != null ? String(shortLabel).trim() : '';
  if (!label) {
    const hub = String(model || '').trim();
    if (hub) {
      const slash = hub.lastIndexOf('/');
      label = slash >= 0 ? hub.slice(slash + 1) : hub;
    }
  }
  if (label) parts.push(label);

  if (embeddingDim != null && Number.isFinite(Number(embeddingDim))) {
    parts.push(`${Number(embeddingDim)}D`);
  }

  const dev = String(device || '').trim().toLowerCase();
  if (dev) parts.push(dev);

  if (parts.length === 0) return 'ONLINE';
  return `ONLINE (${parts.join(' · ')})`;
}
