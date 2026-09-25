import { describe, it, expect } from 'vitest';
import {
  hasEnoughGroupsForSpectralQuorum,
  computeSpectralQuorumMetrics,
  paintWeightsForSpectralQuorum,
} from '../src/visualizer/spectralQuorum.js';

describe('spectralQuorum math and classification', () => {
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
    // In ddi-fw, top 10% of 10 dims = ceil(0.10 * 10) = 1 dimension is Quorum.
    // Let dim4 have the largest separation: python=0.08, receta=0.01 (delta = 0.07).
    // All other dims have tiny delta <= 0.005.
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

    const result = computeSpectralQuorumMetrics(items, { quorumPercent: 10 });
    expect(result).not.toBeNull();
    expect(result.metrics).toHaveLength(10);
    expect(result.summary.quorumCount).toBe(1); // ceil(10 * 0.1) = 1
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
      { groupId: 'B', embedding: [0.00, 0.00, 0.00, 0.00, 0.00] },
    ];
    // 5 dims, 20% quorum => ceil(5 * 0.2) = 1 dim (dim0).
    // 40% quorum => ceil(5 * 0.4) = 2 dims (dim0, dim2).
    const res20 = computeSpectralQuorumMetrics(items, { quorumPercent: 20 });
    expect(res20.summary.quorumCount).toBe(1);
    expect(res20.summary.topQuorumDims).toEqual([0]);

    const res40 = computeSpectralQuorumMetrics(items, { quorumPercent: 40 });
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

    const res = computeSpectralQuorumMetrics(items, { quorumPercent: 10 });
    expect(res).not.toBeNull();
    const gSig = res.summary.groupSignatures;
    expect(gSig).toBeDefined();

    // Verify per-group quorum dimensions are directional and non-overlapping
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

  it('accurately resolves subtle 4th to 6th decimal variations (order 10^-5)', () => {
    // 2 groups where difference is in the 5th decimal place (0.000040)
    const items = [
      { groupId: 'alpha', embedding: [0.020000, 0.020050] },
      { groupId: 'beta',  embedding: [0.020000, 0.020010] },
    ];

    const res = computeSpectralQuorumMetrics(items, { quorumPercent: 50 });
    expect(res).not.toBeNull();
    expect(res.summary.maxDelta).toBeCloseTo(0.000040, 6);
    expect(res.metrics[1].deltaMean).toBeCloseTo(0.000040, 6);

    // Alpha leads on dim 1, beta leads on dim 0 (or delta <= 0)
    expect(res.metrics[1].groupSignatures.alpha.isQuorum).toBe(true);
    expect(res.metrics[1].groupSignatures.alpha.relativeScore).toBeCloseTo(1.0, 2);
    expect(res.metrics[1].groupSignatures.beta.isQuorum).toBe(false);

    // Paint weights with 10x gain: alpha lights up on dim 1, beta cancels
    const settings = {
      spectralQuorumEnabled: true,
      spectralHighlightStrength: 100,
      spectralPajaCancelCoverage: 100,
      spectralDecimalGain: 10,
    };
    const wAlpha = paintWeightsForSpectralQuorum(res.metrics[1], settings, 'alpha');
    const wBeta = paintWeightsForSpectralQuorum(res.metrics[1], settings, 'beta');
    expect(wAlpha.highlight).toBeCloseTo(1.0, 2);
    expect(wAlpha.cancel).toBe(0);
    expect(wBeta.highlight).toBe(0);
    expect(wBeta.cancel).toBe(1.0);
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
});


