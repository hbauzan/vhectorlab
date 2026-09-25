/**
 * Spectral Quorum (ddi-fw): Isolates the top 10% discriminant dimensions (Trigos)
 * separating different token groups/almas in their decimals, while suppressing
 * the common baseline noise (Paja).
 *
 * Grounded in Deep Dimensional Inspector Firewall (ddi-fw) v0.3.0:
 * - Differences across token groups/almas reside in subtle decimals (10^-4 to 10^-6).
 * - Each group possesses its own directional spectral signature (distinct peak dimensions).
 * - Universal 10% Quorum (ceil(0.10 * D)) captures domain discriminance.
 * - Paja (structural noise) is silenced; each group's Trigos are highlighted on their own coordinates.
 */

import { countDistinctGroups, listDistinctGroupIds } from './groupStackLayout.js';

const EPS_STD = 1e-6; // Aligned with ddi-fw universal 6-decimal standard

/**
 * @typedef {{
 *   dim: number,
 *   delta: number,
 *   separability: number,
 *   rank: number,
 *   isQuorum: boolean,
 *   relativeScore: number,
 * }} GroupDimSignature
 */

/**
 * @typedef {{
 *   dim: number,
 *   isQuorum: boolean,
 *   rank: number,
 *   deltaMean: number,
 *   separability: number,
 *   relativeScore: number,
 *   meanA?: number,
 *   meanB?: number,
 *   sameSign?: boolean,
 *   similarity?: number,
 *   difference?: number,
 *   conflictBalance?: number,
 *   groupSignatures?: Record<string, GroupDimSignature>,
 * }} SpectralDimMetric
 */

/**
 * @typedef {{
 *   quorumCount: number,
 *   totalDim: number,
 *   maxDelta: number,
 *   avgDelta: number,
 *   topQuorumDims: number[],
 *   groupSignatures?: Record<string, { quorumDims: number[], maxDelta: number, avgDelta: number }>,
 * }} SpectralQuorumSummary
 */

/**
 * Checks if the items list has at least two groups with non-empty embeddings of equal dimension.
 * @param {Array<{ groupId?: string, embedding?: number[] }|null|undefined>|null|undefined} items
 * @returns {boolean}
 */
export function hasEnoughGroupsForSpectralQuorum(items) {
  const list = (items || []).filter(
    (it) => it?.groupId && Array.isArray(it.embedding) && it.embedding.length > 0
  );
  if (countDistinctGroups(list) < 2) return false;
  const dim = list[0].embedding.length;
  return list.every((it) => it.embedding.length === dim);
}

/**
 * Computes per-dimension directional spectral metrics, separability (Sd), and identifies the Quorum.
 * In accordance with ddi-fw:
 * - Each group's signature is directional: delta_g(d) = mu_g(d) - max_{h != g} mu_h(d).
 * - Top quorumPercent dimensions where delta_g(d) > 0 constitute group g's exclusive Quorum.
 * - Multi-group Quorums are naturally distinct / mutually exclusive across coordinates.
 *
 * @param {Array<{ groupId?: string, embedding?: number[] }|null|undefined>|null|undefined} items
 * @param {{ quorumPercent?: number, decimalGain?: number }} [options]
 * @returns {{ metrics: SpectralDimMetric[], summary: SpectralQuorumSummary } | null}
 */
export function computeSpectralQuorumMetrics(items, options = {}) {
  const list = (items || []).filter(
    (it) => it?.groupId && Array.isArray(it.embedding) && it.embedding.length > 0
  );
  const groupIds = listDistinctGroupIds(list);
  if (groupIds.length < 2) return null;

  const dim = list[0].embedding.length;
  if (!list.every((it) => it.embedding.length === dim)) return null;

  const quorumPercent = Math.max(1, Math.min(100, Number(options.quorumPercent) || 10));
  const quorumCount = Math.max(1, Math.min(dim, Math.ceil((quorumPercent / 100) * dim)));

  // Accumulate sums and sums of squares per group
  /** @type {Map<string, { count: number, sum: Float64Array, sumSq: Float64Array }>} */
  const groupStats = new Map();
  for (const gid of groupIds) {
    groupStats.set(gid, {
      count: 0,
      sum: new Float64Array(dim),
      sumSq: new Float64Array(dim),
    });
  }

  for (const it of list) {
    const stats = groupStats.get(it.groupId);
    if (!stats) continue;
    const emb = it.embedding;
    stats.count += 1;
    for (let d = 0; d < dim; d++) {
      const v = emb[d];
      stats.sum[d] += v;
      stats.sumSq[d] += v * v;
    }
  }

  // Filter valid groups with >= 1 items
  const validGroups = groupIds.filter((gid) => (groupStats.get(gid)?.count || 0) > 0);
  if (validGroups.length < 2) return null;

  // Compute means and standard deviations per group (Float64 precision for 10^-6 decimals)
  /** @type {Map<string, Float64Array>} */
  const groupMeans = new Map();
  /** @type {Map<string, Float64Array>} */
  const groupStds = new Map();

  for (const gid of validGroups) {
    const s = groupStats.get(gid);
    const mean = new Float64Array(dim);
    const std = new Float64Array(dim);
    for (let d = 0; d < dim; d++) {
      const m = s.sum[d] / s.count;
      mean[d] = m;
      const variance = Math.max(0, s.sumSq[d] / s.count - m * m);
      std[d] = Math.sqrt(variance);
    }
    groupMeans.set(gid, mean);
    groupStds.set(gid, std);
  }

  // Compute directional spectral signatures per group (ddi-fw model)
  /** @type {Map<string, GroupDimSignature[]>} */
  const groupSignatures = new Map();
  /** @type {Record<string, { quorumDims: number[], maxDelta: number, avgDelta: number }>} */
  const groupSummary = {};

  for (const gid of validGroups) {
    const myMean = groupMeans.get(gid);
    const myStd = groupStds.get(gid);
    const otherGids = validGroups.filter((g) => g !== gid);

    /** @type {Array<{ dim: number, delta: number, separability: number }>} */
    const rawGroupDims = new Array(dim);
    let maxDelta = 0;
    let totalPositiveDelta = 0;
    let maxSeparability = 0;

    for (let d = 0; d < dim; d++) {
      // Find the strongest competitor group on dimension d
      let compMaxMean = -Infinity;
      let compStd = 0;
      for (const otherGid of otherGids) {
        const otherMean = groupMeans.get(otherGid)[d];
        if (otherMean > compMaxMean) {
          compMaxMean = otherMean;
          compStd = groupStds.get(otherGid)[d];
        }
      }

      // Directional Delta: how much this group leads above its best competitor
      const delta = myMean[d] - compMaxMean;
      // Sd = directional separability (only positive leads count as discriminant)
      const sd = delta > 0 ? delta / (myStd[d] + compStd + EPS_STD) : 0;

      if (delta > maxDelta) maxDelta = delta;
      if (delta > 0) totalPositiveDelta += delta;
      if (sd > maxSeparability) maxSeparability = sd;

      rawGroupDims[d] = {
        dim: d,
        delta,
        separability: sd,
      };
    }

    // Rank dimensions for this group: highest separability first; then highest delta; then dim index
    const rankedDims = Array.from({ length: dim }, (_, i) => i).sort((a, b) => {
      const diffSd = rawGroupDims[b].separability - rawGroupDims[a].separability;
      if (Math.abs(diffSd) > 1e-9) return diffSd;
      const diffDelta = rawGroupDims[b].delta - rawGroupDims[a].delta;
      if (Math.abs(diffDelta) > 1e-9) return diffDelta;
      return a - b;
    });

    const groupDims = new Array(dim);
    const topDims = [];

    for (let r = 0; r < dim; r++) {
      const d = rankedDims[r];
      const raw = rawGroupDims[d];
      // Quorum member if within quorumCount and delta > 0 (or r === 0 fallback)
      const isQuorum = r < quorumCount && (raw.delta > 0 || r === 0);
      if (isQuorum) topDims.push(d);

      const relativeScore = maxSeparability > 1e-12
        ? Math.max(0, Math.min(1, raw.separability / maxSeparability))
        : (maxDelta > 1e-12 ? Math.max(0, Math.min(1, raw.delta / maxDelta)) : 1.0);

      groupDims[d] = {
        dim: d,
        delta: raw.delta,
        separability: raw.separability,
        rank: r,
        isQuorum,
        relativeScore: isQuorum ? relativeScore : 0,
      };
    }

    groupSignatures.set(gid, groupDims);
    groupSummary[gid] = {
      quorumDims: topDims,
      maxDelta,
      avgDelta: totalPositiveDelta / Math.max(1, dim),
    };
  }

  // Calculate pairwise max delta and global separability for top-level metrics
  let globalMaxDelta = 0;
  let totalDeltaSum = 0;
  const rawGlobalMetrics = new Array(dim);

  const mean0 = groupMeans.get(validGroups[0]);
  const mean1 = groupMeans.get(validGroups[1]);
  const std0 = groupStds.get(validGroups[0]);
  const std1 = groupStds.get(validGroups[1]);

  for (let d = 0; d < dim; d++) {
    let peakDelta = 0;
    let peakPairStdSum = 0;

    for (let i = 0; i < validGroups.length; i++) {
      const mi = groupMeans.get(validGroups[i])[d];
      const si = groupStds.get(validGroups[i])[d];
      for (let j = i + 1; j < validGroups.length; j++) {
        const mj = groupMeans.get(validGroups[j])[d];
        const sj = groupStds.get(validGroups[j])[d];
        const delta = Math.abs(mi - mj);
        if (delta > peakDelta) {
          peakDelta = delta;
          peakPairStdSum = si + sj;
        }
      }
    }

    if (peakDelta > globalMaxDelta) globalMaxDelta = peakDelta;
    totalDeltaSum += peakDelta;

    const sd = peakDelta / (peakPairStdSum + EPS_STD);
    rawGlobalMetrics[d] = {
      dim: d,
      deltaMean: peakDelta,
      separability: sd,
    };
  }

  // Global ranking
  const rankedIndices = Array.from({ length: dim }, (_, i) => i).sort((a, b) => {
    const diffSd = rawGlobalMetrics[b].separability - rawGlobalMetrics[a].separability;
    if (Math.abs(diffSd) > 1e-9) return diffSd;
    const diffDelta = rawGlobalMetrics[b].deltaMean - rawGlobalMetrics[a].deltaMean;
    if (Math.abs(diffDelta) > 1e-9) return diffDelta;
    return a - b;
  });

  const maxGlobalSd = rawGlobalMetrics[rankedIndices[0]]?.separability || 1.0;
  const metrics = new Array(dim);
  const topQuorumDims = [];

  for (let rank = 0; rank < dim; rank++) {
    const d = rankedIndices[rank];
    const isQuorum = rank < quorumCount;
    if (isQuorum) topQuorumDims.push(d);

    // Populate per-group signature map for this dimension
    const sigMap = {};
    let maxGroupRelScore = 0;

    for (const gid of validGroups) {
      const gDim = groupSignatures.get(gid)[d];
      sigMap[gid] = gDim;
      if (gDim.relativeScore > maxGroupRelScore) {
        maxGroupRelScore = gDim.relativeScore;
      }
    }

    const relativeScore = maxGlobalSd > 1e-12
      ? Math.max(0, Math.min(1, rawGlobalMetrics[d].separability / maxGlobalSd))
      : (globalMaxDelta > 1e-12 ? rawGlobalMetrics[d].deltaMean / globalMaxDelta : 1.0);

    metrics[d] = {
      dim: d,
      isQuorum,
      rank,
      deltaMean: rawGlobalMetrics[d].deltaMean,
      separability: rawGlobalMetrics[d].separability,
      relativeScore: Math.max(relativeScore, maxGroupRelScore),
      meanA: mean0[d],
      meanB: mean1[d],
      sameSign: (mean0[d] >= 0) === (mean1[d] >= 0),
      similarity: (() => {
        const aa = Math.abs(mean0[d]);
        const bb = Math.abs(mean1[d]);
        const den = aa + bb;
        return den <= 1e-12 ? 1 : Math.max(0, Math.min(1, 1 - Math.abs(mean0[d] - mean1[d]) / den));
      })(),
      difference: (() => {
        const aa = Math.abs(mean0[d]);
        const bb = Math.abs(mean1[d]);
        const den = aa + bb;
        return den <= 1e-12 ? 0 : Math.max(0, Math.min(1, Math.abs(mean0[d] - mean1[d]) / den));
      })(),
      conflictBalance: (() => {
        const aa = Math.abs(mean0[d]);
        const bb = Math.abs(mean1[d]);
        const den = aa + bb;
        return den <= 1e-12 ? 0 : Math.max(0, Math.min(1, (2 * Math.min(aa, bb)) / den));
      })(),
      groupSignatures: sigMap,
    };
  }

  const summary = {
    quorumCount,
    totalDim: dim,
    maxDelta: globalMaxDelta,
    avgDelta: totalDeltaSum / Math.max(1, dim),
    topQuorumDims,
    groupSignatures: groupSummary,
  };

  return { metrics, summary };
}

/**
 * Computes paint weights (cancel / highlight) for one dimension under Spectral Quorum.
 * When groupId is provided, evaluates whether dimension d belongs to groupId's directional Quorum:
 * - If in group's Quorum: highlights point based on relative discriminance and decimalGain.
 * - If NOT in group's Quorum: cancels point (silences baseline noise according to pajaCoverage).
 *
 * @param {SpectralDimMetric|null|undefined} dimMetric
 * @param {{
 *   spectralQuorumEnabled?: boolean,
 *   spectralHighlightStrength?: number,
 *   spectralPajaCancelCoverage?: number,
 *   spectralDecimalGain?: number,
 * }} settings
 * @param {string|null|undefined} [groupId]
 * @returns {{ cancel: number, highlight: number }}
 */
export function paintWeightsForSpectralQuorum(dimMetric, settings = {}, groupId = null) {
  if (!settings?.spectralQuorumEnabled || !dimMetric) {
    return { cancel: 0, highlight: 0 };
  }

  let isQuorum = false;
  let relScore = 0;

  if (groupId && dimMetric.groupSignatures && dimMetric.groupSignatures[groupId]) {
    const sig = dimMetric.groupSignatures[groupId];
    isQuorum = Boolean(sig.isQuorum);
    relScore = sig.relativeScore ?? 0;
  } else {
    // Fallback when groupId is not provided
    isQuorum = Boolean(dimMetric.isQuorum);
    relScore = dimMetric.relativeScore ?? 1.0;
  }

  if (isQuorum) {
    const strength = Math.max(0, Math.min(100, Number(settings.spectralHighlightStrength) || 100)) / 100;
    const gain = Math.max(1, Math.min(50, Number(settings.spectralDecimalGain) || 10));
    // Amplify relative score by decimal gain (10x is baseline 1.0)
    const boostedScore = Math.min(1.0, relScore * (gain / 10));
    const highlight = Math.max(0, Math.min(1, strength * boostedScore));
    return { cancel: 0, highlight };
  }

  // Baseline noise dimensions: cancel according to baseline suppression coverage (default 100%)
  const baselineCoverage = settings.spectralBaselineCancelCoverage !== undefined
    ? settings.spectralBaselineCancelCoverage
    : settings.spectralPajaCancelCoverage;
  const coverage = baselineCoverage !== undefined
    ? Math.max(0, Math.min(100, Number(baselineCoverage) || 0))
    : 100;
  const cancel = Math.max(0, Math.min(1, coverage / 100));

  return { cancel, highlight: 0 };
}

