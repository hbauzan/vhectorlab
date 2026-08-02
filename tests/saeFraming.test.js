import { describe, expect, it } from 'vitest';
import {
  RAW_EMBEDDING_DIM,
  computeDimSpanScale,
  inferRawDim,
  inferSaeDim,
} from '../src/core/saeFraming.js';
import { resolveSaeSettings } from '../src/ui/saeControlsDefaults.js';

describe('saeFraming', () => {
  it('scales pitch so 32 features span like 768', () => {
    expect(computeDimSpanScale(768, 32)).toBeCloseTo(24, 5);
    expect(computeDimSpanScale(768, 768)).toBe(1);
    expect(computeDimSpanScale(768, 8192)).toBe(1);
  });

  it('infers dims from arithmetic / compare payloads', () => {
    expect(inferRawDim({ vector_res: new Array(768).fill(0) })).toBe(768);
    expect(inferSaeDim({ vector_res: new Array(32).fill(0) })).toBe(32);
    expect(inferRawDim(null)).toBe(RAW_EMBEDDING_DIM);
    expect(inferSaeDim({ items: [{ embedding: [1, 2, 3] }] })).toBe(3);
  });
});

describe('sae train param clamp', () => {
  it('empty / zero hidden_dim and k fall back to product defaults (not min 32/1)', () => {
    const resolved = resolveSaeSettings({
      hiddenDim: '',
      k: 0,
      epochs: 50,
    });
    expect(resolved.hiddenDim).toBe(8192);
    expect(resolved.k).toBe(32);
  });
});
