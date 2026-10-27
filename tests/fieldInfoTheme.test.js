import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { infoTipMarkup } from '../src/ui/fieldInfo.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const chromeCss = readFileSync(join(root, 'src/theme/chrome.css'), 'utf8');

function declarationBlocks(css) {
  const blocks = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match = re.exec(css);
  while (match) {
    blocks.push({ selector: match[1], body: match[2] });
    match = re.exec(css);
  }
  return blocks;
}

const blocks = declarationBlocks(chromeCss);

describe('field-info micro gadget', () => {
  it('is a 16px square beveled button, not a circle', () => {
    const btn = blocks.find((block) => (
      block.selector.includes('.field-info-btn')
      && !block.selector.includes(':active')
      && !block.selector.includes(':hover')
      && !block.selector.includes('[aria-expanded')
    ));
    expect(btn, 'missing .field-info-btn rule').toBeTruthy();
    expect(btn.body).toContain('width: 16px');
    expect(btn.body).toContain('height: 16px');
    expect(btn.body).toContain('border-radius: 0');
    expect(btn.body).not.toContain('border-radius: 50%');
    expect(btn.body).toContain('border-top: 2px solid #FFFFFF');
    expect(btn.body).toContain('border-left: 2px solid #FFFFFF');
    expect(btn.body).toContain('border-right: 2px solid #000000');
    expect(btn.body).toContain('border-bottom: 2px solid #000000');
    expect(btn.body).toContain('var(--amiga-font)');

    const html = infoTipMarkup('Gap between threads.');
    expect(html).toContain('class="field-info-btn"');
    expect(html).toMatch(/>i</);
    expect(html).not.toContain('border-radius');
  });

  it('draws the tip as a solid raised box without blur', () => {
    const tip = blocks.find((block) => (
      block.selector.includes('.field-info-tip')
      && !block.selector.includes(':')
    ));
    expect(tip, 'missing .field-info-tip rule').toBeTruthy();
    expect(tip.body).toContain('background: #1A1A1A');
    expect(tip.body).toContain('color: #F0F0F0');
    expect(tip.body).toContain('border-top: 2px solid #FFFFFF');
    expect(tip.body).toContain('border-left: 2px solid #FFFFFF');
    expect(tip.body).toContain('border-right: 2px solid #000000');
    expect(tip.body).toContain('border-bottom: 2px solid #000000');
    expect(tip.body).toContain('box-shadow: 2px 2px 0 #000000');
    expect(tip.body).toContain('border-radius: 0');
    expect(tip.body).toContain('backdrop-filter: none');
    expect(tip.body).not.toMatch(/backdrop-filter:\s*blur/);
  });
});
