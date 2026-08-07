import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../src/v25/contrast.js';
import { V25_TOKEN_HEX } from '../src/v25/tokenValues.js';

describe('contrastRatio', () => {
  it('returns ~21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#e8ffe8', '#0a1210')).toBe(
      contrastRatio('#0a1210', '#e8ffe8'),
    );
  });
});

describe('v25 token contrast (WCAG AA text)', () => {
  it('body text on lab background >= 4.5', () => {
    expect(
      contrastRatio(V25_TOKEN_HEX.text, V25_TOKEN_HEX.bg),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('muted text on lab background >= 3 (large/UI)', () => {
    expect(
      contrastRatio(V25_TOKEN_HEX.textMuted, V25_TOKEN_HEX.bg),
    ).toBeGreaterThanOrEqual(3);
  });

  it('panel text on panel surface >= 4.5', () => {
    expect(
      contrastRatio(V25_TOKEN_HEX.text, V25_TOKEN_HEX.panel),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('primary label on fluo accent >= 3', () => {
    expect(
      contrastRatio(V25_TOKEN_HEX.onAccent, V25_TOKEN_HEX.accent),
    ).toBeGreaterThanOrEqual(3);
  });
});
