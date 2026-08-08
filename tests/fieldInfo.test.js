import { describe, it, expect } from 'vitest';
import {
  FIELD_INFO,
  MAX_FIELD_INFO_LEN,
  escapeHtmlAttr,
  infoTipMarkup,
  resolveFieldInfoClick,
} from '../src/ui/fieldInfo.js';

describe('FIELD_INFO catalog', () => {
  it('covers every editable control key with short English copy', () => {
    const required = [
      'wordA', 'wordB', 'wordC',
      'compareTokens', 'dimSort',
      'saeToggle', 'saeHidden', 'saeK', 'saeEpochs', 'saeLr', 'saeBatch',
      'spacingX', 'vectorDistY', 'amplitudeY', 'lengthZ', 'thickness',
      'vizFilter', 'colorPos', 'colorZero', 'colorNeg', 'zeroCoverage', 'zeroCoverageAmount', 'labelsToggle',
      'groupContrast', 'sameSignCancel', 'sameSignCoverage',
      'oppositeHighlight', 'oppositeColor', 'oppositeStrength', 'oppositeCancel',
      'groupHue', 'groupHueSwatch',
    ];
    for (const key of required) {
      expect(FIELD_INFO[key], key).toBeTruthy();
      const maxLen = key === 'groupHue' ? 60 : MAX_FIELD_INFO_LEN;
      expect(FIELD_INFO[key].length, key).toBeLessThanOrEqual(maxLen);
      expect(FIELD_INFO[key]).not.toMatch(/[\n\r\t]/);
      expect(FIELD_INFO[key]).toMatch(/[A-Za-z]/);
    }
  });
});

describe('escapeHtmlAttr / infoTipMarkup', () => {
  it('escapes quotes and angle brackets for safe attributes', () => {
    expect(escapeHtmlAttr('a"b<c>')).toBe('a&quot;b&lt;c&gt;');
  });

  it('emits a compact i button with data-field-info', () => {
    const html = infoTipMarkup('Gap between threads.');
    expect(html).toContain('class="field-info-btn"');
    expect(html).toContain('data-field-info="Gap between threads."');
    expect(html).toMatch(/>i</);
  });

  it('returns empty string for blank text', () => {
    expect(infoTipMarkup('')).toBe('');
    expect(infoTipMarkup('   ')).toBe('');
  });
});

describe('resolveFieldInfoClick', () => {
  const btnA = { id: 'a' };
  const btnB = { id: 'b' };

  it('opens when clicking an info button with none open', () => {
    expect(resolveFieldInfoClick(null, btnA)).toEqual({ action: 'open', button: btnA });
  });

  it('closes when clicking the same open info button', () => {
    expect(resolveFieldInfoClick(btnA, btnA)).toEqual({ action: 'close' });
  });

  it('switches when clicking a different info button', () => {
    expect(resolveFieldInfoClick(btnA, btnB)).toEqual({ action: 'open', button: btnB });
  });

  it('closes on outside click while a tip is open', () => {
    expect(resolveFieldInfoClick(btnA, null)).toEqual({ action: 'close' });
  });

  it('no-ops on outside click when nothing is open', () => {
    expect(resolveFieldInfoClick(null, null)).toEqual({ action: 'noop' });
  });
});
