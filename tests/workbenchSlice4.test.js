import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { dockTabFace } from '../src/ui/CollapsibleDock.js';
import { vizPanelTabFace } from '../src/ui/VisualizationControls.js';

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

describe('retro scrollbars', () => {
  const blocks = declarationBlocks(chromeCss);

  it('paints a sunk track and a beveled thumb in the Workbench pens', () => {
    expect(chromeCss).toContain('scrollbar-color: #3D3D3D #1A1A1A');
    const track = blocks.find((block) => block.selector.includes('::-webkit-scrollbar-track'));
    const thumb = blocks.find((block) => block.selector.includes('::-webkit-scrollbar-thumb'));
    expect(track, 'missing scrollbar track').toBeTruthy();
    expect(thumb, 'missing scrollbar thumb').toBeTruthy();
    expect(track.body).toContain('background: #1A1A1A');
    expect(track.body).toContain('border-top: 2px solid #000000');
    expect(track.body).toContain('border-left: 2px solid #000000');
    expect(track.body).toContain('border-right: 2px solid #FFFFFF');
    expect(track.body).toContain('border-bottom: 2px solid #FFFFFF');
    expect(thumb.body).toContain('background: #3D3D3D');
    expect(thumb.body).toContain('border-top: 2px solid #FFFFFF');
    expect(thumb.body).toContain('border-left: 2px solid #FFFFFF');
    expect(thumb.body).toContain('border-right: 2px solid #000000');
    expect(thumb.body).toContain('border-bottom: 2px solid #000000');
    expect(thumb.body).toContain('border-radius: 0');
  });
});

describe('dock tab faces', () => {
  it('uses the four canonical labels', () => {
    expect(dockTabFace('left', false, 'ARITHMETIC')).toBe('◀ ARITHMETIC');
    expect(dockTabFace('left', false, 'COMPARE')).toBe('◀ COMPARE');
    expect(dockTabFace('right', false, 'SPATIAL')).toBe('SPATIAL ▶');
    expect(vizPanelTabFace(false)).toBe('▼ VIZ');
    expect(vizPanelTabFace(true)).toBe('▲ VIZ');
  });
});
