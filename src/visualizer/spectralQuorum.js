/**
 * Spectral Quorum (ddi-fw): Deterministic identification of discriminant dimensions
 * separating token groups/almas using bilateral separability (Sd) and baseline noise silencing.
 *
 * Grounded in Deep Dimensional Inspector Firewall (ddi-fw) v0.3.0 & Protocolos 01–04:
 * - Differences across token groups are evaluated in Float64 precision (zero roundoff).
 * - Pairwise nearest-competitor bilateral separability Sd against closest competing group (cruce.py).
 * - Fail-closed dispersion rule: if sigma_g + sigma_h <= 1e-12 (e.g. N=1), Sd = 0.0 exact.
 * - Sign/polarity is preserved: dimensions discriminate both by elevation (+1) and depression (-1).
 * - Intra-group directional coherence (% of words on the group's side of the boundary).
 * - Signal threshold: dimensions must exceed minSeparability to qualify.
 * - Quorum capacity: at most ceil((quorumPercent / 100) * D) dimensions per group.
 * - Groups can naturally share discriminative coordinates without artificial argmax exclusion.
 */

import { countDistinctGroups, listDistinctGroupIds } from './groupStackLayout.js';
import { createMulberry32 } from './spectralPrng.js';

export const EPS_STD = 1e-6; // Aligned with ddi-fw universal 6-decimal standard
export const DEFAULT_MIN_SEPARABILITY = 0.5; // ddi-fw Protocol 03: baseline cutoff for paja
export const DEFAULT_PRNG_SEED = 0xDEADBEEF;

export { createMulberry32 };

/**
 * @typedef {{
 *   dim: number,
 *   delta: number,
 *   absDelta: number,
 *   polarity: number,
 *   separability: number,
 *   competitorId: string,
 *   coherenceCount: number,
 *   coherenceTotal: number,
 *   coherencePct: number,
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
 *   polarity?: number,
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
 *   quorumCapacity: number,
 *   quorumCount: number,
 *   totalDim: number,
 *   maxDelta: number,
 *   avgDelta: number,
 *   topQuorumDims: number[],
 *   minSeparability: number,
 *   groupSignatures?: Record<string, {
 *     quorumDims: number[],
 *     maxDelta: number,
 *     avgDelta: number,
 *     positiveDims: number[],
 *     negativeDims: number[],
 *     admittedCount: number,
 *   }>,
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
 * Computes per-dimension bilateral spectral metrics, separability (Sd), and identifies the Quorum.
 * In accordance with ddi-fw cruce.py & Protocolos 01–04:
 * - Pairwise nearest-competitor contrast: Delta_g(d) against competitor minimizing Sd.
 * - Bilateral Sd: Sd = |Delta_g(d)| / (sigma_g(d) + sigma_comp(d) + EPS_STD).
 * - Fail-closed: if sigma_g(d) + sigma_comp(d) <= 1e-12, Sd = 0.0 exact.
 * - Polarity: +1 if elevated above competitor, -1 if depressed below competitor.
 * - Intra-group coherence: % of group tokens on the group's side of midpoint threshold.
 * - Signal gating: Sd >= minSeparability (default 0.5) is required for Quorum admission.
 * - Quorum capacity: at most ceil((quorumPercent / 100) * D) dimensions per group.
 *
 * @param {Array<{ groupId?: string, embedding?: number[] }|null|undefined>|null|undefined} items
 * @param {{ quorumPercent?: number, minSeparability?: number }} [options]
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
  const quorumCapacity = Math.max(1, Math.min(dim, Math.ceil((quorumPercent / 100) * dim)));
  const minSeparability = Number.isFinite(options.minSeparability)
    ? Math.max(0, Number(options.minSeparability))
    : DEFAULT_MIN_SEPARABILITY;

  // Group tokens and accumulate sums and sums of squares per group in Float64
  /** @type {Map<string, { count: number, sum: Float64Array, sumSq: Float64Array, embeddings: number[][] }>} */
  const groupStats = new Map();
  for (const gid of groupIds) {
    groupStats.set(gid, {
      count: 0,
      sum: new Float64Array(dim),
      sumSq: new Float64Array(dim),
      embeddings: [],
    });
  }

  for (const it of list) {
    const stats = groupStats.get(it.groupId);
    if (!stats) continue;
    const emb = it.embedding;
    stats.count += 1;
    stats.embeddings.push(emb);
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

  // Compute pairwise nearest-competitor bilateral signatures per group (cruce.py model)
  /** @type {Map<string, GroupDimSignature[]>} */
  const groupSignatures = new Map();
  /** @type {Record<string, { quorumDims: number[], maxDelta: number, avgDelta: number, positiveDims: number[], negativeDims: number[], admittedCount: number }>} */
  const groupSummary = {};

  for (const gid of validGroups) {
    const myStats = groupStats.get(gid);
    const myMean = groupMeans.get(gid);
    const myStd = groupStds.get(gid);
    const myEmbeddings = myStats.embeddings;

    /** @type {Array<{ dim: number, delta: number, absDelta: number, polarity: number, separability: number, competitorId: string, coherenceCount: number, coherenceTotal: number, coherencePct: number }>} */
    const rawGroupDims = new Array(dim);
    let maxAbsDelta = 0;
    let maxSeparability = 0;

    for (let d = 0; d < dim; d++) {
      let minSPlus = Infinity;
      let minSMinus = Infinity;
      let bestHPlus = '';
      let bestHMinus = '';
      let bestDeltaPlus = 0;
      let bestDeltaMinus = 0;

      for (const hid of validGroups) {
        if (hid === gid) continue;
        const hMean = groupMeans.get(hid)[d];
        const hStd = groupStds.get(hid)[d];
        const denom = myStd[d] + hStd;

        let sPlus = 0;
        let sMinus = 0;
        const diff = myMean[d] - hMean;

        if (denom > 1e-12) {
          sPlus = diff / (denom + EPS_STD);
          sMinus = -diff / (denom + EPS_STD);
        } else {
          // Fail-closed rule from ddi-fw cruce.py: zero dispersion -> zero separability
          sPlus = 0.0;
          sMinus = 0.0;
        }

        if (sPlus < minSPlus) {
          minSPlus = sPlus;
          bestHPlus = hid;
          bestDeltaPlus = diff;
        }
        if (sMinus < minSMinus) {
          minSMinus = sMinus;
          bestHMinus = hid;
          bestDeltaMinus = diff;
        }
      }

      let minSd = 0;
      let polarity = 1;
      let nearestCompetitorId = '';
      let nearestDelta = 0;

      if (minSPlus >= minSMinus) {
        minSd = Math.max(0, minSPlus);
        polarity = 1;
        nearestCompetitorId = bestHPlus;
        nearestDelta = bestDeltaPlus;
      } else {
        minSd = Math.max(0, minSMinus);
        polarity = -1;
        nearestCompetitorId = bestHMinus;
        nearestDelta = bestDeltaMinus;
      }

      const absDelta = Math.abs(nearestDelta);

      // Intra-group directional coherence (ddi-fw coherencia_signo)
      const compMean = nearestCompetitorId ? groupMeans.get(nearestCompetitorId)[d] : 0;
      const theta = (myMean[d] + compMean) * 0.5;
      let cCount = 0;
      for (let i = 0; i < myEmbeddings.length; i++) {
        const v = myEmbeddings[i][d];
        if (polarity >= 0 ? v >= theta : v < theta) {
          cCount++;
        }
      }
      const coherenceTotal = myEmbeddings.length;
      const coherencePct = coherenceTotal > 0 ? (cCount / coherenceTotal) * 100 : 0;

      if (absDelta > maxAbsDelta) maxAbsDelta = absDelta;
      if (minSd > maxSeparability) maxSeparability = minSd;

      rawGroupDims[d] = {
        dim: d,
        delta: nearestDelta,
        absDelta,
        polarity,
        separability: minSd,
        competitorId: nearestCompetitorId,
        coherenceCount: cCount,
        coherenceTotal,
        coherencePct,
      };
    }

    // Rank dimensions for this group: highest separability first; then highest absDelta; then dim index
    const rankedDims = Array.from({ length: dim }, (_, i) => i).sort((a, b) => {
      const diffSd = rawGroupDims[b].separability - rawGroupDims[a].separability;
      if (Math.abs(diffSd) > 1e-9) return diffSd;
      const diffDelta = rawGroupDims[b].absDelta - rawGroupDims[a].absDelta;
      if (Math.abs(diffDelta) > 1e-9) return diffDelta;
      return a - b;
    });

    const groupDims = new Array(dim);
    const topDims = [];
    const positiveDims = [];
    const negativeDims = [];
    let sumQuorumDelta = 0;

    // Find the peak separability among dimensions that qualify
    let peakQualifyingSd = 0;
    for (let r = 0; r < dim; r++) {
      const d = rankedDims[r];
      const raw = rawGroupDims[d];
      if (r < quorumCapacity && raw.separability >= minSeparability && raw.absDelta > 1e-9) {
        if (raw.separability > peakQualifyingSd) {
          peakQualifyingSd = raw.separability;
        }
      }
    }

    for (let r = 0; r < dim; r++) {
      const d = rankedDims[r];
      const raw = rawGroupDims[d];
      // Deterministic Quorum member: within capacity ceiling AND meets minimal separability
      const isQuorum = r < quorumCapacity && raw.separability >= minSeparability && raw.absDelta > 1e-9;
      if (isQuorum) {
        topDims.push(d);
        sumQuorumDelta += raw.absDelta;
        if (raw.polarity > 0) positiveDims.push(d);
        else negativeDims.push(d);
      }

      const relativeScore = isQuorum && peakQualifyingSd > 1e-12
        ? Math.max(0, Math.min(1, raw.separability / peakQualifyingSd))
        : 0;

      groupDims[d] = {
        dim: d,
        delta: raw.delta,
        absDelta: raw.absDelta,
        polarity: raw.polarity,
        separability: raw.separability,
        competitorId: raw.competitorId,
        coherenceCount: raw.coherenceCount,
        coherenceTotal: raw.coherenceTotal,
        coherencePct: raw.coherencePct,
        rank: r,
        isQuorum,
        relativeScore,
      };
    }

    groupSignatures.set(gid, groupDims);
    groupSummary[gid] = {
      quorumDims: topDims,
      maxDelta: maxAbsDelta,
      avgDelta: topDims.length > 0 ? sumQuorumDelta / topDims.length : 0,
      positiveDims,
      negativeDims,
      admittedCount: topDims.length,
    };
  }

  // Calculate pairwise max delta and global separability across all pairs for top-level metrics
  let globalMaxDelta = 0;
  let totalDeltaSum = 0;
  const rawGlobalMetrics = new Array(dim);

  const mean0 = groupMeans.get(validGroups[0]);
  const mean1 = groupMeans.get(validGroups[1]);

  for (let d = 0; d < dim; d++) {
    let peakDelta = 0;
    let peakPairSd = 0;

    for (let i = 0; i < validGroups.length; i++) {
      const mi = groupMeans.get(validGroups[i])[d];
      const si = groupStds.get(validGroups[i])[d];
      for (let j = i + 1; j < validGroups.length; j++) {
        const mj = groupMeans.get(validGroups[j])[d];
        const sj = groupStds.get(validGroups[j])[d];
        const delta = Math.abs(mi - mj);
        const denom = si + sj;
        const sd = denom > 1e-12 ? delta / (denom + EPS_STD) : 0.0;
        if (delta > peakDelta) {
          peakDelta = delta;
          peakPairSd = sd;
        }
      }
    }

    if (peakDelta > globalMaxDelta) globalMaxDelta = peakDelta;
    totalDeltaSum += peakDelta;

    rawGlobalMetrics[d] = {
      dim: d,
      deltaMean: peakDelta,
      separability: peakPairSd,
    };
  }

  // Global ranking by separability
  const rankedIndices = Array.from({ length: dim }, (_, i) => i).sort((a, b) => {
    const diffSd = rawGlobalMetrics[b].separability - rawGlobalMetrics[a].separability;
    if (Math.abs(diffSd) > 1e-9) return diffSd;
    const diffDelta = rawGlobalMetrics[b].deltaMean - rawGlobalMetrics[a].deltaMean;
    if (Math.abs(diffDelta) > 1e-9) return diffDelta;
    return a - b;
  });

  const metrics = new Array(dim);
  const globalQuorumSet = new Set();

  // Populate per-group signature map and determine global quorum
  for (let rank = 0; rank < dim; rank++) {
    const d = rankedIndices[rank];

    const sigMap = {};
    let isQuorumAny = false;
    let maxGroupRelScore = 0;
    let dominantPolarity = 1;

    for (const gid of validGroups) {
      const gDim = groupSignatures.get(gid)[d];
      sigMap[gid] = gDim;
      if (gDim.isQuorum) {
        isQuorumAny = true;
        if (gDim.relativeScore > maxGroupRelScore) {
          maxGroupRelScore = gDim.relativeScore;
          dominantPolarity = gDim.polarity;
        }
      }
    }

    if (isQuorumAny) {
      globalQuorumSet.add(d);
    }

    metrics[d] = {
      dim: d,
      isQuorum: isQuorumAny,
      rank,
      deltaMean: rawGlobalMetrics[d].deltaMean,
      separability: rawGlobalMetrics[d].separability,
      relativeScore: maxGroupRelScore,
      polarity: dominantPolarity,
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

  const topQuorumDims = Array.from(globalQuorumSet).sort((a, b) => a - b);

  const summary = {
    quorumCapacity,
    quorumCount: globalQuorumSet.size,
    totalDim: dim,
    maxDelta: globalMaxDelta,
    avgDelta: totalDeltaSum / Math.max(1, dim),
    topQuorumDims,
    minSeparability,
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
 *   spectralBaselineCancelCoverage?: number,
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
    relScore = dimMetric.relativeScore ?? 0;
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
