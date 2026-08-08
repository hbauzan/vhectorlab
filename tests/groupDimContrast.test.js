import { describe, it, expect } from 'vitest';
import {
  signedUnit,
  sharedNoiseSimilarity,
  relativeDifference,
  oppositeConflictBalance,
  cancelAmountFromMetric,
  hasGroupsForDimContrast,
  computeDimRelationMetrics,
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

describe('paintWeightsForDim / applyGroupDimPaint', () => {
  it('same-sign cancel only when enabled', () => {
    const metric = {
      meanA: 0.1,
      meanB: 0.1,
      sameSign: true,
      similarity: 1,
      difference: 0,
    };
    expect(paintWeightsForDim(metric, { sameSignCancelEnabled: false, sameSignCancelCoverage: 90 })).toEqual({
      cancel: 0,
      highlight: 0,
    });
    const on = paintWeightsForDim(metric, { sameSignCancelEnabled: true, sameSignCancelCoverage: 90 });
    expect(on.cancel).toBeGreaterThan(0.9);
    expect(on.highlight).toBe(0);
  });

  it('opposite highlight scales by strength × conflict balance', () => {
    const metric = {
      meanA: 0.1,
      meanB: -0.1,
      sameSign: false,
      similarity: 0,
      difference: 1,
      conflictBalance: 1,
    };
    const w = paintWeightsForDim(metric, {
      oppositeHighlightEnabled: true,
      oppositeHighlightStrength: 50,
      oppositeCancelCoverage: 0,
    });
    expect(w.highlight).toBeCloseTo(0.5, 5);
    expect(w.cancel).toBe(0);
  });

  it('conflict cover fades opposite dims linearly (not all-or-nothing)', () => {
    const metric = {
      meanA: 0.1,
      meanB: -0.1,
      sameSign: false,
      similarity: 0,
      difference: 1,
      conflictBalance: 1,
    };
    const at0 = paintWeightsForDim(metric, {
      oppositeHighlightEnabled: true,
      oppositeHighlightStrength: 100,
      oppositeCancelCoverage: 0,
    });
    expect(at0.cancel).toBe(0);
    expect(at0.highlight).toBeCloseTo(1, 5);

    const at45 = paintWeightsForDim(metric, {
      oppositeHighlightEnabled: true,
      oppositeHighlightStrength: 100,
      oppositeCancelCoverage: 45,
    });
    expect(at45.cancel).toBeCloseTo(0.5, 5);
    expect(at45.highlight).toBeCloseTo(1, 5);

    const at90 = paintWeightsForDim(metric, {
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
    const metric = {
      meanA: 1,
      meanB: -1,
      sameSign: false,
      similarity: 0,
      difference: 1,
    };
    const painted = applyGroupDimPaint(
      base,
      metric,
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

  it('buildPointGroupPaintAttributes uses meta.dim', () => {
    const metrics = computeDimRelationMetrics([
      { groupId: 'G1', embedding: [0.1, -0.1] },
      { groupId: 'G2', embedding: [0.1, 0.1] },
    ]);
    const points = [
      { meta: { dim: 0 } },
      { meta: { dim: 1 } },
    ];
    const { cancel, highlight } = buildPointGroupPaintAttributes(points, metrics, {
      sameSignCancelEnabled: true,
      sameSignCancelCoverage: 90,
      oppositeHighlightEnabled: true,
      oppositeHighlightStrength: 100,
      oppositeCancelCoverage: 0,
    });
    expect(cancel[0]).toBeGreaterThan(0.5); // same-sign dim0
    expect(highlight[0]).toBe(0);
    expect(highlight[1]).toBeGreaterThan(0.5); // opposite dim1
  });
});
