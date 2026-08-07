/**
 * Relative luminance (sRGB) and WCAG contrast helpers for v25 token checks.
 * @param {string} hex #RGB or #RRGGBB
 * @returns {number} 0..1
 */
export function relativeLuminance(hex) {
  const { r, g, b } = parseHex(hex);
  const lin = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/**
 * WCAG contrast ratio between two hex colors.
 * @param {string} foreground
 * @param {string} background
 * @returns {number} >= 1
 */
export function contrastRatio(foreground, background) {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseHex(hex) {
  const raw = String(hex).trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(raw)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : raw;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}
