import { describe, it, expect } from 'vitest';
import {
  signedUnit,
  sharedNoiseSimilarity,
  relativeDifference,
  oppositeConflictBalance,
  cancelAmountFromMetric,
  cancelFromRelDist,
  medianValue,
  hasGroupsForDimContrast,
  hasEnoughTokensForSharedNoise,
  computeDimRelationMetrics,
  computeSharedNoiseBatchMetrics,
  getPointRelDist,
  getPointCancel,
  createSharedNoiseCache,
  cachedSharedNoiseMetrics,
  paintWeightsForDim,
  applyGroupDimPaint,
  buildPointGroupPaintAttributes,
} from '../src/visualizer/groupDimContrast.js';

describe('groupDimContrast math', () => {
  it('signedUnit treats 0 as positive', () => {
    expect(signedUnit(0)).toBe(1);
    expect(signedUnit(0.002)).toBe(1);
    expect(signedUnit(-0.018)).toBe(-1);
  });

  it('sharedNoiseSimilarity is formula (b)', () => {
    expect(sharedNoiseSimilarity(0.002, 0.018)).toBeCloseTo(0.2, 5);
    expect(sharedNoiseSimilarity(0.1, 0.1)).toBeCloseTo(1, 5);
    expect(sharedNoiseSimilarity(0, 0)).toBe(1);
  });

  it('relativeDifference complements similarity on same magnitudes', () => {
    expect(relativeDifference(0.002, 0.018)).toBeCloseTo(0.8, 5);
    expect(relativeDifference(0.1, -0.1)).toBeCloseTo(1, 5);
  });

  it('cancelAmountFromMetric mirrors zero-coverage on high metric', () => {
    expect(cancelAmountFromMetric(0.4, 0)).toBe(0);
    expect(cancelAmountFromMetric(0.4, 0.5)).toBe(0);
    expect(cancelAmountFromMetric(0.75, 0.5)).toBeCloseTo(0.5, 5);
    expect(cancelAmountFromMetric(1, 0.5)).toBeCloseTo(1, 5);
    expect(cancelAmountFromMetric(0.5, 1)).toBeCloseTo(0.5, 5);
    expect(cancelAmountFromMetric(1, 1)).toBeCloseTo(1, 5);
  });

  it('medianValue is odd-middle / even-average', () => {
    expect(medianValue([0.1, 0.5, 0.9])).toBeCloseTo(0.5, 12);
    expect(medianValue([1, 2, 3, 4])).toBeCloseTo(2.5, 12);
    expect(medianValue([-0.7, 0.9, 0.9])).toBeCloseTo(0.9, 12);
    expect(medianValue([])).toBe(0);
  });
});

describe('cancelFromRelDist', () => {
  it('coverage 0 → cancel 0 for every relDist', () => {
    expect(cancelFromRelDist(0, 0)).toBe(0);
    expect(cancelFromRelDist(0.5, 0)).toBe(0);
    expect(cancelFromRelDist(1, 0)).toBe(0);
    expect(cancelFromRelDist(0, 1e-12)).toBe(0);
  });

  it('coverage 1 → cancel 1 including outlier (relDist=1)', () => {
    expect(cancelFromRelDist(0, 1)).toBe(1);
    expect(cancelFromRelDist(0.5, 1)).toBe(1);
    expect(cancelFromRelDist(1, 1)).toBe(1);
    expect(cancelFromRelDist(1, 1 - 1e-12)).toBe(1);
  });

  it('median (relDist→0) cancels before outlier at intermediate coverage', () => {
    const coverage = 0.4;
    const medianCancel = cancelFromRelDist(0, coverage);
    const edgeCancel = cancelFromRelDist(coverage, coverage);
    const outlierCancel = cancelFromRelDist(1, coverage);
    expect(medianCancel).toBe(1);
    expect(edgeCancel).toBeCloseTo(0.5, 5);
    expect(outlierCancel).toBe(0);
    expect(medianCancel).toBeGreaterThan(outlierCancel);
  });

  it('clamps to [0, 1]', () => {
    expect(cancelFromRelDist(-1, 0.5)).toBeGreaterThanOrEqual(0);
    expect(cancelFromRelDist(2, 0.5)).toBeLessThanOrEqual(1);
    expect(cancelFromRelDist(0, 2)).toBe(1);
  });
});

describe('computeDimRelationMetrics', () => {
  it('requires ≥2 groups', () => {
    expect(hasGroupsForDimContrast([{ groupId: 'G1', embedding: [1] }])).toBe(false);
    expect(computeDimRelationMetrics([{ groupId: 'G1', embedding: [1] }])).toEqual([]);
  });

  it('uses group means and classifies same vs opposite sign', () => {
    const items = [
      { groupId: 'G1', embedding: [0.002, 0.1, -0.05] },
      { groupId: 'G1', embedding: [0.002, 0.1, -0.05] },
      { groupId: 'G2', embedding: [0.018, -0.1, -0.05] },
      { groupId: 'G2', embedding: [0.018, -0.1, -0.05] },
    ];
    const m = computeDimRelationMetrics(items);
    expect(m).toHaveLength(3);
    expect(m[0].sameSign).toBe(true);
    expect(m[0].similarity).toBeCloseTo(0.2, 5);
    expect(m[1].sameSign).toBe(false);
    expect(m[1].difference).toBeCloseTo(1, 5);
    expect(m[2].sameSign).toBe(true);
    expect(m[2].similarity).toBeCloseTo(1, 5);
  });
});

describe('computeSharedNoiseBatchMetrics (median-distance)', () => {
  it('requires ≥2 equal-width embeddings', () => {
    expect(hasEnoughTokensForSharedNoise([{ embedding: [1] }])).toBe(false);
    expect(computeSharedNoiseBatchMetrics([{ embedding: [1] }])).toBeNull();
    expect(computeSharedNoiseBatchMetrics([
      { embedding: [1, 2] },
      { embedding: [1] },
    ])).toBeNull();
  });

  it('computes median / maxDist / relDist (groupId ignored)', () => {
    const items = [
      { groupId: 'G1', embedding: [0.10, 0.80] },
      { groupId: 'G1', embedding: [0.50, 0.80] },
      { groupId: 'G1', embedding: [0.90, 0.81] },
    ];
    expect(hasEnoughTokensForSharedNoise(items)).toBe(true);
    const m = computeSharedNoiseBatchMetrics(items);
    expect(m.itemCount).toBe(3);
    expect(m.dim).toBe(2);
    expect(m.median[0]).toBeCloseTo(0.50, 12);
    expect(m.maxDist[0]).toBeCloseTo(0.40, 12);
    expect(getPointRelDist(m, 1, 0)).toBeCloseTo(0, 12);
    expect(getPointRelDist(m, 0, 0)).toBeCloseTo(1, 12);
    expect(getPointRelDist(m, 2, 0)).toBeCloseTo(1, 12);
    expect(m.median[1]).toBeCloseTo(0.80, 12);
  });

  it('identical column → relDist 0 (no divide-by-zero)', () => {
    const items = [0, 0, 0].map((v) => ({ embedding: [v] }));
    const m = computeSharedNoiseBatchMetrics(items);
    expect(m.maxDist[0]).toBeLessThanOrEqual(1e-12);
    expect(getPointRelDist(m, 0, 0)).toBe(0);
    expect(getPointRelDist(m, 1, 0)).toBe(0);
    expect(getPointRelDist(m, 2, 0)).toBe(0);
  });

  it('mixed-sign outlier does not veto the dim (no same-sign gate)', () => {
    const items = [
      { groupId: 'happy', embedding: [0.90] },
      { groupId: 'sad', embedding: [0.90] },
      { groupId: 'angry', embedding: [-0.70] },
    ];
    const m = computeSharedNoiseBatchMetrics(items);
    expect(m.median[0]).toBeCloseTo(0.90, 12);
    expect(getPointRelDist(m, 0, 0)).toBeCloseTo(0, 12);
    expect(getPointRelDist(m, 1, 0)).toBeCloseTo(0, 12);
    expect(getPointRelDist(m, 2, 0)).toBeCloseTo(1, 12);
  });

  it('itemIndex is the original list index (skips holes without embeddings)', () => {
    const items = [
      { embedding: [0.90] },
      { embedding: [] },
      { embedding: [0.90] },
      { embedding: [-0.70] },
    ];
    const m = computeSharedNoiseBatchMetrics(items);
    expect(m.itemCount).toBe(4);
    expect(getPointRelDist(m, 0, 0)).toBeCloseTo(0, 12);
    expect(getPointRelDist(m, 1, 0)).toBe(0);
    expect(getPointRelDist(m, 2, 0)).toBeCloseTo(0, 12);
    expect(getPointRelDist(m, 3, 0)).toBeCloseTo(1, 12);
  });
});

describe('getPointCancel (per-point, coverage knob)', () => {
  const mixed = () => computeSharedNoiseBatchMetrics([
    { embedding: [0.90] },
    { embedding: [0.90] },
    { embedding: [-0.70] },
  ]);

  it('knob 0.0 → all cancel = 0.0', () => {
    const m = mixed();
    expect(getPointCancel(m, 0, 0, 0)).toBe(0);
    expect(getPointCancel(m, 1, 0, 0)).toBe(0);
    expect(getPointCancel(m, 2, 0, 0)).toBe(0);
  });

  it('knob 1.0 → all cancel = 1.0 including outlier', () => {
    const m = mixed();
    expect(getPointCancel(m, 0, 0, 1)).toBe(1);
    expect(getPointCancel(m, 1, 0, 1)).toBe(1);
    expect(getPointCancel(m, 2, 0, 1)).toBe(1);
  });

  it('median token cancels before outlier at intermediate knob', () => {
    const m = mixed();
    const coverage = 0.5;
    const near = getPointCancel(m, 0, 0, coverage);
    const outlier = getPointCancel(m, 2, 0, coverage);
    expect(near).toBeGreaterThan(0.5);
    expect(outlier).toBe(0);
  });

  it('behavior is consistent regardless of dimension sign', () => {
    const pos = computeSharedNoiseBatchMetrics([
      { embedding: [0.90] },
      { embedding: [0.90] },
      { embedding: [-0.70] },
    ]);
    const neg = computeSharedNoiseBatchMetrics([
      { embedding: [-0.90] },
      { embedding: [-0.90] },
      { embedding: [0.70] },
    ]);
    const c = 0.45;
    expect(getPointCancel(pos, 0, 0, c)).toBeCloseTo(getPointCancel(neg, 0, 0, c), 12);
    expect(getPointCancel(pos, 2, 0, c)).toBeCloseTo(getPointCancel(neg, 2, 0, c), 12);
    expect(getPointRelDist(pos, 2, 0)).toBeCloseTo(getPointRelDist(neg, 2, 0), 12);
  });

  it('SAE active → cancel 0 even at coverage 1', () => {
    const m = mixed();
    expect(getPointCancel(m, 0, 0, 1, { isSaeActive: true })).toBe(0);
    expect(getPointCancel(m, 2, 0, 1, { isSaeActive: true })).toBe(0);
  });
});

describe('shared-noise cache', () => {
  it('reuses metrics for the same embeddings; recomputes when values change', () => {
    const items = [
      { embedding: [0.1, 0.2] },
      { embedding: [0.3, 0.4] },
    ];
    const cache = createSharedNoiseCache();
    const a = cachedSharedNoiseMetrics(cache, items);
    const b = cachedSharedNoiseMetrics(cache, items);
    expect(a).not.toBeNull();
    expect(b).toBe(a);

    items[1].embedding[0] = 0.99;
    const c = cachedSharedNoiseMetrics(cache, items);
    expect(c).not.toBe(a);
    expect(c.median[0]).not.toBeCloseTo(a.median[0], 8);
  });
});

describe('paintWeightsForDim / applyGroupDimPaint', () => {
  it('shared-noise cancel uses per-point amount, not group same-sign', () => {
    const group = {
      meanA: 0.1,
      meanB: -0.1,
      sameSign: false,
      similarity: 0,
      difference: 1,
      conflictBalance: 1,
    };
    expect(paintWeightsForDim(0.9, group, {
      sameSignCancelEnabled: false,
      sameSignCancelCoverage: 90,
    })).toEqual({ cancel: 0, highlight: 0 });

    const on = paintWeightsForDim(0.9, null, {
      sameSignCancelEnabled: true,
      sameSignCancelCoverage: 90,
    });
    expect(on.cancel).toBeCloseTo(0.9, 5);
    expect(on.highlight).toBe(0);

    const groupOnly = paintWeightsForDim(0, {
      meanA: 0.1,
      meanB: 0.1,
      sameSign: true,
      similarity: 1,
      difference: 0,
    }, { sameSignCancelEnabled: true, sameSignCancelCoverage: 90 });
    expect(groupOnly.cancel).toBe(0);
  });

  it('SAE lockout zeros shared cancel in paint weights', () => {
    const w = paintWeightsForDim(1, null, {
      sameSignCancelEnabled: true,
      sameSignCancelCoverage: 100,
      isSaeActive: true,
    });
    expect(w.cancel).toBe(0);
  });

  it('opposite highlight still uses GROUP metric', () => {
    const group = {
      meanA: 0.1,
      meanB: -0.1,
      sameSign: false,
      similarity: 0,
      difference: 1,
      conflictBalance: 1,
    };
    const w = paintWeightsForDim(0, group, {
      oppositeHighlightEnabled: true,
      oppositeHighlightStrength: 50,
      oppositeCancelCoverage: 0,
    });
    expect(w.highlight).toBeCloseTo(0.5, 5);
    expect(w.cancel).toBe(0);
  });

  it('conflict cover fades opposite dims linearly (not all-or-nothing)', () => {
    const group = {
      meanA: 0.1,
      meanB: -0.1,
      sameSign: false,
      similarity: 0,
      difference: 1,
      conflictBalance: 1,
    };
    const at0 = paintWeightsForDim(0, group, {
      oppositeHighlightEnabled: true,
      oppositeHighlightStrength: 100,
      oppositeCancelCoverage: 0,
    });
    expect(at0.cancel).toBe(0);
    expect(at0.highlight).toBeCloseTo(1, 5);

    const at45 = paintWeightsForDim(0, group, {
      oppositeHighlightEnabled: true,
      oppositeHighlightStrength: 100,
      oppositeCancelCoverage: 45,
    });
    expect(at45.cancel).toBeCloseTo(0.5, 5);
    expect(at45.highlight).toBeCloseTo(1, 5);

    const at90 = paintWeightsForDim(0, group, {
      oppositeHighlightEnabled: true,
      oppositeHighlightStrength: 100,
      oppositeCancelCoverage: 90,
    });
    expect(at90.cancel).toBeCloseTo(1, 5);
  });

  it('oppositeConflictBalance is 1 for equal mags, lower when unbalanced', () => {
    expect(oppositeConflictBalance(0.1, -0.1)).toBeCloseTo(1, 5);
    expect(oppositeConflictBalance(0.1, -0.01)).toBeCloseTo(2 * 0.01 / 0.11, 5);
  });

  it('replaces toward highlight then blackens', () => {
    const base = { r: 1, g: 1, b: 0, alpha: 1 };
    const group = {
      meanA: 1,
      meanB: -1,
      sameSign: false,
      similarity: 0,
      difference: 1,
    };
    const painted = applyGroupDimPaint(
      base,
      0,
      group,
      {
        oppositeHighlightEnabled: true,
        oppositeHighlightStrength: 100,
        oppositeCancelCoverage: 0,
        oppositeHighlightColor: '#00E5FF',
      },
      { r: 0, g: 0, b: 0 },
      { r: 0, g: 229 / 255, b: 1 }
    );
    expect(painted.r).toBeCloseTo(0, 5);
    expect(painted.b).toBeCloseTo(1, 5);
  });

  it('buildPointGroupPaintAttributes: per-item cancel + group highlight', () => {
    const items = [
      { groupId: 'G1', embedding: [0.90, -0.1] },
      { groupId: 'G2', embedding: [0.90, 0.1] },
      { groupId: 'G3', embedding: [-0.70, 0.0] },
    ];
    const metrics = computeSharedNoiseBatchMetrics(items);
    const groupMetrics = computeDimRelationMetrics(items);
    const points = [
      { meta: { itemIndex: 0, dim: 0 } },
      { meta: { itemIndex: 2, dim: 0 } },
      { meta: { itemIndex: 0, dim: 1 } },
    ];
    const { cancel, highlight } = buildPointGroupPaintAttributes(
      points,
      metrics,
      groupMetrics,
      {
        sameSignCancelEnabled: true,
        sameSignCancelCoverage: 50,
        oppositeHighlightEnabled: true,
        oppositeHighlightStrength: 100,
        oppositeCancelCoverage: 0,
      }
    );
    expect(cancel[0]).toBeGreaterThan(0.5);
    expect(cancel[1]).toBe(0);
    expect(highlight[2]).toBeGreaterThan(0.5);
  });

  it('3-group mixed-sign: median tokens cancel, outlier waits for 100%', () => {
    const items = [
      { groupId: 'G1', embedding: [0.80] },
      { groupId: 'G2', embedding: [0.80] },
      { groupId: 'G3', embedding: [-0.90] },
    ];
    const metrics = computeSharedNoiseBatchMetrics(items);
    expect(getPointCancel(metrics, 0, 0, 0.5)).toBeGreaterThan(0.5);
    expect(getPointCancel(metrics, 2, 0, 0.5)).toBe(0);
    expect(getPointCancel(metrics, 2, 0, 1)).toBe(1);
  });
});
