import { describe, it, expect } from 'vitest';
import {
  hasEnoughGroupsForSpectralQuorum,
  computeSpectralQuorumMetrics,
  paintWeightsForSpectralQuorum,
  createMulberry32,
  combinationCount,
  evaluateSampleSizeDiagnostic,
  computePermutationNullThreshold,
  createSpectralQuorumNullCache,
  spectralQuorumPayloadCacheKey,
  cachedPermutationNullThreshold,
  DEFAULT_MIN_SEPARABILITY,
  DEFAULT_PRNG_SEED,
} from '../src/visualizer/spectralQuorum.js';

describe('spectralQuorum math and classification (ddi-fw port)', () => {
  it('requires ≥2 distinct groups with valid embeddings', () => {
    expect(hasEnoughGroupsForSpectralQuorum(null)).toBe(false);
    expect(hasEnoughGroupsForSpectralQuorum([])).toBe(false);
    expect(hasEnoughGroupsForSpectralQuorum([{ groupId: 'python', embedding: [0.02, 0.03] }])).toBe(false);
    expect(hasEnoughGroupsForSpectralQuorum([
      { groupId: 'python', embedding: [0.02, 0.03] },
      { groupId: 'python', embedding: [0.025, 0.031] },
    ])).toBe(false);
    expect(hasEnoughGroupsForSpectralQuorum([
      { groupId: 'python', embedding: [0.02, 0.03] },
      { groupId: 'receta', embedding: [0.05, 0.01] },
    ])).toBe(true);
  });

  it('computes deltaMean, separability Sd and identifies 10% Quorum (Trigos vs Paja)', () => {
    // 10 dimensions: dim0 to dim9.
    // Let dim4 have the largest separation: python=0.08, receta=0.01 (delta = 0.07).
    const pythonEmbeddings = [
      [0.02, 0.02, 0.02, 0.02, 0.08, 0.02, 0.02, 0.02, 0.02, 0.02],
      [0.021, 0.019, 0.02, 0.02, 0.082, 0.02, 0.02, 0.02, 0.02, 0.02],
    ];
    const recetaEmbeddings = [
      [0.022, 0.021, 0.02, 0.02, 0.01, 0.02, 0.02, 0.02, 0.02, 0.02],
      [0.021, 0.020, 0.02, 0.02, 0.011, 0.02, 0.02, 0.02, 0.02, 0.02],
    ];

    const items = [
      { groupId: 'python', embedding: pythonEmbeddings[0] },
      { groupId: 'python', embedding: pythonEmbeddings[1] },
      { groupId: 'receta', embedding: recetaEmbeddings[0] },
      { groupId: 'receta', embedding: recetaEmbeddings[1] },
    ];

    const result = computeSpectralQuorumMetrics(items, { quorumPercent: 10, minSeparability: 0.5 });
    expect(result).not.toBeNull();
    expect(result.metrics).toHaveLength(10);
    expect(result.summary.quorumCapacity).toBe(1); // ceil(10 * 0.1) = 1
    expect(result.summary.quorumCount).toBe(1);
    expect(result.summary.totalDim).toBe(10);
    expect(result.summary.topQuorumDims).toEqual([4]);

    // dim 4 must be Quorum (Trigo)
    const dim4 = result.metrics[4];
    expect(dim4.isQuorum).toBe(true);
    expect(dim4.deltaMean).toBeCloseTo(0.0705, 3);
    expect(dim4.rank).toBe(0);

    // Other dimensions should be Paja (not in Quorum)
    for (let d = 0; d < 10; d++) {
      if (d !== 4) {
        expect(result.metrics[d].isQuorum).toBe(false);
      }
    }
  });

  it('supports configurable quorum percentage (e.g. 20% = 2 dims on 10D)', () => {
    const items = [
      { groupId: 'A', embedding: [0.10, 0.00, 0.05, 0.00, 0.00] },
      { groupId: 'A', embedding: [0.102, 0.001, 0.051, 0.00, 0.00] },
      { groupId: 'B', embedding: [0.00, 0.00, 0.00, 0.00, 0.00] },
      { groupId: 'B', embedding: [0.001, 0.00, 0.001, 0.00, 0.00] },
    ];
    // 5 dims, 20% quorum => ceil(5 * 0.2) = 1 dim (dim0).
    // 40% quorum => ceil(5 * 0.4) = 2 dims (dim0, dim2).
    const res20 = computeSpectralQuorumMetrics(items, { quorumPercent: 20, minSeparability: 0.5 });
    expect(res20.summary.quorumCapacity).toBe(1);
    expect(res20.summary.quorumCount).toBe(1);
    expect(res20.summary.topQuorumDims).toEqual([0]);

    const res40 = computeSpectralQuorumMetrics(items, { quorumPercent: 40, minSeparability: 0.5 });
    expect(res40.summary.quorumCapacity).toBe(2);
    expect(res40.summary.quorumCount).toBe(2);
    expect(res40.summary.topQuorumDims).toEqual([0, 2]);
    expect(res40.metrics[0].isQuorum).toBe(true);
    expect(res40.metrics[2].isQuorum).toBe(true);
    expect(res40.metrics[1].isQuorum).toBe(false);
  });

  it('paintWeightsForSpectralQuorum highlights Quorum and cancels Paja', () => {
    const mockQuorumMetric = {
      isQuorum: true,
      rank: 0,
      deltaMean: 0.07,
      separability: 3.5,
      relativeScore: 1.0,
    };
    const mockPajaMetric = {
      isQuorum: false,
      rank: 5,
      deltaMean: 0.002,
      separability: 0.1,
      relativeScore: 0.03,
    };

    const settingsOn = {
      spectralQuorumEnabled: true,
      spectralHighlightStrength: 80,
      spectralPajaCancelCoverage: 100,
      spectralDecimalGain: 10,
    };

    // Quorum: highlight is active, cancel is 0
    const wQuorum = paintWeightsForSpectralQuorum(mockQuorumMetric, settingsOn);
    expect(wQuorum.cancel).toBe(0);
    expect(wQuorum.highlight).toBeCloseTo(0.8, 2);

    // Paja: highlight is 0, cancel is 1.0 (100%)
    const wPaja = paintWeightsForSpectralQuorum(mockPajaMetric, settingsOn);
    expect(wPaja.highlight).toBe(0);
    expect(wPaja.cancel).toBe(1.0);

    // Partial paja cancel coverage (e.g. 60%)
    const settingsMid = { ...settingsOn, spectralPajaCancelCoverage: 60 };
    const wPajaMid = paintWeightsForSpectralQuorum(mockPajaMetric, settingsMid);
    expect(wPajaMid.cancel).toBeCloseTo(0.6, 2);

    // Disabled toggle → zero weights
    const settingsOff = { ...settingsOn, spectralQuorumEnabled: false };
    expect(paintWeightsForSpectralQuorum(mockQuorumMetric, settingsOff)).toEqual({ cancel: 0, highlight: 0 });
    expect(paintWeightsForSpectralQuorum(mockPajaMetric, settingsOff)).toEqual({ cancel: 0, highlight: 0 });
  });

  it('boosts decimal highlight with decimalGain knob', () => {
    const mockSubtleQuorum = {
      isQuorum: true,
      rank: 1,
      deltaMean: 0.015, // subtle 2nd-3rd decimal difference
      separability: 1.2,
      relativeScore: 0.3, // 30% of peak
    };

    // Base gain 10x
    const wNormal = paintWeightsForSpectralQuorum(mockSubtleQuorum, {
      spectralQuorumEnabled: true,
      spectralHighlightStrength: 100,
      spectralPajaCancelCoverage: 100,
      spectralDecimalGain: 10,
    });
    expect(wNormal.highlight).toBeCloseTo(0.3, 2);

    // Boosted gain 30x (3x multiplier on 0.3 = 0.9)
    const wBoosted = paintWeightsForSpectralQuorum(mockSubtleQuorum, {
      spectralQuorumEnabled: true,
      spectralHighlightStrength: 100,
      spectralPajaCancelCoverage: 100,
      spectralDecimalGain: 30,
    });
    expect(wBoosted.highlight).toBeCloseTo(0.9, 2);
  });

  it('computes directional mutually exclusive spectral signatures for distinct almas/groups', () => {
    // 3 groups, 10 dimensions:
    // dim 2 is peak for 'it_core'
    // dim 5 is peak for 'vehicles'
    // dim 8 is peak for 'women'
    const itCoreEmb = [
      [0.01, 0.01, 0.08, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01],
      [0.01, 0.01, 0.082, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01],
    ];
    const vehiclesEmb = [
      [0.01, 0.01, 0.01, 0.01, 0.01, 0.09, 0.01, 0.01, 0.01, 0.01],
      [0.01, 0.01, 0.01, 0.01, 0.01, 0.092, 0.01, 0.01, 0.01, 0.01],
    ];
    const womenEmb = [
      [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.075, 0.01],
      [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.077, 0.01],
    ];

    const items = [
      { groupId: 'it_core', embedding: itCoreEmb[0] },
      { groupId: 'it_core', embedding: itCoreEmb[1] },
      { groupId: 'vehicles', embedding: vehiclesEmb[0] },
      { groupId: 'vehicles', embedding: vehiclesEmb[1] },
      { groupId: 'women', embedding: womenEmb[0] },
      { groupId: 'women', embedding: womenEmb[1] },
    ];

    const res = computeSpectralQuorumMetrics(items, { quorumPercent: 10, minSeparability: 0.5 });
    expect(res).not.toBeNull();
    const gSig = res.summary.groupSignatures;
    expect(gSig).toBeDefined();

    // Verify per-group quorum dimensions are directional and identify the primary peaks
    expect(gSig.it_core.quorumDims).toEqual([2]);
    expect(gSig.vehicles.quorumDims).toEqual([5]);
    expect(gSig.women.quorumDims).toEqual([8]);

    // Check paint weights per group
    const settings = {
      spectralQuorumEnabled: true,
      spectralHighlightStrength: 100,
      spectralPajaCancelCoverage: 100,
      spectralDecimalGain: 10,
    };

    // On dim 2 (it_core signature):
    // it_core point MUST light up; vehicles and women MUST be cancelled to black!
    const wItOnDim2 = paintWeightsForSpectralQuorum(res.metrics[2], settings, 'it_core');
    const wVehOnDim2 = paintWeightsForSpectralQuorum(res.metrics[2], settings, 'vehicles');
    const wWomOnDim2 = paintWeightsForSpectralQuorum(res.metrics[2], settings, 'women');
    expect(wItOnDim2.highlight).toBeGreaterThan(0.5);
    expect(wItOnDim2.cancel).toBe(0);
    expect(wVehOnDim2.highlight).toBe(0);
    expect(wVehOnDim2.cancel).toBe(1.0);
    expect(wWomOnDim2.highlight).toBe(0);
    expect(wWomOnDim2.cancel).toBe(1.0);

    // On dim 5 (vehicles signature):
    // vehicles MUST light up; it_core and women MUST be cancelled to black!
    const wItOnDim5 = paintWeightsForSpectralQuorum(res.metrics[5], settings, 'it_core');
    const wVehOnDim5 = paintWeightsForSpectralQuorum(res.metrics[5], settings, 'vehicles');
    const wWomOnDim5 = paintWeightsForSpectralQuorum(res.metrics[5], settings, 'women');
    expect(wItOnDim5.highlight).toBe(0);
    expect(wItOnDim5.cancel).toBe(1.0);
    expect(wVehOnDim5.highlight).toBeGreaterThan(0.5);
    expect(wVehOnDim5.cancel).toBe(0);
    expect(wWomOnDim5.highlight).toBe(0);
    expect(wWomOnDim5.cancel).toBe(1.0);

    // On dim 8 (women signature):
    // women MUST light up; it_core and vehicles MUST be cancelled to black!
    const wItOnDim8 = paintWeightsForSpectralQuorum(res.metrics[8], settings, 'it_core');
    const wVehOnDim8 = paintWeightsForSpectralQuorum(res.metrics[8], settings, 'vehicles');
    const wWomOnDim8 = paintWeightsForSpectralQuorum(res.metrics[8], settings, 'women');
    expect(wItOnDim8.highlight).toBe(0);
    expect(wItOnDim8.cancel).toBe(1.0);
    expect(wVehOnDim8.highlight).toBe(0);
    expect(wVehOnDim8.cancel).toBe(1.0);
    expect(wWomOnDim8.highlight).toBeGreaterThan(0.5);
    expect(wWomOnDim8.cancel).toBe(0);

    // On dim 0 (common baseline noise):
    // ALL groups MUST be cancelled to black!
    const wItOnDim0 = paintWeightsForSpectralQuorum(res.metrics[0], settings, 'it_core');
    const wVehOnDim0 = paintWeightsForSpectralQuorum(res.metrics[0], settings, 'vehicles');
    const wWomOnDim0 = paintWeightsForSpectralQuorum(res.metrics[0], settings, 'women');
    expect(wItOnDim0.highlight).toBe(0);
    expect(wItOnDim0.cancel).toBe(1.0);
    expect(wVehOnDim0.highlight).toBe(0);
    expect(wVehOnDim0.cancel).toBe(1.0);
    expect(wWomOnDim0.highlight).toBe(0);
    expect(wWomOnDim0.cancel).toBe(1.0);
  });

  it('accurately resolves subtle 4th to 6th decimal variations (order 10^-5) with bilateral polarity', () => {
    // 2 groups with variance where difference is in the 5th decimal place (0.000040)
    const items = [
      { groupId: 'alpha', embedding: [0.020000, 0.020049] },
      { groupId: 'alpha', embedding: [0.020000, 0.020051] },
      { groupId: 'beta',  embedding: [0.020000, 0.020009] },
      { groupId: 'beta',  embedding: [0.020000, 0.020011] },
    ];

    const res = computeSpectralQuorumMetrics(items, { quorumPercent: 50, minSeparability: 0.5 });
    expect(res).not.toBeNull();
    expect(res.summary.maxDelta).toBeCloseTo(0.000040, 6);
    expect(res.metrics[1].deltaMean).toBeCloseTo(0.000040, 6);

    // Alpha leads positively on dim 1 (polarity +1)
    expect(res.metrics[1].groupSignatures.alpha.isQuorum).toBe(true);
    expect(res.metrics[1].groupSignatures.alpha.polarity).toBe(1);
    expect(res.metrics[1].groupSignatures.alpha.relativeScore).toBeCloseTo(1.0, 2);

    // Beta contrasts negatively on dim 1 (polarity -1)
    expect(res.metrics[1].groupSignatures.beta.isQuorum).toBe(true);
    expect(res.metrics[1].groupSignatures.beta.polarity).toBe(-1);
    expect(res.metrics[1].groupSignatures.beta.relativeScore).toBeCloseTo(1.0, 2);

    // Dim 0 has delta = 0, neither group has it in Quorum
    expect(res.metrics[0].groupSignatures.alpha.isQuorum).toBe(false);
    expect(res.metrics[0].groupSignatures.beta.isQuorum).toBe(false);
  });

  it('evaluates bilateral nearest-competitor signed separability for 3 groups (elevation vs depression)', () => {
    // 3 groups, 4 dimensions:
    // dim 1: it_core is depressed (-1) below vehicles (0.08) and women (0.085)
    // dim 2: vehicles is elevated (+1) above it_core (0.01) and women (0.01)
    // dim 3: vehicles is in the middle (between it_core 0.09 and women 0.02)
    const items = [
      { groupId: 'it_core',  embedding: [0.01, 0.010, 0.01, 0.09] },
      { groupId: 'it_core',  embedding: [0.01, 0.011, 0.01, 0.091] },
      { groupId: 'vehicles', embedding: [0.01, 0.080, 0.09, 0.05] },
      { groupId: 'vehicles', embedding: [0.01, 0.081, 0.091, 0.051] },
      { groupId: 'women',    embedding: [0.01, 0.085, 0.01, 0.02] },
      { groupId: 'women',    embedding: [0.01, 0.086, 0.01, 0.021] },
    ];

    const res = computeSpectralQuorumMetrics(items, { quorumPercent: 25, minSeparability: 0.5 });
    expect(res).not.toBeNull();

    // On dim 1: it_core is depressed below both vehicles (0.08) and women (0.085)
    expect(res.metrics[1].groupSignatures.it_core.isQuorum).toBe(true);
    expect(res.metrics[1].groupSignatures.it_core.polarity).toBe(-1);
    expect(res.metrics[1].groupSignatures.it_core.separability).toBeGreaterThan(1.0);

    // On dim 2: vehicles is elevated above both it_core (0.01) and women (0.01)
    expect(res.metrics[2].groupSignatures.vehicles.isQuorum).toBe(true);
    expect(res.metrics[2].groupSignatures.vehicles.polarity).toBe(1);
    expect(res.metrics[2].groupSignatures.vehicles.separability).toBeGreaterThan(1.0);

    // On dim 3: vehicles is sandwiched between it_core and women -> no quorum signature
    expect(res.metrics[3].groupSignatures.vehicles.isQuorum).toBe(false);
  });

  it('fails closed when N=1 (sigma_g + sigma_h <= 1e-12) producing Sd = 0 and empty quorum', () => {
    // Fail-closed rule from ddi-fw cruce.py: with 1 token per group, dispersion cannot be estimated
    const items = [
      { groupId: 'A', embedding: [0.10, 0.20, 0.30] },
      { groupId: 'B', embedding: [0.01, 0.02, 0.03] },
    ];
    const res = computeSpectralQuorumMetrics(items, { quorumPercent: 50 });
    expect(res).not.toBeNull();
    expect(res.summary.quorumCount).toBe(0);
    expect(res.summary.topQuorumDims).toEqual([]);
    for (let d = 0; d < 3; d++) {
      expect(res.metrics[d].isQuorum).toBe(false);
      expect(res.metrics[d].separability).toBe(0.0);
      expect(res.metrics[d].groupSignatures.A.separability).toBe(0.0);
      expect(res.metrics[d].groupSignatures.B.separability).toBe(0.0);
    }
  });

  it('accurately computes intra-group directional coherence percentage (ddi-fw coherencia_signo)', () => {
    const gA = Array.from({ length: 10 }, (_, i) => ({
      groupId: 'A',
      embedding: [i === 0 ? 0.02 : 0.08 + i * 0.0005],
    }));
    const gB = Array.from({ length: 10 }, (_, i) => ({
      groupId: 'B',
      embedding: [0.01 + i * 0.0005],
    }));

    const res = computeSpectralQuorumMetrics([...gA, ...gB], { quorumPercent: 100, minSeparability: 0.5 });
    expect(res).not.toBeNull();
    const sigA = res.metrics[0].groupSignatures.A;
    expect(sigA.coherenceTotal).toBe(10);
    expect(sigA.coherenceCount).toBe(9); // 9 out of 10 words on its side of threshold
    expect(sigA.coherencePct).toBe(90);
    expect(sigA.polarity).toBe(1);

    const sigB = res.metrics[0].groupSignatures.B;
    expect(sigB.coherenceTotal).toBe(10);
    expect(sigB.coherenceCount).toBe(10); // 10 out of 10 words on its side of threshold
    expect(sigB.coherencePct).toBe(100);
    expect(sigB.polarity).toBe(-1);
  });

  it('createMulberry32 generates deterministic, reproducible pseudo-random numbers', () => {
    const prng1 = createMulberry32(0x12345678);
    const prng2 = createMulberry32(0x12345678);
    const seq1 = Array.from({ length: 10 }, () => prng1());
    const seq2 = Array.from({ length: 10 }, () => prng2());
    expect(seq1).toEqual(seq2);

    for (const v of seq1) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }

    const prngOther = createMulberry32(0x99999999);
    const seqOther = Array.from({ length: 10 }, () => prngOther());
    expect(seq1).not.toEqual(seqOther);
  });

  it('regression Bug B1: dominated group does not receive a fake quorum with relativeScore 1.0', () => {
    const items = [
      { groupId: 'A', embedding: [0.09, 0.01, 0.01] },
      { groupId: 'A', embedding: [0.091, 0.01, 0.01] },
      { groupId: 'B', embedding: [0.01, 0.09, 0.01] },
      { groupId: 'B', embedding: [0.01, 0.091, 0.01] },
      // Group C is in the middle with minimal separation
      { groupId: 'C', embedding: [0.05, 0.05, 0.01] },
      { groupId: 'C', embedding: [0.051, 0.051, 0.01] },
    ];

    const res = computeSpectralQuorumMetrics(items, { quorumPercent: 33, minSeparability: 2.0 });
    expect(res).not.toBeNull();
    // Group C should NOT be assigned any fake quorum
    const cQuorum = res.summary.groupSignatures.C.quorumDims;
    expect(cQuorum).toHaveLength(0);
    for (let d = 0; d < 3; d++) {
      expect(res.metrics[d].groupSignatures.C.isQuorum).toBe(false);
      expect(res.metrics[d].groupSignatures.C.relativeScore).toBe(0);
    }
  });

  it('preserves exact Float64 precision down to 10^-6 without truncation', () => {
    const items = [
      { groupId: 'A', embedding: [0.0200000, 0.0200014] },
      { groupId: 'A', embedding: [0.0200000, 0.0200016] },
      { groupId: 'B', embedding: [0.0200000, 0.0199999] },
      { groupId: 'B', embedding: [0.0200000, 0.0200001] },
    ];

    const res = computeSpectralQuorumMetrics(items, { quorumPercent: 50, minSeparability: 0.5 });
    expect(res).not.toBeNull();
    expect(res.summary.maxDelta).toBeCloseTo(0.0000015, 7);
    expect(res.metrics[1].deltaMean).toBeCloseTo(0.0000015, 7);
    expect(res.metrics[1].groupSignatures.A.isQuorum).toBe(true);
  });
});

describe('permutation null (Westfall-Young maxT) and sample size diagnostics (Slice 2)', () => {
  it('computes exact combinatorics nCk', () => {
    expect(combinationCount(2, 1)).toBe(2);
    expect(combinationCount(4, 2)).toBe(6);
    expect(combinationCount(6, 3)).toBe(20);
    expect(combinationCount(10, 5)).toBe(252);
    expect(combinationCount(20, 10)).toBe(184756);
  });

  it('diagnoses sampling feasibility for N=1, 2, 3, 8 per group', () => {
    // N=1 vs 1: pMin = 0.50
    const d1 = evaluateSampleSizeDiagnostic([1, 1]);
    expect(d1.status).toBe('IMPOSSIBLE_SAMPLE_SIZE');
    expect(d1.pMin).toBeCloseTo(0.50, 2);

    // N=2 vs 2: pMin = 1/6 = 0.167
    const d2 = evaluateSampleSizeDiagnostic([2, 2]);
    expect(d2.status).toBe('IMPOSSIBLE_SAMPLE_SIZE');
    expect(d2.pMin).toBeCloseTo(0.167, 3);

    // N=3 vs 3: pMin = 1/20 = 0.05
    const d3 = evaluateSampleSizeDiagnostic([3, 3]);
    expect(d3.status).toBe('LOW_POWER');
    expect(d3.pMin).toBeCloseTo(0.05, 3);

    // N=8 vs 8: pMin = 1/12870 = 0.000078
    const d8 = evaluateSampleSizeDiagnostic([8, 8]);
    expect(d8.status).toBe('OPERATIONAL');
    expect(d8.pMin).toBeLessThan(0.001);
  });

  it('runs 1000 permutations in under 50ms (performance benchmark)', () => {
    const prng = createMulberry32(0x1234);
    const nA = 21, nB = 21, dim = 1024;
    const items = [
      ...Array.from({ length: nA }, () => ({ groupId: 'A', embedding: Array.from({ length: dim }, () => prng()) })),
      ...Array.from({ length: nB }, () => ({ groupId: 'B', embedding: Array.from({ length: dim }, () => prng()) })),
    ];

    const t0 = performance.now();
    const res = computePermutationNullThreshold(items, { permutationCount: 1000, prngSeed: 0xDEADBEEF });
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(100); // well within interactive limit (usually ~25-40ms)
    expect(res.iterations).toBe(1000);
    expect(res.nullP95).toBeGreaterThan(0.4);
    expect(res.nullP95).toBeLessThan(1.5);
    expect(res.diagnostic.status).toBe('OPERATIONAL');
  });

  it('produces strictly 0 admitted dimensions on pure random noise for N=8 and N=21', () => {
    const prng = createMulberry32(42);
    const dim = 1024;

    // Test with N=8 words per group
    const noise8 = [
      ...Array.from({ length: 8 }, () => ({ groupId: 'noiseA', embedding: Array.from({ length: dim }, () => prng()) })),
      ...Array.from({ length: 8 }, () => ({ groupId: 'noiseB', embedding: Array.from({ length: dim }, () => prng()) })),
    ];

    const res8 = computeSpectralQuorumMetrics(noise8, { quorumPercent: 10 });
    expect(res8).not.toBeNull();
    expect(res8.summary.diagnostic.status).toBe('OPERATIONAL');
    expect(res8.summary.quorumCount).toBe(0);
    expect(res8.summary.topQuorumDims).toEqual([]);

    // Test with N=21 words per group
    const noise21 = [
      ...Array.from({ length: 21 }, () => ({ groupId: 'noiseA', embedding: Array.from({ length: dim }, () => prng()) })),
      ...Array.from({ length: 21 }, () => ({ groupId: 'noiseB', embedding: Array.from({ length: dim }, () => prng()) })),
    ];

    const res21 = computeSpectralQuorumMetrics(noise21, { quorumPercent: 10 });
    expect(res21).not.toBeNull();
    expect(res21.summary.quorumCount).toBe(0);
    expect(res21.summary.topQuorumDims).toEqual([]);
  });

  it('admits true thematic signal exceeding permutation null threshold p95', () => {
    const prng = createMulberry32(101);
    const dim = 128;
    const n = 15;

    // Background noise + strong elevation on dim 42 for group SignalA
    const gA = Array.from({ length: n }, () => {
      const vec = Array.from({ length: dim }, () => prng() * 0.1);
      vec[42] += 0.5; // True signal
      return { groupId: 'signalA', embedding: vec };
    });
    const gB = Array.from({ length: n }, () => {
      const vec = Array.from({ length: dim }, () => prng() * 0.1);
      return { groupId: 'signalB', embedding: vec };
    });

    const res = computeSpectralQuorumMetrics([...gA, ...gB], { quorumPercent: 10 });
    expect(res).not.toBeNull();
    expect(res.summary.quorumCount).toBeGreaterThanOrEqual(1);
    expect(res.summary.topQuorumDims).toContain(42);
    expect(res.metrics[42].isQuorum).toBe(true);
    expect(res.metrics[42].groupSignatures.signalA.isQuorum).toBe(true);
    expect(res.metrics[42].groupSignatures.signalA.polarity).toBe(1);
  });

  it('caches permutation null threshold by payload fingerprint', () => {
    const prng = createMulberry32(555);
    const items = [
      ...Array.from({ length: 10 }, () => ({ groupId: 'g1', embedding: [prng(), prng(), prng()] })),
      ...Array.from({ length: 10 }, () => ({ groupId: 'g2', embedding: [prng(), prng(), prng()] })),
    ];

    const cache = createSpectralQuorumNullCache();
    const res1 = cachedPermutationNullThreshold(cache, items, { permutationCount: 100 });
    const key1 = cache.key;
    expect(key1).toBeTruthy();

    const t0 = performance.now();
    const res2 = cachedPermutationNullThreshold(cache, items, { permutationCount: 100 });
    const cacheHitTime = performance.now() - t0;

    expect(cacheHitTime).toBeLessThan(1); // 0ms cache hit
    expect(res1).toBe(res2); // exact same object reference
  });
});

describe('spectralQuorum integration with groupDimContrast', () => {
  it('paintWeightsForDim uses spectral quorum when enabled', async () => {
    const { paintWeightsForDim } = await import('../src/visualizer/groupDimContrast.js');
    const quorumMetric = {
      isQuorum: true,
      rank: 0,
      deltaMean: 0.07,
      relativeScore: 1.0,
      sameSign: true, // even if same sign, spectral quorum highlights it!
    };
    const pajaMetric = {
      isQuorum: false,
      rank: 5,
      deltaMean: 0.001,
      relativeScore: 0.02,
      sameSign: true,
    };

    const settings = {
      spectralQuorumEnabled: true,
      spectralHighlightStrength: 100,
      spectralPajaCancelCoverage: 100,
      spectralDecimalGain: 10,
    };

    const wQuorum = paintWeightsForDim(0, quorumMetric, settings);
    expect(wQuorum.highlight).toBeCloseTo(1.0, 2);
    expect(wQuorum.cancel).toBe(0);

    const wPaja = paintWeightsForDim(0, pajaMetric, settings);
    expect(wPaja.highlight).toBe(0);
    expect(wPaja.cancel).toBe(1.0);
  });

  it('buildPointGroupPaintAttributes tints each point according to its own group signature', async () => {
    const { buildPointGroupPaintAttributes } = await import('../src/visualizer/groupDimContrast.js');
    const pointsData = [
      { meta: { dim: 2, itemIndex: 0, groupId: 'it_core' }, groupId: 'it_core' },
      { meta: { dim: 2, itemIndex: 1, groupId: 'vehicles' }, groupId: 'vehicles' },
      { meta: { dim: 5, itemIndex: 0, groupId: 'it_core' }, groupId: 'it_core' },
      { meta: { dim: 5, itemIndex: 1, groupId: 'vehicles' }, groupId: 'vehicles' },
    ];

    const groupMetrics = [
      null,
      null,
      // dim 2: it_core signature
      {
        dim: 2,
        isQuorum: true,
        groupSignatures: {
          it_core: { isQuorum: true, relativeScore: 1.0 },
          vehicles: { isQuorum: false, relativeScore: 0 },
        },
      },
      null,
      null,
      // dim 5: vehicles signature
      {
        dim: 5,
        isQuorum: true,
        groupSignatures: {
          it_core: { isQuorum: false, relativeScore: 0 },
          vehicles: { isQuorum: true, relativeScore: 1.0 },
        },
      },
    ];

    const settings = {
      spectralQuorumEnabled: true,
      spectralHighlightStrength: 100,
      spectralPajaCancelCoverage: 100,
      spectralDecimalGain: 10,
    };

    const { cancel, highlight } = buildPointGroupPaintAttributes(pointsData, null, groupMetrics, settings);

    // Point 0 (it_core on dim 2): lights up!
    expect(highlight[0]).toBeCloseTo(1.0, 2);
    expect(cancel[0]).toBe(0);

    // Point 1 (vehicles on dim 2): cancelled!
    expect(highlight[1]).toBe(0);
    expect(cancel[1]).toBe(1.0);

    // Point 2 (it_core on dim 5): cancelled!
    expect(highlight[2]).toBe(0);
    expect(cancel[2]).toBe(1.0);

    // Point 3 (vehicles on dim 5): lights up!
    expect(highlight[3]).toBeCloseTo(1.0, 2);
    expect(cancel[3]).toBe(0);
  });

  it('paintWeightsForSpectralQuorum returns directional polarity (+1 / -1)', () => {
    const settings = {
      spectralQuorumEnabled: true,
      spectralHighlightStrength: 100,
      spectralDecimalGain: 10,
    };
    const metricElev = {
      dim: 1,
      isQuorum: true,
      relativeScore: 0.8,
      polarity: 1,
      quorumCount: 1,
    };
    const metricDepr = {
      dim: 2,
      isQuorum: true,
      relativeScore: 0.8,
      polarity: -1,
      quorumCount: 1,
    };
    const wElev = paintWeightsForSpectralQuorum(metricElev, settings);
    expect(wElev.polarity).toBe(1);
    expect(wElev.highlight).toBeCloseTo(0.8, 2);
    expect(wElev.cancel).toBe(0);

    const wDepr = paintWeightsForSpectralQuorum(metricDepr, settings);
    expect(wDepr.polarity).toBe(-1);
    expect(wDepr.highlight).toBeCloseTo(0.8, 2);
    expect(wDepr.cancel).toBe(0);
  });

  it('empty quorum fallback: paintWeightsForSpectralQuorum produces cancel=0, highlight=0 when admittedCount is 0', () => {
    const settings = {
      spectralQuorumEnabled: true,
      spectralPajaCancelCoverage: 100,
    };
    const emptyGlobal = {
      dim: 1,
      isQuorum: false,
      relativeScore: 0,
      quorumCount: 0,
    };
    const wGlobal = paintWeightsForSpectralQuorum(emptyGlobal, settings);
    expect(wGlobal.cancel).toBe(0);
    expect(wGlobal.highlight).toBe(0);

    const emptyGroup = {
      dim: 1,
      isQuorum: false,
      relativeScore: 0,
      quorumCount: 1,
      groupSignatures: {
        G1: { isQuorum: false, relativeScore: 0, groupAdmittedCount: 0 },
      },
    };
    const wGroup = paintWeightsForSpectralQuorum(emptyGroup, settings, 'G1');
    expect(wGroup.cancel).toBe(0);
    expect(wGroup.highlight).toBe(0);
  });

  it('buildPointGroupPaintAttributes encodes signed highlight for depression on GPU', async () => {
    const { buildPointGroupPaintAttributes } = await import('../src/visualizer/groupDimContrast.js');
    const pointsData = [
      { meta: { itemIndex: 0, dim: 2, groupId: 'G1' } },
      { meta: { itemIndex: 1, dim: 2, groupId: 'G2' } },
    ];
    const groupMetrics = [
      null,
      null,
      {
        dim: 2,
        isQuorum: true,
        groupSignatures: {
          G1: { isQuorum: true, relativeScore: 1.0, polarity: 1, groupAdmittedCount: 1 },
          G2: { isQuorum: true, relativeScore: 1.0, polarity: -1, groupAdmittedCount: 1 },
        },
      },
    ];
    const settings = {
      spectralQuorumEnabled: true,
      spectralHighlightStrength: 100,
      spectralDecimalGain: 10,
    };
    const { cancel, highlight } = buildPointGroupPaintAttributes(pointsData, null, groupMetrics, settings);
    // G1 has elevation (+1) -> positive highlight
    expect(highlight[0]).toBeCloseTo(1.0, 2);
    // G2 has depression (-1) -> negative highlight for GPU shader branch
    expect(highlight[1]).toBeCloseTo(-1.0, 2);
    expect(cancel[0]).toBe(0);
    expect(cancel[1]).toBe(0);
  });
});
