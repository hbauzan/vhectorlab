import { describe, expect, it } from 'vitest';
import { formatOnlineStatusLabel } from '../src/ui/healthStatusLabel.js';

describe('formatOnlineStatusLabel', () => {
  it('formats profile · short label · dim · device', () => {
    expect(
      formatOnlineStatusLabel({
        model: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
        modelProfile: 'local-comfort',
        shortLabel: 'MiniLM-multi',
        embeddingDim: 384,
        device: 'mps',
      }),
    ).toBe('ONLINE (local-comfort · MiniLM-multi · 384D · mps)');
  });

  it('omits profile when null and falls back to hub bare name', () => {
    expect(
      formatOnlineStatusLabel({
        model: 'sentence-transformers/all-mpnet-base-v2',
        modelProfile: null,
        shortLabel: null,
        embeddingDim: 768,
        device: 'cpu',
      }),
    ).toBe('ONLINE (all-mpnet-base-v2 · 768D · cpu)');
  });

  it('returns ONLINE when empty', () => {
    expect(formatOnlineStatusLabel({})).toBe('ONLINE');
  });
});
