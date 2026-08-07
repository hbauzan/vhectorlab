import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ARITHMETIC_SETTINGS,
  ARITHMETIC_STORAGE_KEYS,
  resolveArithmeticSettings,
  loadArithmeticSettings,
  saveArithmeticSettings,
  clearArithmeticSettings,
  normalizeLastResult,
  formatOnlineStatusLabel,
} from '../src/ui/arithmeticDefaults.js';

function mockStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    _map: map,
  };
}

const sampleResult = {
  vector_res: [0.1, 0.2],
  results: [{ word: 'queen', score: 0.9 }],
  components: { vec_a: [1], vec_b: [0], vec_c: [0] },
};

describe('arithmeticDefaults', () => {
  it('defaults are king − man + woman', () => {
    expect(DEFAULT_ARITHMETIC_SETTINGS.wordA).toBe('king');
    expect(DEFAULT_ARITHMETIC_SETTINGS.wordB).toBe('man');
    expect(DEFAULT_ARITHMETIC_SETTINGS.wordC).toBe('woman');
    expect(DEFAULT_ARITHMETIC_SETTINGS.topK).toBe(10);
    expect(DEFAULT_ARITHMETIC_SETTINGS.lastResult).toBeNull();
  });

  it('resolveArithmeticSettings clamps topK and trims words', () => {
    const r = resolveArithmeticSettings({
      wordA: '  Paris ',
      wordB: '',
      wordC: 'france',
      topK: 999,
      lastResult: sampleResult,
    });
    expect(r.wordA).toBe('Paris');
    expect(r.wordB).toBe('man');
    expect(r.wordC).toBe('france');
    expect(r.topK).toBe(100);
    expect(r.lastResult.results[0].word).toBe('queen');
  });

  it('normalizeLastResult rejects incomplete payloads', () => {
    expect(normalizeLastResult(null)).toBeNull();
    expect(normalizeLastResult({ results: [] })).toBeNull();
    expect(normalizeLastResult('{not-json')).toBeNull();
    expect(normalizeLastResult(sampleResult)?.results[0].word).toBe('queen');
  });

  it('save/load round-trips through Storage', () => {
    const storage = mockStorage();
    saveArithmeticSettings(
      {
        wordA: 'tokyo',
        wordB: 'japan',
        wordC: 'france',
        topK: 5,
        lastResult: sampleResult,
      },
      storage,
    );
    expect(storage.getItem(ARITHMETIC_STORAGE_KEYS.wordA)).toBe('tokyo');
    const loaded = loadArithmeticSettings(storage);
    expect(loaded.wordA).toBe('tokyo');
    expect(loaded.wordB).toBe('japan');
    expect(loaded.wordC).toBe('france');
    expect(loaded.topK).toBe(5);
    expect(loaded.lastResult.results[0].word).toBe('queen');
  });

  it('clearArithmeticSettings removes keys', () => {
    const storage = mockStorage();
    saveArithmeticSettings({ wordA: 'x', lastResult: sampleResult }, storage);
    clearArithmeticSettings(storage);
    expect(storage.getItem(ARITHMETIC_STORAGE_KEYS.wordA)).toBeNull();
    expect(storage.getItem(ARITHMETIC_STORAGE_KEYS.lastResult)).toBeNull();
  });

  it('formatOnlineStatusLabel joins model and device', () => {
    expect(formatOnlineStatusLabel('all-mpnet-base-v2', 'cpu')).toBe(
      'ONLINE (all-mpnet-base-v2 · cpu)',
    );
    expect(formatOnlineStatusLabel('m', '')).toBe('ONLINE (m)');
    expect(formatOnlineStatusLabel('', '')).toBe('ONLINE');
  });
});
