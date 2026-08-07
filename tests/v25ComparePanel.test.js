import { describe, expect, it } from 'vitest';
import { getCompareBootstrap } from '../src/ui/ComparePanel.js';
import { comparePanelMarkup } from '../src/v25/ui/comparePanel.js';

describe('v25 compare panel chrome', () => {
  it('markup includes visualize CTA, presets, cosine list, and SAE chrome', () => {
    const html = comparePanelMarkup(getCompareBootstrap().textareaValue);
    expect(html).toContain('id="lab-compare-panel"');
    expect(html).toContain('sae-controls');
    expect(html).toContain('btn-sae-train');
    expect(html).toContain('btn-sae-toggle');
    expect(html).toContain('id="lab-compare-list"');
    expect(html).toContain('data-preset="groupsDemo"');
    expect(html).toContain('GROUP_1');
  });
});
