import { describe, expect, it } from 'vitest';
import { getCompareBootstrap } from '../src/ui/ComparePanel.js';
import { comparePanelMarkup } from '../src/v25/ui/comparePanel.js';

describe('v25 compare panel chrome', () => {
  it('markup includes visualize CTA, presets, and cosine list host', () => {
    const html = comparePanelMarkup(getCompareBootstrap().textareaValue);
    expect(html).toContain('id="lab-compare-panel"');
    expect(html).toContain('VISUALIZE SEQUENCE');
    expect(html).toContain('id="lab-compare-list"');
    expect(html).toContain('data-preset="groupsDemo"');
    expect(html).toContain('GROUP_1');
    expect(html).not.toContain('SAE');
  });
});
