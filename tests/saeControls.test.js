import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SAE_SETTINGS,
  computeActivationMetrics,
  formatSaeTrainProgress,
  loadSaeSettings,
  resolveSaeSettings,
  saveSaeSettings,
} from '../src/ui/saeControlsDefaults.js';
import {
  applySaeToCompare,
  cosineSimilarity,
  densifyTopKActivations,
} from '../src/core/saeReplace.js';

describe('saeControlsDefaults', () => {
  it('round-trips enabled + train params through localStorage', () => {
    const store = new Map();
    const storage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { store.delete(k); },
    };

    const settings = resolveSaeSettings({
      enabled: true,
      hiddenDim: 4096,
      k: 16,
      epochs: 10,
      lr: 0.002,
      batchSize: 32,
    });
    saveSaeSettings(settings, storage);
    const loaded = loadSaeSettings(storage);
    expect(loaded.enabled).toBe(true);
    expect(loaded.hiddenDim).toBe(4096);
    expect(loaded.k).toBe(16);
    expect(loaded.epochs).toBe(10);
    expect(loaded.batchSize).toBe(32);
  });

  it('defaults enabled=false', () => {
    expect(DEFAULT_SAE_SETTINGS.enabled).toBe(false);
    expect(loadSaeSettings(null).enabled).toBe(false);
  });

  it('computes L0 / sparsity from sparse rows', () => {
    const acts = [
      [1, 0, 0, 2],
      [0, 0, 3, 0],
    ];
    const m = computeActivationMetrics(acts);
    expect(m.dim).toBe(4);
    expect(m.l0).toBe(1.5);
    expect(m.activeFeatures).toBe(3);
  });

  it('formats train progress with done / left / percent', () => {
    const mid = formatSaeTrainProgress({
      status: 'training',
      phase_key: 'training',
      message: 'Training epoch 13/50 — 38 remaining · last loss=0.012345',
      current_epoch: 12,
      total_epochs: 50,
      remaining_epochs: 38,
      percent: 24,
      n_vectors: 40,
      resolved_hidden: 160,
      resolved_k: 16,
    });
    expect(mid.busy).toBe(true);
    expect(mid.label).toContain('38 remaining');
    expect(mid.meta).toContain('12/50 done');
    expect(mid.meta).toContain('38 left');
    expect(mid.meta).toContain('24%');
    expect(mid.percent).toBe(24);

    const prep = formatSaeTrainProgress({
      status: 'training',
      phase_key: 'preparing',
      message: '',
      current_epoch: 0,
      total_epochs: 50,
    });
    expect(prep.label).toMatch(/Preparing/i);
    expect(prep.meta).toContain('0/50 done');
    expect(prep.meta).toContain('50 left');
    expect(prep.indeterminate).toBe(true);
  });
});

describe('saeReplace', () => {
  it('recomputes compare cosine_vs_first in SAE space', () => {
    const raw = {
      count: 2,
      items: [
        { id: 'tok_0', text: 'a', embedding: [1, 0] },
        { id: 'tok_1', text: 'b', embedding: [0, 1] },
      ],
    };
    const acts = [
      [1, 0, 0],
      [1, 0, 0],
    ];
    const next = applySaeToCompare(raw, acts);
    expect(next.items[0].cosine_vs_first).toBe(1);
    expect(next.items[1].cosine_vs_first).toBeCloseTo(1, 5);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it('densifies Top-K sparse encode payload', () => {
    const dense = densifyTopKActivations({
      format: 'topk_sparse',
      indices: [[0, 2], [1, 3]],
      values: [[1.5, 0.5], [2, 0]],
      dimension: 4,
      k: 2,
    });
    expect(dense).toEqual([
      [1.5, 0, 0.5, 0],
      [0, 2, 0, 0],
    ]);
  });
});
