import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { saeControlsMarkup } from '../src/ui/SaeControls.js';
import { threadSlidersMarkup } from '../src/ui/ThreadSliders.js';
import { visualizationControlsMarkup } from '../src/ui/VisualizationControls.js';
import { DEFAULT_VISUALIZATION_SETTINGS } from '../src/ui/visualizationControlsDefaults.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const chromeCss = readFileSync(join(root, 'src/theme/chrome.css'), 'utf8');
const sidebarSrc = readFileSync(join(root, 'src/ui/Sidebar.js'), 'utf8');
const compareSrc = readFileSync(join(root, 'src/ui/ComparePanel.js'), 'utf8');

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

function blockContaining(needle) {
  return declarationBlocks(chromeCss).find((block) => block.selector.includes(needle));
}

describe('retro checkboxes', () => {
  it('paints every native checkbox as a 16px sunk box with a peach check', () => {
    const box = blockContaining('input[type="checkbox"]');
    expect(box, 'missing checkbox rule').toBeTruthy();
    expect(box.selector).not.toContain(':checked');
    expect(box.body).toContain('appearance: none');
    expect(box.body).toContain('-webkit-appearance: none');
    expect(box.body).toContain('width: 16px');
    expect(box.body).toContain('height: 16px');
    expect(box.body).toContain('border-top: 2px solid #1A1A1A');
    expect(box.body).toContain('border-left: 2px solid #1A1A1A');
    expect(box.body).toContain('border-right: 2px solid #FFFFFF');
    expect(box.body).toContain('border-bottom: 2px solid #FFFFFF');
    expect(box.body).toContain('background: rgba(0, 0, 0, 0.5)');
    expect(box.body).toContain('border-radius: 0');

    const mark = blockContaining('input[type="checkbox"]:checked::after');
    expect(mark, 'missing peach check').toBeTruthy();
    expect(mark.body).toContain("content: '✓'");
    expect(mark.body).toContain('color: #FFA997');
  });

  it('keeps Visualization and Compare checkboxes as native inputs', () => {
    const on = visualizationControlsMarkup({
      ...DEFAULT_VISUALIZATION_SETTINGS,
      threadLinesVisible: true,
      zeroCoverageEnabled: false,
    });
    const off = visualizationControlsMarkup({
      ...DEFAULT_VISUALIZATION_SETTINGS,
      threadLinesVisible: false,
    });
    const onTag = on.match(/<input type="checkbox" id="viz-thread-lines-enabled"[^>]*>/)?.[0];
    const offTag = off.match(/<input type="checkbox" id="viz-thread-lines-enabled"[^>]*>/)?.[0];
    expect(onTag).toBeTruthy();
    expect(onTag).toContain('checked');
    expect(offTag).toBeTruthy();
    expect(offTag).not.toContain('checked');
    expect(on).not.toContain('amiga-checkbox');
    expect(compareSrc).toContain('<input type="checkbox" id="compare-dim-sort-toggle">');
    expect(compareSrc).not.toContain('amiga-checkbox');
  });
});

describe('Workbench range sliders', () => {
  it('uses a sunk track and a rectangular beveled thumb, not a cyan capsule', () => {
    const track = blockContaining('input[type="range"]:not(.viz-am-knob-range)::-webkit-slider-runnable-track');
    expect(track, 'missing sunk track').toBeTruthy();
    expect(track.body).toContain('background: rgba(0, 0, 0, 0.5)');
    expect(track.body).toContain('border-top: 2px solid #1A1A1A');
    expect(track.body).toContain('border-left: 2px solid #1A1A1A');
    expect(track.body).toContain('border-right: 2px solid #FFFFFF');
    expect(track.body).toContain('border-bottom: 2px solid #FFFFFF');
    expect(track.body).toContain('border-radius: 0');

    const thumb = blockContaining('input[type="range"]:not(.viz-am-knob-range)::-webkit-slider-thumb');
    expect(thumb, 'missing rectangular thumb').toBeTruthy();
    expect(thumb.body).toContain('border-radius: 0');
    expect(thumb.body).toContain('border-top: 2px solid #FFFFFF');
    expect(thumb.body).toContain('border-left: 2px solid #FFFFFF');
    expect(thumb.body).toContain('border-right: 2px solid #000000');
    expect(thumb.body).toContain('border-bottom: 2px solid #000000');
    expect(thumb.body).not.toMatch(/#00[Ff]3[Ff]{2}|#00ffaa|border-radius:\s*(50%|999|1[2-9]px)/i);

    const range = blockContaining('input[type="range"]:not(.viz-am-knob-range)');
    expect(range.selector).not.toContain('::');
    expect(range.body).toContain('appearance: none');
    expect(range.body).toContain('-webkit-appearance: none');
  });

  it('still emits the spatial and visualization range inputs', () => {
    const spatial = threadSlidersMarkup();
    expect(spatial.match(/<input type="range"/g)?.length).toBe(5);
    const viz = visualizationControlsMarkup(DEFAULT_VISUALIZATION_SETTINGS);
    expect(viz).toContain('id="viz-ruler-thickness"');
    expect(viz).toContain('type="range"');
    expect(viz).toContain('viz-am-knob-range');
  });
});

describe('action buttons share gadget physics', () => {
  it('translates the named action buttons 1px when pressed', () => {
    const active = declarationBlocks(chromeCss).find((block) => (
      block.selector.includes('.btn-primary:active')
      && block.selector.includes('.btn-preset:active')
      && block.selector.includes('.compare-visualize-btn:active')
      && block.selector.includes('.viz-reset-btn:active')
      && block.selector.includes('#viz-spectral-export-csv:active')
      && block.selector.includes('#viz-spectral-export-json:active')
      && block.selector.includes('.amiga-gadget-btn:active')
    ));
    expect(active, 'action buttons are not grouped on the gadget :active rule').toBeTruthy();
    expect(active.body).toContain('transform: translate(1px, 1px)');
    expect(active.body).toContain('border-top: 2px solid #000000');
    expect(active.body).toContain('border-right: 2px solid #FFFFFF');
  });

  it('puts amiga-gadget-btn on calculate, presets, visualize, export, and reset', () => {
    expect(sidebarSrc).toMatch(/id="btn-calculate" class="btn-primary amiga-gadget-btn"/);
    expect(compareSrc).toMatch(/class="btn-preset amiga-gadget-btn"/);
    const sae = saeControlsMarkup('cmp');
    expect(sae).toContain('class="btn-primary sae-cta-main compare-visualize-btn amiga-gadget-btn"');
    const viz = visualizationControlsMarkup(DEFAULT_VISUALIZATION_SETTINGS);
    expect(viz).toContain('id="viz-reset-btn" class="viz-reset-btn amiga-gadget-btn"');
    expect(viz).toContain('id="viz-spectral-export-csv" class="amiga-gadget-btn"');
    expect(viz).toContain('id="viz-spectral-export-json" class="amiga-gadget-btn"');
    expect(viz).not.toMatch(/id="viz-spectral-export-csv"[^>]*clip-path/);
    expect(viz).not.toMatch(/id="viz-spectral-export-json"[^>]*clip-path/);
  });
});
