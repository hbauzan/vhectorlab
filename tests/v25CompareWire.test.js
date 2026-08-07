import { describe, expect, it, vi } from 'vitest';
import {
  cosineListHtml,
  fetchCompareResults,
  groupLegendHtml,
  hasMultipleGroups,
  parseCompareText,
} from '../src/v25/compareWire.js';

describe('v25 compareWire', () => {
  it('parses flat and GROUP_ lines', () => {
    const flat = parseCompareText('wheel, engine, brake');
    expect(flat.mode).toBe('flat');
    expect(flat.tokens).toEqual(['wheel', 'engine', 'brake']);

    const grouped = parseCompareText(
      'GROUP_A = car, truck\nGROUP_B = soft, warm',
    );
    expect(grouped.mode).toBe('grouped');
    expect(grouped.tokens).toEqual(['car', 'truck', 'soft', 'warm']);
    expect(grouped.tokenMeta[0].groupId).toBe('GROUP_A');
  });

  it('fetchCompareResults attaches group meta', async () => {
    const provider = {
      computeCompare: vi.fn(async () => ({
        count: 2,
        anchor: { index: 0, text: 'car' },
        items: [
          { id: 'tok_0', text: 'car', embedding: [1, 0], cosine_vs_first: 1 },
          { id: 'tok_1', text: 'truck', embedding: [0.9, 0.1], cosine_vs_first: 0.9 },
        ],
      })),
    };
    const { data } = await fetchCompareResults(
      provider,
      ['car', 'truck'],
      [
        { groupId: 'G1', groupLabel: 'G1' },
        { groupId: 'G1', groupLabel: 'G1' },
      ],
    );
    expect(provider.computeCompare).toHaveBeenCalledWith(['car', 'truck']);
    expect(data.items[0].groupId).toBe('G1');
    expect(data.featureSpace).toBe('RAW');
  });

  it('rejects empty tokens', async () => {
    const provider = { computeCompare: vi.fn() };
    await expect(fetchCompareResults(provider, [])).rejects.toThrow(/token/i);
    expect(provider.computeCompare).not.toHaveBeenCalled();
  });

  it('renders cosine list with REF and reorder controls', () => {
    const html = cosineListHtml([
      { id: 'tok_0', text: 'car', cosine_vs_first: 1 },
      { id: 'tok_1', text: 'truck', cosine_vs_first: 0.8123 },
    ]);
    expect(html).toContain('REF');
    expect(html).toContain('car');
    expect(html).toContain('0.8123');
    expect(html).toContain('data-dir="up"');
  });

  it('group legend and multi-group detection', () => {
    expect(groupLegendHtml([])).toBe('');
    const html = groupLegendHtml([
      { groupId: 'A', groupLabel: 'A' },
      { groupId: 'A', groupLabel: 'A' },
      { groupId: 'B', groupLabel: 'B' },
    ]);
    expect(html).toContain('lab-compare-chip');
    expect(html).toContain('<em>2</em>');
    expect(hasMultipleGroups([
      { groupId: 'A' },
      { groupId: 'B' },
    ])).toBe(true);
    expect(hasMultipleGroups([{ groupId: 'A' }, { groupId: 'A' }])).toBe(false);
  });
});
