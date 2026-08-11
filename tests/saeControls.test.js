import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SAE_SETTINGS,
  computeActivationMetrics,
  formatSaeTrainProgress,
  loadSaeSettings,
  resolveSaeSettings,
  saveSaeSettings,
} from '../src/ui/saeControlsDefaults.js';
import { saeControlsMarkup } from '../src/ui/SaeControls.js';
import {
  applySaeToCompare,
  cosineSimilarity,
  densifyTopKActivations,
} from '../src/core/saeReplace.js';

/**
 * WHATWG HTML number "step mismatch" check (approx.).
 * An invalid lr input inside #compare-form blocks type=submit Visualize
 * with no visible error when the params panel is hidden.
 */
function htmlNumberStepOk(value, min, step) {
  if (step === 'any' || step == null || step === '') return true;
  const v = Number(value);
  const m = Number(min);
  const s = Number(step);
  if (![v, m, s].every(Number.isFinite) || s <= 0) return false;
  const n = (v - m) / s;
  return Math.abs(n - Math.round(n)) < 1e-8;
}

describe('saeControlsDefaults', () => {
  it('default lr is valid for SAE markup min/step (HTML5 Visualize submit gate)', () => {
    const markup = saeControlsMarkup('cmp');
    const lrTag = markup.match(/id="cmp-sae-lr"[^>]*>/);
    expect(lrTag).toBeTruthy();
    const min = Number(/min="([^"]+)"/.exec(lrTag[0])?.[1]);
    const stepAttr = /step="([^"]+)"/.exec(lrTag[0])?.[1];
    expect(
      htmlNumberStepOk(DEFAULT_SAE_SETTINGS.lr, min, stepAttr),
      `lr=${DEFAULT_SAE_SETTINGS.lr} invalid for min=${min} step=${stepAttr} — blocks Compare Visualize submit`,
    ).toBe(true);
  });

  it('round-trips enabled + train params through localStorage', () => {
    const store = new Map();
    const storage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { store.delete(k); },
      key: (i) => [...store.keys()][i] ?? null,
      get length() { return store.size; },
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

  it('defaults are 8192 / k32 / 20ep and purge legacy poisoned keys', () => {
    expect(DEFAULT_SAE_SETTINGS.enabled).toBe(false);
    expect(DEFAULT_SAE_SETTINGS.hiddenDim).toBe(8192);
    expect(DEFAULT_SAE_SETTINGS.k).toBe(32);
    expect(DEFAULT_SAE_SETTINGS.epochs).toBe(20);
    expect(loadSaeSettings(null).enabled).toBe(false);

    const store = new Map([
      ['vl3d.sae.hiddenDim', '32'],
      ['vl3d.sae.k', '1'],
      ['vl3d.sae.epochs', '1'],
      ['vl3d.sae.enabled', 'true'],
    ]);
    const storage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { store.delete(k); },
      key: (i) => [...store.keys()][i] ?? null,
      get length() { return store.size; },
    };
    const loaded = loadSaeSettings(storage);
    expect(loaded.hiddenDim).toBe(8192);
    expect(loaded.k).toBe(32);
    expect(loaded.epochs).toBe(20);
    expect(loaded.enabled).toBe(false);
    expect(store.has('vl3d.sae.hiddenDim')).toBe(false);
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
