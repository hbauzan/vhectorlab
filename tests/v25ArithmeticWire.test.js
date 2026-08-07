import { describe, expect, it, vi } from 'vitest';
import {
  escapeHtml,
  fetchArithmeticResults,
  resultsListHtml,
} from '../src/v25/arithmeticWire.js';

describe('arithmeticWire', () => {
  it('escapes HTML in words', () => {
    expect(escapeHtml('<script>"x"&')).toBe(
      '&lt;script&gt;&quot;x&quot;&amp;',
    );
  });

  it('renders empty and ranked results', () => {
    expect(resultsListHtml([])).toContain('No semantic matches found');
    const html = resultsListHtml([
      { word: 'queen', score: 0.91 },
      { word: 'royal', score: 0.8 },
    ]);
    expect(html).toContain('#1');
    expect(html).toContain('queen');
    expect(html).toContain('0.9100');
    expect(html).toContain('#2');
  });

  it('fetchArithmeticResults uses provider and returns results', async () => {
    const provider = {
      computeArithmetic: vi.fn(async () => ({
        results: [{ word: 'queen', score: 0.95 }],
        vector_res: [0.1],
      })),
    };
    const out = await fetchArithmeticResults(provider, {
      wordA: 'king',
      wordB: 'man',
      wordC: 'woman',
      topK: 10,
    });
    expect(provider.computeArithmetic).toHaveBeenCalledWith(
      'king',
      'man',
      'woman',
      10,
    );
    expect(out.results[0].word).toBe('queen');
  });

  it('rejects empty words without calling provider', async () => {
    const provider = { computeArithmetic: vi.fn() };
    await expect(
      fetchArithmeticResults(provider, { wordA: '', wordB: 'b', wordC: 'c' }),
    ).rejects.toThrow(/required/i);
    expect(provider.computeArithmetic).not.toHaveBeenCalled();
  });
});
