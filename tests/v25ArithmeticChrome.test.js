import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ARITHMETIC_TOP10_SCROLL } from '../src/ui/arithmeticResultsScroll.js';
import {
  ARITHMETIC_COPY,
  ARITHMETIC_DEFAULTS,
  V25_ARITHMETIC_SCROLL,
  arithmeticPanelMarkup,
} from '../src/v25/ui/arithmeticPanel.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'src/v25/arithmetic.css'), 'utf8');

describe('v25 arithmetic chrome', () => {
  it('keeps legacy product copy for CTA and Top-10', () => {
    expect(ARITHMETIC_COPY.calculate).toBe('CALCULATE VECTOR');
    expect(ARITHMETIC_COPY.resultsTitle).toContain('TOP-10');
    expect(ARITHMETIC_DEFAULTS).toEqual({
      wordA: 'king',
      wordB: 'man',
      wordC: 'woman',
      topK: 10,
    });
  });

  it('markup includes form fields, CTA, and results list host', () => {
    const html = arithmeticPanelMarkup();
    expect(html).toContain('id="lab-arithmetic-panel"');
    expect(html).toContain('id="lab-word-a"');
    expect(html).toContain('id="lab-word-b"');
    expect(html).toContain('id="lab-word-c"');
    expect(html).toContain('id="lab-btn-calculate"');
    expect(html).toContain('id="lab-results-list"');
    expect(html).toContain(ARITHMETIC_COPY.calculate);
  });

  it('reuses legacy Top-10 max-height contract', () => {
    expect(V25_ARITHMETIC_SCROLL.desktopMaxHeight).toBe(
      ARITHMETIC_TOP10_SCROLL.desktopMaxHeight,
    );
    expect(V25_ARITHMETIC_SCROLL.mobileMaxHeight).toBe(
      ARITHMETIC_TOP10_SCROLL.mobileMaxHeight,
    );
  });

  it('CSS encodes 120px floor and short-panel scroll MQ', () => {
    expect(css).toContain('max(120px, min(280px, 40dvh))');
    expect(css).toContain('max(120px, min(200px, 36dvh))');
    expect(css).toContain('@media (max-height: 560px)');
    expect(css).toContain('#lab-arithmetic-panel .lab-results-list');
  });
});
