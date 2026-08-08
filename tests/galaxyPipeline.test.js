import { describe, expect, it, vi } from 'vitest';
import {
  buildGalaxyPipelineSteps,
  canReuseCompareCache,
  compareTextsFingerprint,
  galaxyProgressState,
  runGalaxyPipeline,
} from '../src/ui/galaxyPipeline.js';

describe('galaxyPipeline', () => {
  it('builds steps without SAE (3) and with SAE (4)', () => {
    expect(buildGalaxyPipelineSteps({ saeEnabled: false }).map((s) => s.id)).toEqual([
      'encode',
      'umap',
      'build',
    ]);
    expect(buildGalaxyPipelineSteps({ saeEnabled: true }).map((s) => s.id)).toEqual([
      'encode',
      'sae',
      'umap',
      'build',
    ]);
  });

  it('formats k/n status text and ratio', () => {
    const p = galaxyProgressState(2, 4, 'Running UMAP…');
    expect(p.statusText).toBe('2/4 Running UMAP…');
    expect(p.ratio).toBeCloseTo(0.5);
  });

  it('reuses compare cache only when fingerprint + count match', () => {
    const fp = compareTextsFingerprint(['a', 'b']);
    expect(fp).toBe('a\nb');
    expect(canReuseCompareCache({ fingerprint: fp, itemCount: 2 }, fp, 2)).toBe(true);
    expect(canReuseCompareCache({ fingerprint: fp, itemCount: 2 }, fp, 3)).toBe(false);
    expect(canReuseCompareCache({ fingerprint: 'x', itemCount: 2 }, fp, 2)).toBe(false);
    expect(canReuseCompareCache(null, fp, 2)).toBe(false);
  });

  it('runGalaxyPipeline reports k/n progress and projects embeddings', async () => {
    const progress = [];
    const fetchCompare = vi.fn(async () => ({
      items: [
        { id: '1', text: 'a', embedding: [1, 0] },
        { id: '2', text: 'b', embedding: [0, 1] },
      ],
    }));
    const project = vi.fn(async () => [[0, 0, 0], [1, 1, 1]]);

    const result = await runGalaxyPipeline({
      texts: ['a', 'b'],
      saeEnabled: false,
      fetchCompare,
      project,
      onProgress: (p) => progress.push(p.statusText),
    });

    expect(fetchCompare).toHaveBeenCalledOnce();
    expect(project).toHaveBeenCalledOnce();
    expect(result.positions).toEqual([[0, 0, 0], [1, 1, 1]]);
    expect(result.reusedCompare).toBe(false);
    expect(progress).toEqual([
      '1/3 Encoding tokens…',
      '2/3 Running UMAP…',
      '3/3 Building galaxy…',
    ]);
  });

  it('runGalaxyPipeline reuses compare cache and includes SAE step', async () => {
    const progress = [];
    const rawData = {
      items: [
        { id: '1', text: 'a', embedding: [1, 0] },
        { id: '2', text: 'b', embedding: [0, 1] },
      ],
    };
    const fp = compareTextsFingerprint(['a', 'b']);
    const fetchCompare = vi.fn();
    const encodeSae = vi.fn(async (raw) => ({
      ...raw,
      items: raw.items.map((it) => ({ ...it, embedding: [0.5, 0.5] })),
      featureSpace: 'SAE',
    }));
    const project = vi.fn(async (vectors) => vectors.map((_, i) => [i, 0, 0]));

    const result = await runGalaxyPipeline({
      texts: ['a', 'b'],
      saeEnabled: true,
      compareCache: { fingerprint: fp, itemCount: 2, rawData },
      fetchCompare,
      encodeSae,
      project,
      onProgress: (p) => progress.push(p.statusText),
    });

    expect(fetchCompare).not.toHaveBeenCalled();
    expect(encodeSae).toHaveBeenCalledOnce();
    expect(result.reusedCompare).toBe(true);
    expect(result.displayData.featureSpace).toBe('SAE');
    expect(progress).toEqual([
      '1/4 Encoding tokens…',
      '2/4 Applying SAE…',
      '3/4 Running UMAP…',
      '4/4 Building galaxy…',
    ]);
  });
});
