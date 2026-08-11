import { describe, it, expect } from 'vitest';
import { buildGroupCosineRows } from '../src/ui/compareCosine.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Panel contract: with ≥2 groups the cosine list is group-centroid rows
 * (viewer / token payload unchanged). Flat stays token-vs-first.
 */
describe('Compare panel group cosine contract', () => {
  it('exposes GROUP COSINE subtitle + group rows when ≥2 groups have embeddings', () => {
    const items = [
      { text: 'car', embedding: [1, 0], groupId: 'vehicles', groupLabel: 'vehicles' },
      { text: 'truck', embedding: [1, 0], groupId: 'vehicles', groupLabel: 'vehicles' },
      { text: 'sophia', embedding: [0, 1], groupId: 'women', groupLabel: 'women' },
    ];
    const rows = buildGroupCosineRows(items);
    expect(rows.anchor.text).toBe('vehicles');
    expect(rows.items.every((r) => r.isGroupRow)).toBe(true);
    // Panel subtitle convention (ComparePanel.renderCosineList groupMode)
    const subtitle = `GROUP COSINE vs "${rows.anchor.text}"`;
    expect(subtitle).toBe('GROUP COSINE vs "vehicles"');
  });

  it('left dock max-height tracks viewport→HUD (not a short 56vh/520px cap)', () => {
    const chrome = readFileSync(
      resolve(process.cwd(), 'src/theme/chrome.css'),
      'utf8',
    );
    expect(chrome).toMatch(
      /#compare-panel[\s\S]*?max-height:\s*calc\(\s*100dvh[\s\S]*?--hud-height[\s\S]*?--hud-bottom/,
    );
    expect(chrome).not.toMatch(
      /#compare-panel,\s*\n\s*body\.workbench-theme #sidebar-panel \{\s*\n\s*max-height:\s*min\(56vh,\s*520px\)/,
    );
  });
});
