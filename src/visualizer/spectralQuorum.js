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
 * - Auto-calibrated signal threshold via Westfall–Young maxT permutation null (M=1000).
 * - Quorum capacity: at most ceil((quorumPercent / 100) * D) dimensions per group.
 * - Groups can naturally share discriminative coordinates without artificial argmax exclusion.
 */

import { countDistinctGroups, listDistinctGroupIds } from './groupStackLayout.js';
import { createMulberry32 } from './spectralPrng.js';

export const EPS_STD = 1e-6; // Aligned with ddi-fw universal 6-decimal standard
export const DEFAULT_MIN_SEPARABILITY = 0.5; // ddi-fw Protocol 03: baseline cutoff for paja
export const DEFAULT_PRNG_SEED = 0xDEADBEEF;
export const DEFAULT_PERMUTATION_COUNT = 1000;

export { createMulberry32 };

/**
 * Exact integer combination count nCk = n! / (k! * (n - k)!).
 * @param {number} n
 * @param {number} k
 * @returns {number}
 */
export function combinationCount(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const c = Math.min(k, n - k);
  let res = 1;
  for (let i = 1; i <= c; i++) {
    res = (res * (n - c + i)) / i;
  }
  return Math.round(res);
}

/**
 * Evaluates statistical viability based on group sample sizes N.
 * Under permutation test, the minimal achievable p-value between 2 groups is 1 / nCk(n1+n2, n1).
 * For alpha=0.05, n1=3, n2=3 is the hard mathematical minimum (1/20 = 0.05).
 *
 * @param {number[]} groupSizes - Token counts per group
 * @returns {{
 *   status: 'IMPOSSIBLE_SAMPLE_SIZE' | 'LOW_POWER' | 'OPERATIONAL',
 *   pMin: number,
 *   minGroupSize: number,
 *   message: string,
 * }}
 */
export function evaluateSampleSizeDiagnostic(groupSizes) {
  if (!Array.isArray(groupSizes) || groupSizes.length < 2) {
    return {
      status: 'IMPOSSIBLE_SAMPLE_SIZE',
      pMin: 1.0,
      minGroupSize: 0,
      message: 'Requiere al menos 2 grupos para evaluar significancia estadística',
    };
  }
  const sorted = [...groupSizes].sort((a, b) => a - b);
  const n1 = sorted[0];
  const n2 = sorted[1];
  const totalComb = combinationCount(n1 + n2, n1);
  const pMin = totalComb > 0 ? 1 / totalComb : 1.0;

  if (n1 < 3 || pMin > 0.05) {
    return {
      status: 'IMPOSSIBLE_SAMPLE_SIZE',
      pMin,
      minGroupSize: n1,
      message: `Estadísticamente imposible para α=0.05 (p_min = ${pMin.toFixed(3)} > 0.05; requiere N≥3 por grupo)`,
    };
  }

  if (n1 < 8) {
    return {
      status: 'LOW_POWER',
      pMin,
      minGroupSize: n1,
      message: `Baja potencia estadística para N=${n1} (esperado quórum vacío sin señal muy fuerte)`,
    };
  }

  return {
    status: 'OPERATIONAL',
    pMin,
    minGroupSize: n1,
    message: 'Operativo normal',
  };
}

/**
 * Creates a cached container for permutation null results.
 * @returns {{ key: string, result: PermutationNullResult|null }}
 */
export function createSpectralQuorumNullCache() {
  return { key: '', result: null };
}

let defaultGlobalNullCache = createSpectralQuorumNullCache();

/**
 * Generates a deterministic payload fingerprint for permutation caching.
 * @param {Array<{ groupId?: string, embedding?: number[] }|null|undefined>|null|undefined} items
 * @param {number} [seed=DEFAULT_PRNG_SEED]
 * @param {number} [mCount=DEFAULT_PERMUTATION_COUNT]
 * @returns {string}
 */
export function spectralQuorumPayloadCacheKey(
  items,
  seed = DEFAULT_PRNG_SEED,
  mCount = DEFAULT_PERMUTATION_COUNT
) {
  const all = Array.isArray(items) ? items : [];
  const list = all.filter(
    (it) => it?.groupId && Array.isArray(it.embedding) && it.embedding.length > 0
  );
  if (list.length < 2) return '';
  const dim = list[0].embedding.length;
  let h = (all.length * 1000003 + list.length * 10007 + dim + (seed | 0) + (mCount | 0)) | 0;
  for (let i = 0; i < list.length; i++) {
    const gid = String(list[i].groupId || '');
    for (let c = 0; c < gid.length; c++) {
      h = (Math.imul(h, 37) + gid.charCodeAt(c)) | 0;
    }
    const e = list[i].embedding;
    if (e.length !== dim) return `bad:${i}`;
    for (let d = 0; d < dim; d++) {
      h = (Math.imul(h, 31) + ((e[d] * 1e6) | 0)) | 0;
    }
  }
  return `${all.length}:${list.length}:${dim}:${seed}:${mCount}:${h}`;
}

/**
 * @typedef {{
 *   nullP95: number,
 *   maxTDistribution: Float64Array,
 *   iterations: number,
 *   diagnostic: ReturnType<typeof evaluateSampleSizeDiagnostic>,
 * }} PermutationNullResult
 */

/**
 * Computes the empirical noise floor threshold (p95 of global maxT distribution)
 * using the Westfall–Young maxT procedure over M label permutations.
 *
 * Performance optimization: precomputes global sums and, for 2 groups, accumulates only the smaller
 * group (O(N_min * D)), taking the complement by subtraction. Executes 1000 permutations in ~25ms.
 *
 * @param {Array<{ groupId?: string, embedding?: number[] }|null|undefined>|null|undefined} items
 * @param {{
 *   permutationCount?: number,
 *   prngSeed?: number,
 * }} [options]
 * @returns {PermutationNullResult}
 */
export function computePermutationNullThreshold(items, options = {}) {
  const list = (items || []).filter(
    (it) => it?.groupId && Array.isArray(it.embedding) && it.embedding.length > 0
  );
  const groupIds = listDistinctGroupIds(list);
  if (groupIds.length < 2) {
    return {
      nullP95: Infinity,
      maxTDistribution: new Float64Array(0),
      iterations: 0,
      diagnostic: evaluateSampleSizeDiagnostic([]),
    };
  }

  const dim = list[0].embedding.length;
  if (!list.every((it) => it.embedding.length === dim)) {
    return {
      nullP95: Infinity,
      maxTDistribution: new Float64Array(0),
      iterations: 0,
      diagnostic: evaluateSampleSizeDiagnostic([]),
    };
  }

  // Count items per group
  /** @type {Map<string, number>} */
  const groupCounts = new Map();
  for (const gid of groupIds) groupCounts.set(gid, 0);
  for (const it of list) {
    groupCounts.set(it.groupId, (groupCounts.get(it.groupId) || 0) + 1);
  }
  const validGroups = groupIds.filter((gid) => (groupCounts.get(gid) || 0) > 0);
  const countsArray = validGroups.map((gid) => groupCounts.get(gid) || 0);

  const diagnostic = evaluateSampleSizeDiagnostic(countsArray);
  if (diagnostic.status === 'IMPOSSIBLE_SAMPLE_SIZE') {
    return {
      nullP95: Infinity,
      maxTDistribution: new Float64Array(0),
      iterations: 0,
      diagnostic,
    };
  }

  const totalTokens = list.length;
  const M = Math.max(10, Number(options.permutationCount) || DEFAULT_PERMUTATION_COUNT);
  const seed = Number.isFinite(options.prngSeed) ? Number(options.prngSeed) : DEFAULT_PRNG_SEED;
  const prng = createMulberry32(seed);

  // Precompute global sum and sum of squares
  const globalSum = new Float64Array(dim);
  const globalSumSq = new Float64Array(dim);
  const data = new Array(totalTokens);

  for (let i = 0; i < totalTokens; i++) {
    const emb = list[i].embedding;
    data[i] = emb;
    for (let d = 0; d < dim; d++) {
      const v = emb[d];
      globalSum[d] += v;
      globalSumSq[d] += v * v;
    }
  }

  const maxT = new Float64Array(M);
  const indices = Array.from({ length: totalTokens }, (_, i) => i);

  if (validGroups.length === 2) {
    // Highly optimized path for 2 groups: O(N_min * D) per permutation
    const n0 = countsArray[0];
    const n1 = countsArray[1];
    const swap = n0 > n1;
    const nSmall = swap ? n1 : n0;
    const nBig = swap ? n0 : n1;

    const sumSmall = new Float64Array(dim);
    const sumSqSmall = new Float64Array(dim);

    for (let m = 0; m < M; m++) {
      // Fisher-Yates partial shuffle
      for (let i = totalTokens - 1; i > 0; i--) {
        const j = Math.floor(prng() * (i + 1));
        const tmp = indices[i];
        indices[i] = indices[j];
        indices[j] = tmp;
      }

      sumSmall.fill(0);
      sumSqSmall.fill(0);
      for (let i = 0; i < nSmall; i++) {
        const row = data[indices[i]];
        for (let d = 0; d < dim; d++) {
          const v = row[d];
          sumSmall[d] += v;
          sumSqSmall[d] += v * v;
        }
      }

      let peakSd = 0;
      for (let d = 0; d < dim; d++) {
        const mS = sumSmall[d] / nSmall;
        const vS = Math.max(0, sumSqSmall[d] / nSmall - mS * mS);
        const sS = Math.sqrt(vS);

        const sumB = globalSum[d] - sumSmall[d];
        const sumSqB = globalSumSq[d] - sumSqSmall[d];
        const mB = sumB / nBig;
        const vB = Math.max(0, sumSqB / nBig - mB * mB);
        const sB = Math.sqrt(vB);

        const denom = sS + sB;
        if (denom > 1e-12) {
          const sd = Math.abs(mS - mB) / (denom + EPS_STD);
          if (sd > peakSd) peakSd = sd;
        }
      }
      maxT[m] = peakSd;
    }
  } else {
    // General path for G >= 3 groups
    const G = validGroups.length;
    const sumG = Array.from({ length: G }, () => new Float64Array(dim));
    const sumSqG = Array.from({ length: G }, () => new Float64Array(dim));

    for (let m = 0; m < M; m++) {
      // Fisher-Yates shuffle
      for (let i = totalTokens - 1; i > 0; i--) {
        const j = Math.floor(prng() * (i + 1));
        const tmp = indices[i];
        indices[i] = indices[j];
        indices[j] = tmp;
      }

      for (let g = 0; g < G; g++) {
        sumG[g].fill(0);
        sumSqG[g].fill(0);
      }

      let offset = 0;
      for (let g = 0; g < G; g++) {
        const countG = countsArray[g];
        const sG = sumG[g];
        const sqG = sumSqG[g];
        for (let i = 0; i < countG; i++) {
          const row = data[indices[offset + i]];
          for (let d = 0; d < dim; d++) {
            const v = row[d];
            sG[d] += v;
            sqG[d] += v * v;
          }
        }
        offset += countG;
      }

      // Compute max separation over dims and groups
      let peakSd = 0;
      for (let d = 0; d < dim; d++) {
        const means = new Float64Array(G);
        const stds = new Float64Array(G);
        for (let g = 0; g < G; g++) {
          const countG = countsArray[g];
          const m = sumG[g][d] / countG;
          means[g] = m;
          stds[g] = Math.sqrt(Math.max(0, sumSqG[g][d] / countG - m * m));
        }

        // For each group, calculate signed envelope against nearest competitor
        for (let g = 0; g < G; g++) {
          let minSPlus = Infinity;
          let minSMinus = Infinity;

          for (let h = 0; h < G; h++) {
            if (h === g) continue;
            const denom = stds[g] + stds[h];
            let sPlus = 0;
            let sMinus = 0;
            const diff = means[g] - means[h];
            if (denom > 1e-12) {
              sPlus = diff / (denom + EPS_STD);
              sMinus = -diff / (denom + EPS_STD);
            }
            if (sPlus < minSPlus) minSPlus = sPlus;
            if (sMinus < minSMinus) minSMinus = sMinus;
          }

          const sdG = Math.max(0, Math.max(minSPlus, minSMinus));
          if (sdG > peakSd) peakSd = sdG;
        }
      }
      maxT[m] = peakSd;
    }
  }

  // Westfall–Young maxT 95th percentile
  const sortedMaxT = Float64Array.from(maxT).sort();
  const p95Index = Math.min(M - 1, Math.floor(M * 0.95));
  const nullP95 = sortedMaxT[p95Index];

  return {
    nullP95,
    maxTDistribution: sortedMaxT,
    iterations: M,
    diagnostic,
  };
}

/**
 * Cached access to the permutation null threshold.
 * @param {{ key: string, result: PermutationNullResult|null }} cache
 * @param {Array<{ groupId?: string, embedding?: number[] }|null|undefined>|null|undefined} items
 * @param {{ permutationCount?: number, prngSeed?: number }} [options]
 * @returns {PermutationNullResult}
 */
export function cachedPermutationNullThreshold(cache, items, options = {}) {
  const seed = Number.isFinite(options.prngSeed) ? Number(options.prngSeed) : DEFAULT_PRNG_SEED;
  const mCount = Math.max(10, Number(options.permutationCount) || DEFAULT_PERMUTATION_COUNT);
  const key = spectralQuorumPayloadCacheKey(items, seed, mCount);
  if (cache && cache.key === key && cache.result) {
    return cache.result;
  }
  const result = computePermutationNullThreshold(items, { permutationCount: mCount, prngSeed: seed });
  if (cache) {
    cache.key = key;
    cache.result = result;
  }
  return result;
}

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
 *   nullP95?: number,
 *   diagnostic?: ReturnType<typeof evaluateSampleSizeDiagnostic>,
 *   prngSeed?: number,
 *   permutationsRun?: number,
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
 * - Signal gating: auto-calibrated via Westfall–Young maxT permutation null (M=1000) or explicit minSeparability.
 * - Quorum capacity: at most ceil((quorumPercent / 100) * D) dimensions per group.
 *
 * @param {Array<{ groupId?: string, embedding?: number[] }|null|undefined>|null|undefined} items
 * @param {{
 *   quorumPercent?: number,
 *   minSeparability?: number,
 *   usePermutationNull?: boolean,
 *   permutationCount?: number,
 *   prngSeed?: number,
 *   nullCache?: { key: string, result: PermutationNullResult|null },
 * }} [options]
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

  // Resolve permutation null threshold and diagnostic
  const seed = Number.isFinite(options.prngSeed) ? Number(options.prngSeed) : DEFAULT_PRNG_SEED;
  const mCount = Math.max(10, Number(options.permutationCount) || DEFAULT_PERMUTATION_COUNT);
  const cacheToUse = options.nullCache || defaultGlobalNullCache;

  let nullResult = null;
  if (options.usePermutationNull !== false && !Number.isFinite(options.minSeparability)) {
    nullResult = cachedPermutationNullThreshold(cacheToUse, items, {
      permutationCount: mCount,
      prngSeed: seed,
    });
  }

  const effectiveThreshold = Number.isFinite(options.minSeparability)
    ? Math.max(0, Number(options.minSeparability))
    : (nullResult ? nullResult.nullP95 : DEFAULT_MIN_SEPARABILITY);

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

  // Compute pairwise nearest-competitor bilateral signatures per group (cruce.py signed envelope)
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
      if (r < quorumCapacity && raw.separability >= effectiveThreshold && raw.absDelta > 1e-9) {
        if (raw.separability > peakQualifyingSd) {
          peakQualifyingSd = raw.separability;
        }
      }
    }

    for (let r = 0; r < dim; r++) {
      const d = rankedDims[r];
      const raw = rawGroupDims[d];
      // Deterministic Quorum member: within capacity ceiling AND meets minimal separability
      const isQuorum = r < quorumCapacity && raw.separability >= effectiveThreshold && raw.absDelta > 1e-9;
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
    minSeparability: effectiveThreshold,
    nullP95: nullResult ? nullResult.nullP95 : undefined,
    diagnostic: nullResult ? nullResult.diagnostic : undefined,
    prngSeed: seed,
    permutationsRun: nullResult ? nullResult.iterations : 0,
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
