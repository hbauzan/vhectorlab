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

  it('left dock keeps taller HUD-capped height and side scrollbars for overflow', () => {
    const chrome = readFileSync(
      resolve(process.cwd(), 'src/theme/chrome.css'),
      'utf8',
    );
    expect(chrome).toMatch(
      /#compare-panel[\s\S]*?max-height:\s*min\([\s\S]*?68vh[\s\S]*?600px[\s\S]*?100dvh[\s\S]*?--hud-height/,
    );
    expect(chrome).toMatch(
      /#compare-panel[\s\S]*?overflow-y:\s*auto\s*!important/,
    );
    expect(chrome).toMatch(/scrollbar-gutter:\s*stable/);
    expect(chrome).toMatch(
      /\.compare-cosine-list\s*\{[^}]*overflow-y:\s*auto/s,
    );
    expect(chrome).not.toMatch(
      /max-height:\s*min\(56vh,\s*520px\)\s*!important/,
    );
  });
});
