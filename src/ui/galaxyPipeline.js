/**
 * Galaxy VIEW client-driven pipeline (encode → SAE? → UMAP → build).
 */

/**
 * @param {{ saeEnabled?: boolean }} [opts]
 * @returns {Array<{ id: string, label: string }>}
 */
export function buildGalaxyPipelineSteps(opts = {}) {
  const steps = [{ id: 'encode', label: 'Encoding tokens…' }];
  if (opts.saeEnabled) {
    steps.push({ id: 'sae', label: 'Applying SAE…' });
  }
  steps.push({ id: 'umap', label: 'Running UMAP…' });
  steps.push({ id: 'build', label: 'Building galaxy…' });
  return steps;
}

/**
 * @param {number} stepIndex 1-based current step
 * @param {number} total
 * @param {string} label
 * @returns {{ step: number, total: number, label: string, ratio: number, statusText: string }}
 */
export function galaxyProgressState(stepIndex, total, label) {
  const step = Math.max(1, Math.min(stepIndex, total || 1));
  const n = Math.max(1, total || 1);
  const ratio = step / n;
  return {
    step,
    total: n,
    label: label || '',
    ratio,
    statusText: `${step}/${n} ${label || ''}`.trim(),
  };
}

/**
 * Stable fingerprint for compare text cache reuse.
 * @param {string[]|string} textsOrRaw
 * @returns {string}
 */
export function compareTextsFingerprint(textsOrRaw) {
  if (Array.isArray(textsOrRaw)) {
    return textsOrRaw.map((t) => String(t || '').trim()).join('\n');
  }
  return String(textsOrRaw || '').replace(/\r\n/g, '\n').trim();
}

/**
 * Whether cached compare payload can skip re-encode.
 * @param {{ fingerprint?: string, itemCount?: number }|null} cache
 * @param {string} fingerprint
 * @param {number} expectedCount
 */
export function canReuseCompareCache(cache, fingerprint, expectedCount) {
  if (!cache || !fingerprint) return false;
  if (cache.fingerprint !== fingerprint) return false;
  if (!expectedCount || cache.itemCount !== expectedCount) return false;
  return true;
}

/**
 * Client-driven Galaxy pipeline: encode → SAE? → UMAP → build.
 * Side effects (scene) stay in the caller; this returns positions + payloads.
 *
 * @param {object} opts
 * @param {string[]} opts.texts
 * @param {unknown} [opts.tokenMeta]
 * @param {boolean} [opts.saeEnabled]
 * @param {{ fingerprint?: string, itemCount?: number, rawData?: object }|null} [opts.compareCache]
 * @param {(texts: string[]) => Promise<object>} opts.fetchCompare
 * @param {(data: object, tokenMeta: unknown) => object} [opts.attachMeta]
 * @param {(rawData: object) => Promise<object>} [opts.encodeSae]
 * @param {(vectors: number[][]) => Promise<number[][]>} opts.project
 * @param {(progress: ReturnType<typeof galaxyProgressState>) => void} [opts.onProgress]
 * @returns {Promise<{
 *   rawData: object,
 *   displayData: object,
 *   positions: number[][],
 *   compareCache: { fingerprint: string, itemCount: number, rawData: object },
 *   reusedCompare: boolean,
 * }>}
 */
export async function runGalaxyPipeline(opts) {
  const texts = opts.texts || [];
  if (!texts.length) {
    throw new Error('Galaxy pipeline requires at least one token');
  }

  const saeEnabled = !!opts.saeEnabled;
  const steps = buildGalaxyPipelineSteps({ saeEnabled });
  const total = steps.length;

  const report = (id) => {
    const idx = steps.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const step = steps[idx];
    opts.onProgress?.(galaxyProgressState(idx + 1, total, step.label));
  };

  report('encode');
  const fingerprint = compareTextsFingerprint(texts);
  let reusedCompare = false;
  let rawData;

  if (
    canReuseCompareCache(opts.compareCache, fingerprint, texts.length)
    && opts.compareCache?.rawData
  ) {
    rawData = opts.compareCache.rawData;
    reusedCompare = true;
  } else {
    const fetched = await opts.fetchCompare(texts);
    rawData = opts.attachMeta ? opts.attachMeta(fetched, opts.tokenMeta) : fetched;
  }

  const compareCache = {
    fingerprint,
    itemCount: texts.length,
    rawData,
  };

  let displayData = rawData;
  if (saeEnabled) {
    if (typeof opts.encodeSae !== 'function') {
      throw new Error('Galaxy pipeline SAE step requires encodeSae');
    }
    report('sae');
    displayData = await opts.encodeSae(rawData);
  }

  report('umap');
  const items = displayData?.items || [];
  const vectors = items.map((it) => it.embedding).filter((v) => Array.isArray(v) && v.length);
  if (vectors.length !== items.length || !vectors.length) {
    throw new Error('Galaxy pipeline: missing embeddings for projection');
  }
  const positions = await opts.project(vectors);
  if (!Array.isArray(positions) || positions.length !== items.length) {
    throw new Error('Galaxy pipeline: /project position count mismatch');
  }

  report('build');

  return {
    rawData,
    displayData,
    positions,
    compareCache,
    reusedCompare,
  };
}
