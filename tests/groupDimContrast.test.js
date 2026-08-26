import { describe, it, expect } from 'vitest';
import {
  signedUnit,
  sharedNoiseSimilarity,
  relativeDifference,
  oppositeConflictBalance,
  cancelAmountFromMetric,
  hasGroupsForDimContrast,
  hasEnoughTokensForSharedNoise,
  computeDimRelationMetrics,
  computeTokenSharedNoiseMetrics,
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
    // a=0.002, b=0.018 → 1 - 0.016/0.020 = 0.2
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
    expect(cancelAmountFromMetric(0.4, 0.5)).toBe(0); // floor=0.5
    expect(cancelAmountFromMetric(0.75, 0.5)).toBeCloseTo(0.5, 5);
    expect(cancelAmountFromMetric(1, 0.5)).toBeCloseTo(1, 5);
    expect(cancelAmountFromMetric(0.5, 1)).toBeCloseTo(0.5, 5);
    expect(cancelAmountFromMetric(1, 1)).toBeCloseTo(1, 5);
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

describe('computeTokenSharedNoiseMetrics', () => {
  it('requires ≥2 equal-width embeddings', () => {
    expect(hasEnoughTokensForSharedNoise([{ embedding: [1] }])).toBe(false);
    expect(computeTokenSharedNoiseMetrics([{ embedding: [1] }])).toEqual([]);
    expect(computeTokenSharedNoiseMetrics([
      { embedding: [1, 2] },
      { embedding: [1] },
    ])).toEqual([]);
  });

  it('computes with 1 group (ignores groupId)', () => {
    const items = [
      { groupId: 'G1', embedding: [0.80, 0.10] },
      { groupId: 'G1', embedding: [0.80, 0.50] },
      { groupId: 'G1', embedding: [0.81, 0.90] },
    ];
    expect(hasEnoughTokensForSharedNoise(items)).toBe(true);
    const m = computeTokenSharedNoiseMetrics(items);
    expect(m).toHaveLength(2);
    expect(m[0].sameSign).toBe(true);
    expect(m[0].similarity).toBeCloseTo(sharedNoiseSimilarity(0.80, 0.81), 5);
    expect(m[1].similarity).toBeCloseTo(0.2, 5); // min 0.10 max 0.90
  });

  it('uses all tokens across 3 groups (G3 outlier blocks high sim)', () => {
    const items = [
      { groupId: 'happy', embedding: [0.80] },
      { groupId: 'sad', embedding: [0.80] },
      { groupId: 'angry', embedding: [-0.90] },
    ];
    const m = computeTokenSharedNoiseMetrics(items);
    expect(m).toHaveLength(1);
    expect(m[0].sameSign).toBe(false);
    expect(m[0].similarity).toBeCloseTo(0, 1);
  });

  it('locks worked examples (§3.3)', () => {
    const batch = (vals) => vals.map((v) => ({ embedding: [v] }));
    const near = computeTokenSharedNoiseMetrics(batch([0.80, 0.80, 0.81]));
    expect(near[0].sameSign).toBe(true);
    expect(near[0].similarity).toBeGreaterThan(0.98);

    const zeros = computeTokenSharedNoiseMetrics(batch([0, 0, 0]));
    expect(zeros[0].similarity).toBe(1);
    expect(zeros[0].sameSign).toBe(true);

    const spread = computeTokenSharedNoiseMetrics(batch([0.10, 0.50, 0.90]));
    expect(spread[0].similarity).toBeCloseTo(0.2, 5);

    const mixed = computeTokenSharedNoiseMetrics(batch([0.90, 0.90, -0.70]));
    expect(mixed[0].sameSign).toBe(false);
    expect(mixed[0].similarity).toBeCloseTo(0, 1);
  });
});

describe('paintWeightsForDim / applyGroupDimPaint', () => {
  it('same-sign cancel reads TOKEN metric only', () => {
    const token = {
      min: 0.1,
      max: 0.1,
      sameSign: true,
      similarity: 1,
    };
    const group = {
      meanA: 0.1,
      meanB: -0.1,
      sameSign: false,
      similarity: 0,
      difference: 1,
      conflictBalance: 1,
    };
    expect(paintWeightsForDim(token, group, {
      sameSignCancelEnabled: false,
      sameSignCancelCoverage: 90,
    })).toEqual({ cancel: 0, highlight: 0 });

    const on = paintWeightsForDim(token, null, {
      sameSignCancelEnabled: true,
      sameSignCancelCoverage: 90,
    });
    expect(on.cancel).toBeGreaterThan(0.9);
    expect(on.highlight).toBe(0);

    // Group same-sign must NOT drive cancel when token metric is absent / mixed
    const groupOnly = paintWeightsForDim(null, {
      meanA: 0.1,
      meanB: 0.1,
      sameSign: true,
      similarity: 1,
      difference: 0,
    }, { sameSignCancelEnabled: true, sameSignCancelCoverage: 90 });
    expect(groupOnly.cancel).toBe(0);
  });

  it('mixed-sign token metric → cancel 0 even at high coverage', () => {
    const token = {
      min: 0.9,
      max: -0.7,
      sameSign: false,
      similarity: 0,
    };
    const w = paintWeightsForDim(token, null, {
      sameSignCancelEnabled: true,
      sameSignCancelCoverage: 90,
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
    const w = paintWeightsForDim(null, group, {
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
    const at0 = paintWeightsForDim(null, group, {
      oppositeHighlightEnabled: true,
      oppositeHighlightStrength: 100,
      oppositeCancelCoverage: 0,
    });
    expect(at0.cancel).toBe(0);
    expect(at0.highlight).toBeCloseTo(1, 5);

    const at45 = paintWeightsForDim(null, group, {
      oppositeHighlightEnabled: true,
      oppositeHighlightStrength: 100,
      oppositeCancelCoverage: 45,
    });
    expect(at45.cancel).toBeCloseTo(0.5, 5);
    expect(at45.highlight).toBeCloseTo(1, 5);

    const at90 = paintWeightsForDim(null, group, {
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
      null,
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

  it('buildPointGroupPaintAttributes: cancel=token, highlight=group', () => {
    const items = [
      { groupId: 'G1', embedding: [0.1, -0.1] },
      { groupId: 'G2', embedding: [0.1, 0.1] },
    ];
    const tokenMetrics = computeTokenSharedNoiseMetrics(items);
    const groupMetrics = computeDimRelationMetrics(items);
    const points = [
      { meta: { dim: 0 } },
      { meta: { dim: 1 } },
    ];
    const { cancel, highlight } = buildPointGroupPaintAttributes(
      points,
      tokenMetrics,
      groupMetrics,
      {
        sameSignCancelEnabled: true,
        sameSignCancelCoverage: 90,
        oppositeHighlightEnabled: true,
        oppositeHighlightStrength: 100,
        oppositeCancelCoverage: 0,
      }
    );
    expect(cancel[0]).toBeGreaterThan(0.5); // same-sign across tokens dim0
    expect(highlight[0]).toBe(0);
    expect(highlight[1]).toBeGreaterThan(0.5); // opposite G1↔G2 dim1
  });

  it('3-group outlier: token cancel stays 0 while G1↔G2 would have cancelled', () => {
    const items = [
      { groupId: 'G1', embedding: [0.80] },
      { groupId: 'G2', embedding: [0.80] },
      { groupId: 'G3', embedding: [-0.90] },
    ];
    const token = computeTokenSharedNoiseMetrics(items)[0];
    const group = computeDimRelationMetrics(items)[0];
    expect(group.sameSign).toBe(true);
    expect(group.similarity).toBeCloseTo(1, 5);
    expect(token.sameSign).toBe(false);

    const w = paintWeightsForDim(token, group, {
      sameSignCancelEnabled: true,
      sameSignCancelCoverage: 90,
    });
    expect(w.cancel).toBe(0);
  });
});
