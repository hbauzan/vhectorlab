import { describe, it, expect } from 'vitest';
import {
  COVERAGE_A_MIN,
  COVERAGE_A_MAX,
  COVERAGE_MA_MIN,
  COVERAGE_MA_MAX,
  COVERAGE_MA_STEP,
  COVERAGE_KNOB_PX_PER_A,
  COVERAGE_KNOB_PX_PER_MA_STEP,
  decomposeCoveragePercent,
  composeCoveragePercent,
  coverageKnobAngleDeg,
  coverageKnobValueDeltaFromDy,
  COVERAGE_KNOB_ANGLE_MIN,
  COVERAGE_KNOB_ANGLE_MAX,
} from '../src/ui/coverageAmKnobs.js';
import {
  HIGH_COVERAGE_MIN,
  HIGH_COVERAGE_MAX,
  normalizeHighCoverage,
} from '../src/ui/visualizationControlsDefaults.js';

describe('decomposeCoveragePercent', () => {
  it('maps 100 → A100 / mA0', () => {
    expect(decomposeCoveragePercent(100)).toEqual({ a: 100, mA: 0 });
  });

  it('maps 99.9 → A99 / mA0.9', () => {
    expect(decomposeCoveragePercent(99.9)).toEqual({ a: 99, mA: 0.9 });
  });

  it('maps 30 → A30 / mA0', () => {
    expect(decomposeCoveragePercent(30)).toEqual({ a: 30, mA: 0 });
  });

  it('maps 55.5 → A55 / mA0.5', () => {
    expect(decomposeCoveragePercent(55.5)).toEqual({ a: 55, mA: 0.5 });
  });

  it('clamps before decompose', () => {
    expect(decomposeCoveragePercent(10)).toEqual({ a: 30, mA: 0 });
    expect(decomposeCoveragePercent(150)).toEqual({ a: 100, mA: 0 });
  });
});

describe('composeCoveragePercent', () => {
  it('round-trips worked examples', () => {
    expect(composeCoveragePercent(100, 0)).toBe(100);
    expect(composeCoveragePercent(99, 0.9)).toBeCloseTo(99.9, 5);
    expect(composeCoveragePercent(30, 0)).toBe(30);
  });

  it('mA adjust at A100 forces A down to 99 (usable tenths)', () => {
    const v = composeCoveragePercent(100, 0.7, { fromMilli: true });
    expect(v).toBeCloseTo(99.7, 5);
    expect(decomposeCoveragePercent(v)).toEqual({ a: 99, mA: 0.7 });
  });

  it('A100 + mA0 without fromMilli stays 100', () => {
    expect(composeCoveragePercent(100, 0)).toBe(100);
    expect(composeCoveragePercent(100, 0.7)).toBe(100);
    expect(decomposeCoveragePercent(100)).toEqual({ a: 100, mA: 0 });
  });

  it('least-effort clamp at bottom: A29 + mA0.9 → 30', () => {
    const v = composeCoveragePercent(29, 0.9);
    expect(v).toBe(HIGH_COVERAGE_MIN);
    expect(decomposeCoveragePercent(v)).toEqual({ a: 30, mA: 0 });
  });

  it('snaps mA to tenths', () => {
    expect(composeCoveragePercent(40, 0.34)).toBeCloseTo(40.3, 5);
    expect(composeCoveragePercent(40, 0.36)).toBeCloseTo(40.4, 5);
  });

  it('A/mA ranges cover 30…100', () => {
    expect(COVERAGE_A_MIN).toBe(30);
    expect(COVERAGE_A_MAX).toBe(100);
    expect(COVERAGE_MA_MIN).toBe(0);
    expect(COVERAGE_MA_MAX).toBe(0.9);
    expect(COVERAGE_MA_STEP).toBe(0.1);
  });

  it('compose then normalize stays in high-coverage band', () => {
    for (let a = COVERAGE_A_MIN; a <= COVERAGE_A_MAX; a += 10) {
      for (let t = 0; t <= 9; t++) {
        const mA = t * COVERAGE_MA_STEP;
        const v = composeCoveragePercent(a, mA, { fromMilli: true });
        expect(v).toBeGreaterThanOrEqual(HIGH_COVERAGE_MIN);
        expect(v).toBeLessThanOrEqual(HIGH_COVERAGE_MAX);
        expect(v).toBe(normalizeHighCoverage(v));
      }
    }
  });
});

describe('coverageKnobAngleDeg', () => {
  it('maps endpoints of a range to dial sweep', () => {
    expect(coverageKnobAngleDeg(30, 30, 100)).toBe(COVERAGE_KNOB_ANGLE_MIN);
    expect(coverageKnobAngleDeg(100, 30, 100)).toBe(COVERAGE_KNOB_ANGLE_MAX);
    expect(coverageKnobAngleDeg(0, 0, 0.9)).toBe(COVERAGE_KNOB_ANGLE_MIN);
    expect(coverageKnobAngleDeg(0.9, 0, 0.9)).toBe(COVERAGE_KNOB_ANGLE_MAX);
  });

  it('midpoint is halfway angle', () => {
    const mid = (COVERAGE_KNOB_ANGLE_MIN + COVERAGE_KNOB_ANGLE_MAX) / 2;
    expect(coverageKnobAngleDeg(65, 30, 100)).toBeCloseTo(mid, 5);
  });
});

describe('coverageKnob drag throw (DAW vertical)', () => {
  it('exposes long pixel throws (grip, not short face travel)', () => {
    expect(COVERAGE_KNOB_PX_PER_A).toBeGreaterThanOrEqual(12);
    expect(COVERAGE_KNOB_PX_PER_MA_STEP).toBeGreaterThanOrEqual(24);
    // Full A span needs a long drag
    const aThrow = (COVERAGE_A_MAX - COVERAGE_A_MIN) * COVERAGE_KNOB_PX_PER_A;
    expect(aThrow).toBeGreaterThanOrEqual(800);
    const maThrow = 9 * COVERAGE_KNOB_PX_PER_MA_STEP;
    expect(maThrow).toBeGreaterThanOrEqual(200);
  });

  it('pointer up (negative dy) increases value', () => {
    expect(coverageKnobValueDeltaFromDy(-COVERAGE_KNOB_PX_PER_A, COVERAGE_KNOB_PX_PER_A)).toBeCloseTo(1, 5);
    expect(coverageKnobValueDeltaFromDy(COVERAGE_KNOB_PX_PER_A, COVERAGE_KNOB_PX_PER_A)).toBeCloseTo(-1, 5);
  });

  it('accumulates fractional drag before snap', () => {
    let acc = 50;
    acc += coverageKnobValueDeltaFromDy(-COVERAGE_KNOB_PX_PER_A / 2, COVERAGE_KNOB_PX_PER_A);
    expect(acc).toBeCloseTo(50.5, 5);
    acc += coverageKnobValueDeltaFromDy(-COVERAGE_KNOB_PX_PER_A / 2, COVERAGE_KNOB_PX_PER_A);
    expect(Math.round(acc)).toBe(51);
  });
});
