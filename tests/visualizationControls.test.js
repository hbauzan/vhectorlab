import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DEFAULT_VISUALIZATION_SETTINGS,
  DEFAULT_VIZ_COLORS,
  DEFAULT_VIZ_FILTER,
  VIZ_STORAGE_KEYS,
  isValidHex,
  normalizeHex,
  hexToRgb01,
  resolveVisualizationSettings,
  loadVisualizationSettings,
  saveVisualizationSettings,
  resetVisualizationSettings,
  anchorsFromSettings,
  remapAbsTWithZeroCoverage,
  normalizeZeroCoverage,
  normalizeHighCoverage,
  highCoverageFromSlider,
  highCoverageToSlider,
  formatHighCoverage,
  parseHighCoverageInput,
  effectiveZeroCoveragePercent,
  HIGH_COVERAGE_MIN,
  HIGH_COVERAGE_MAX,
  HIGH_COVERAGE_SLIDER_MAX,
} from '../src/ui/visualizationControlsDefaults.js';
import {
  visualizationControlsMarkup,
  setVisualizationPanelCollapsed,
  setVisualizationPanelLayout,
  vizPanelTabGlyph,
  vizPanelLayoutForViewport,
  resolveVisualizationMountParent,
  syncGroupHueColorRows,
  setSharedNoiseControlsEnabled,
  setGroupContrastControlsEnabled,
  syncVisualizationControlsFromConfig,
  syncGroupFxSliderEnabled,
  wireVisualizationControls,
} from '../src/ui/VisualizationControls.js';
import {
  NEAR_ZERO_EPS,
  shouldShowActivation,
  filterPointsData,
  lineSegmentIndices,
  wideRibbonQuadIndices,
} from '../src/visualizer/activationFilter.js';
import { getDivergentColor } from '../src/visualizer/DivergentShading.js';

function mockStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    _map: map,
  };
}

describe('visualizationControlsDefaults', () => {
  it('defaults match §0.2 anchors and filter All', () => {
    expect(DEFAULT_VIZ_FILTER).toBe('all');
    expect(DEFAULT_VIZ_COLORS.colorPositive).toBe('#FFE600');
    expect(DEFAULT_VIZ_COLORS.colorZero).toBe('#000000');
    expect(DEFAULT_VIZ_COLORS.colorNegative).toBe('#9900E6');
    expect(DEFAULT_VISUALIZATION_SETTINGS).toEqual({
      vizFilterMode: 'all',
      colorPositive: '#FFE600',
      colorZero: '#000000',
      colorNegative: '#9900E6',
      zeroCoverageEnabled: false,
      zeroCoverage: 30,
      threadLinesVisible: true,
      labelsVisible: true,
      sameSignCancelEnabled: false,
      sameSignCancelCoverage: 30,
      oppositeHighlightEnabled: false,
      oppositeHighlightColor: '#00E5FF',
      oppositeHighlightStrength: 70,
      oppositeCancelCoverage: 0,
      spectralQuorumEnabled: false,
      spectralQuorumPercent: 10,
      spectralHighlightColor: '#00E5FF',
      spectralHighlightStrength: 100,
      spectralPajaCancelCoverage: 100,
      spectralDecimalGain: 10,
      groupHueEnabled: false,
      groupHueColors: {},
      rulerColor: '#FFFFFF',
      rulerThickness: 4,
      rulerCursor: 1,
      rulerPaintedDims: [],
      rulerLineCount: 0,
    });
  });

  it('validates and normalizes hex', () => {
    expect(isValidHex('#FFE600')).toBe(true);
    expect(isValidHex('#ff00')).toBe(false);
    expect(isValidHex('not-a-color')).toBe(false);
    expect(normalizeHex('ffe600')).toBe('#FFE600');
    expect(normalizeHex('#abc')).toBeNull();
  });

  it('hexToRgb01 parses endpoints', () => {
    expect(hexToRgb01('#FFE600')).toEqual({
      r: 1,
      g: 230 / 255,
      b: 0,
    });
    expect(hexToRgb01('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb01('#9900E6')).toEqual({
      r: 153 / 255,
      g: 0,
      b: 230 / 255,
    });
  });

  it('resolveVisualizationSettings falls back invalid hex and mode', () => {
    const resolved = resolveVisualizationSettings({
      vizFilterMode: 'nope',
      colorPositive: 'bad',
      colorZero: '#112233',
      colorNegative: '#9900E6',
    });
    expect(resolved.vizFilterMode).toBe('all');
    expect(resolved.colorPositive).toBe('#FFE600');
    expect(resolved.colorZero).toBe('#112233');
    expect(resolved.colorNegative).toBe('#9900E6');
  });

  it('persist round-trip via mock localStorage', () => {
    const storage = mockStorage();
    const settings = resolveVisualizationSettings({
      vizFilterMode: 'positive',
      colorPositive: '#FF0000',
      colorZero: '#111111',
      colorNegative: '#0000FF',
      rulerColor: '#ABCDEF',
      rulerThickness: 9,
      rulerCursor: 12,
      rulerPaintedDims: [1, 78, 79],
    });
    expect(settings.rulerLineCount).toBe(3);
    saveVisualizationSettings(settings, storage);
    expect(storage.getItem(VIZ_STORAGE_KEYS.filter)).toBe('positive');
    expect(storage.getItem(VIZ_STORAGE_KEYS.rulerColor)).toBe('#ABCDEF');
    expect(storage.getItem(VIZ_STORAGE_KEYS.rulerLineCount)).toBe('3');
    expect(JSON.parse(storage.getItem(VIZ_STORAGE_KEYS.rulerPaintedDims))).toEqual([1, 78, 79]);
    expect(loadVisualizationSettings(storage)).toEqual(settings);
  });

  it('threadLinesVisible false persists', () => {
    const storage = mockStorage();
    const settings = resolveVisualizationSettings({ threadLinesVisible: false });
    expect(settings.threadLinesVisible).toBe(false);
    saveVisualizationSettings(settings, storage);
    expect(storage.getItem(VIZ_STORAGE_KEYS.threadLinesVisible)).toBe('false');
    expect(loadVisualizationSettings(storage).threadLinesVisible).toBe(false);
  });

  it('migrates legacy rulerLineCount to painted 1..N', () => {
    const resolved = resolveVisualizationSettings({ rulerLineCount: 4 });
    expect(resolved.rulerPaintedDims).toEqual([1, 2, 3, 4]);
    expect(resolved.rulerLineCount).toBe(4);
  });

  it('reset restores defaults and All', () => {
    const storage = mockStorage({
      [VIZ_STORAGE_KEYS.filter]: 'negative',
      [VIZ_STORAGE_KEYS.colorPositive]: '#FF0000',
    });
    const reset = resetVisualizationSettings(storage);
    expect(reset).toEqual(DEFAULT_VISUALIZATION_SETTINGS);
    expect(loadVisualizationSettings(storage)).toEqual(DEFAULT_VISUALIZATION_SETTINGS);
  });

  it('anchorsFromSettings yields RGB01 trio', () => {
    const a = anchorsFromSettings(DEFAULT_VISUALIZATION_SETTINGS);
    expect(a.positive.r).toBeCloseTo(1, 5);
    expect(a.zero).toEqual({ r: 0, g: 0, b: 0 });
    expect(a.negative.b).toBeCloseTo(230 / 255, 5);
  });
});

describe('Visualization panel collapse tab', () => {
  it('edge layout uses vertical glyphs (▼ raised, ▲ resting on HUD)', () => {
    expect(vizPanelTabGlyph(false, 'edge')).toBe('▼');
    expect(vizPanelTabGlyph(true, 'edge')).toBe('▲');
    const expanded = visualizationControlsMarkup(DEFAULT_VISUALIZATION_SETTINGS, {
      collapsed: false,
      layout: 'edge',
    });
    expect(expanded).toContain('▼');
    expect(expanded).not.toContain('▶');
    const collapsed = visualizationControlsMarkup(DEFAULT_VISUALIZATION_SETTINGS, {
      collapsed: true,
      layout: 'edge',
    });
    expect(collapsed).toContain('▲');
    expect(collapsed).not.toContain('◀');
  });

  it('markup includes edge tab and aria-expanded', () => {
    const html = visualizationControlsMarkup(DEFAULT_VISUALIZATION_SETTINGS, { collapsed: false });
    expect(html).toContain('viz-panel-tab');
    expect(html).toContain('data-viz-layout="edge"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('▼');
    expect(html).toContain('viz-zero-coverage-a');
    expect(html).toContain('viz-zero-coverage-ma');
    expect(html).toContain('viz-zero-coverage-val');
    expect(html).toContain('viz-am-knobs-row');
    expect(html).not.toContain('viz-zero-coverage-slider');
    expect(html).toContain('viz-zero-coverage-enabled');
    expect(html).toContain('Zero coverage');
    expect(html).toContain('viz-shared-noise');
    expect(html).toContain('viz-same-sign-coverage-a');
    expect(html).toContain('data-field-info="Coarse percent (A)."');
    expect(html).toContain('data-field-info="Fine % · 5 decimals."');
    expect(html).toContain('data-field-info="Sign conflict + Group hue."');
    // Shared noise sits after Zero coverage, outside Group contrast
    const zeroIdx = html.indexOf('viz-zero-coverage-block');
    const sharedIdx = html.indexOf('id="viz-shared-noise"');
    const contrastIdx = html.indexOf('id="viz-group-contrast"');
    expect(zeroIdx).toBeGreaterThan(-1);
    expect(sharedIdx).toBeGreaterThan(zeroIdx);
    expect(contrastIdx).toBeGreaterThan(sharedIdx);
    expect(html.indexOf('viz-same-sign-enabled')).toBeGreaterThan(sharedIdx);
    expect(html.indexOf('viz-same-sign-enabled')).toBeLessThan(contrastIdx);
    expect(html).toContain('viz-group-contrast');
    expect(html).toContain('Group contrast');
    expect(html).toContain('Group hue');
    expect(html).toContain('viz-group-hue-enabled');
    expect(html).toContain('viz-ruler-section');
    expect(html).toContain('viz-ruler-plus');
    expect(html).toContain('viz-ruler-cursor');
    expect(html).not.toContain('viz-ruler-link-path');
    expect(html).not.toContain('viz-ruler-link-span');
    expect(html).toContain('Ruler');
    expect(html).toContain('viz-group-hue-rows');
    expect(html).toContain('viz-same-sign-enabled');
    expect(html).toContain('viz-opposite-enabled');
    expect(html).toContain('viz-thread-lines-enabled');
    expect(html).toContain('Thread lines');
    expect(html).toContain('data-field-info="Joins dims on a thread."');
    // Thread lines toggle sits at the top of the panel body
    const titleIdx = html.indexOf('sliders-title');
    const threadLinesIdx = html.indexOf('viz-thread-lines-enabled');
    const filterIdx = html.indexOf('viz-filter-group');
    expect(threadLinesIdx).toBeGreaterThan(titleIdx);
    expect(filterIdx).toBeGreaterThan(threadLinesIdx);
    expect(html).toContain('viz-labels-toggle');
    expect(html).toContain('Hide labels');
    expect(html).toContain('field-info-btn');
    expect(html).toContain('data-field-info="Which signs show."');
    expect(html).toContain('data-field-info="Hold range at zero."');
    expect(html).not.toContain('data-field-info="Groups only (G1↔G2)."');
    // Spectral Quorum
    expect(html).toContain('viz-spectral-enabled');
    expect(html).toContain('Spectral Quorum');
    expect(html).toContain('viz-spectral-swatch');
    expect(html).toContain('viz-spectral-hex');
    expect(html).toContain('viz-spectral-quorum');
    expect(html).toContain('viz-spectral-gain');
    expect(html).toContain('viz-spectral-strength');
    expect(html).toContain('viz-spectral-paja-cancel');
  });

  it('Shared noise gate is independent of Group contrast (≥2 tokens)', () => {
    const classBag = new Set(['is-disabled']);
    const contrastBag = new Set(['is-disabled']);
    const disabled = new Map();
    const makeEl = (id, bag) => ({
      id,
      classList: {
        contains: (c) => bag.has(c),
        toggle: (c, on) => {
          if (on) bag.add(c);
          else bag.delete(c);
        },
      },
      setAttribute: () => {},
      querySelector: () => null,
      title: '',
      get disabled() { return Boolean(disabled.get(id)); },
      set disabled(v) { disabled.set(id, Boolean(v)); },
    });
    const shared = makeEl('viz-shared-noise', classBag);
    const contrast = makeEl('viz-group-contrast', contrastBag);
    const sameOn = makeEl('viz-same-sign-enabled', new Set());
    const oppOn = makeEl('viz-opposite-enabled', new Set());
    const hueOn = makeEl('viz-group-hue-enabled', new Set());
    const zeroOn = makeEl('viz-zero-coverage-enabled', new Set());
    const byId = {
      '#viz-shared-noise': shared,
      '#viz-group-contrast': contrast,
      '#viz-same-sign-enabled': sameOn,
      '#viz-opposite-enabled': oppOn,
      '#viz-group-hue-enabled': hueOn,
      '#viz-zero-coverage-enabled': zeroOn,
      '#viz-group-hue-rows': {
        classList: { toggle: () => {} },
        querySelectorAll: () => [],
        set innerHTML(_v) {},
        get innerHTML() { return ''; },
      },
    };
    const container = {
      querySelector: (sel) => byId[sel] || null,
      querySelectorAll: (sel) => {
        if (sel === '.viz-fx-slider[data-requires="zero-coverage"]') return [];
        if (sel === '.viz-fx-slider[data-requires="same-sign"]') return [];
        if (sel === '.viz-fx-slider[data-requires="opposite"]') return [];
        if (sel === '#viz-group-hue-rows input') return [];
        return [];
      },
    };

    expect(shared.classList.contains('is-disabled')).toBe(true);
    expect(contrast.classList.contains('is-disabled')).toBe(true);

    const config = resolveVisualizationSettings({ ...DEFAULT_VISUALIZATION_SETTINGS });
    setSharedNoiseControlsEnabled(container, true, config);
    expect(shared.classList.contains('is-disabled')).toBe(false);
    expect(contrast.classList.contains('is-disabled')).toBe(true);
    expect(sameOn.disabled).toBe(false);

    setGroupContrastControlsEnabled(container, true, config, ['G1', 'G2']);
    expect(contrast.classList.contains('is-disabled')).toBe(false);
    expect(oppOn.disabled).toBe(false);
  });

  it('Shared noise SAE lockout greys toggle and sets tooltip', () => {
    const classBag = new Set();
    const disabled = new Map();
    const hint = { textContent: 'Requires ≥2 compare tokens.' };
    const sameOn = {
      id: 'viz-same-sign-enabled',
      classList: { contains: () => false, toggle: () => {} },
      setAttribute: () => {},
      title: '',
      get disabled() { return Boolean(disabled.get('viz-same-sign-enabled')); },
      set disabled(v) { disabled.set('viz-same-sign-enabled', Boolean(v)); },
    };
    const shared = {
      id: 'viz-shared-noise',
      title: '',
      classList: {
        contains: (c) => classBag.has(c),
        toggle: (c, on) => {
          if (on) classBag.add(c);
          else classBag.delete(c);
        },
      },
      setAttribute: () => {},
      querySelector: (sel) => {
        if (sel === '.viz-shared-noise-hint') return hint;
        if (sel === '#viz-same-sign-enabled') return sameOn;
        return null;
      },
    };
    const container = {
      querySelector: (sel) => {
        if (sel === '#viz-shared-noise') return shared;
        if (sel === '#viz-same-sign-enabled') return sameOn;
        if (sel === '#viz-zero-coverage-enabled') {
          return { disabled: false, set disabled(_v) {} };
        }
        if (sel === '#viz-group-contrast') {
          return { classList: { contains: () => true } };
        }
        return null;
      },
      querySelectorAll: () => [],
    };
    const config = resolveVisualizationSettings({ ...DEFAULT_VISUALIZATION_SETTINGS });
    setSharedNoiseControlsEnabled(container, true, config, { saeLockout: true });
    expect(shared.classList.contains('is-disabled')).toBe(true);
    expect(sameOn.disabled).toBe(true);
    expect(hint.textContent).toBe('Shared noise disabled in SAE mode');
    expect(shared.title).toBe('Shared noise disabled in SAE mode');
    expect(sameOn.title).toBe('Shared noise disabled in SAE mode');
  });

  it('viz panel body uses taller HUD-capped height with side scrollbar', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/style.css'), 'utf8');
    const chrome = readFileSync(resolve(process.cwd(), 'src/theme/chrome.css'), 'utf8');
    expect(css).toMatch(
      /\.viz-panel-body\s*\{[\s\S]*?max-height:\s*min\([\s\S]*?68vh[\s\S]*?600px[\s\S]*?100dvh[\s\S]*?--hud-height/,
    );
    expect(css).toMatch(/\.viz-panel-body\s*\{[\s\S]*?overflow-y:\s*auto/);
    expect(css).toMatch(/\.viz-panel-body\s*\{[\s\S]*?scrollbar-gutter:\s*stable/);
    expect(chrome).toMatch(
      /\.viz-panel-body\s*\{[\s\S]*?max-height:\s*min\([\s\S]*?68vh[\s\S]*?600px/,
    );
    expect(css).not.toMatch(/\.viz-panel-body\s*\{[\s\S]*?max-height:\s*min\(56vh,\s*520px\)/);
  });

  it('collapse tab is a sibling of viz-panel-body (outside card chrome)', () => {
    const html = visualizationControlsMarkup(DEFAULT_VISUALIZATION_SETTINGS, { collapsed: false });
    const hostOpen = html.indexOf('id="visualization-controls-container"');
    const tabOpen = html.indexOf('class="viz-panel-tab dock-tab"');
    const bodyOpen = html.indexOf('id="viz-panel-body"');
    const bodyClose = html.indexOf('</div>\n</div>', bodyOpen);
    expect(hostOpen).toBeGreaterThan(-1);
    expect(tabOpen).toBeGreaterThan(hostOpen);
    expect(bodyOpen).toBeGreaterThan(tabOpen);
    // Tab must not be nested inside the body card markup.
    expect(tabOpen).toBeLessThan(bodyOpen);
    expect(bodyClose).toBeGreaterThan(bodyOpen);
    expect(html.slice(bodyOpen, bodyClose)).not.toContain('viz-panel-tab');
  });

  it('collapsed markup starts with expand glyph', () => {
    const html = visualizationControlsMarkup(DEFAULT_VISUALIZATION_SETTINGS, { collapsed: true });
    expect(html).toContain('is-collapsed');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('▲');
  });

  it('sheet layout uses the same vertical glyphs and layout attribute', () => {
    expect(vizPanelLayoutForViewport(true)).toBe('sheet');
    expect(vizPanelLayoutForViewport(false)).toBe('edge');
    expect(vizPanelTabGlyph(true, 'sheet')).toBe('▲');
    expect(vizPanelTabGlyph(false, 'sheet')).toBe('▼');
    const html = visualizationControlsMarkup(DEFAULT_VISUALIZATION_SETTINGS, {
      collapsed: true,
      layout: 'sheet',
    });
    expect(html).toContain('data-viz-layout="sheet"');
    expect(html).toContain('▲');
    expect(html).toContain('Expand Visualization sheet');
  });

  it('resolveVisualizationMountParent always uses app root (HUD glue)', () => {
    const dockBody = { id: 'dock' };
    const appRoot = { id: 'app' };
    expect(resolveVisualizationMountParent({
      isMobile: true,
      dockBody,
      appRoot,
    })).toBe(appRoot);
    expect(resolveVisualizationMountParent({
      isMobile: false,
      dockBody,
      appRoot,
    })).toBe(appRoot);
  });

  it('setVisualizationPanelCollapsed toggles class and glyph', () => {
    const classList = new Set(['section-card', 'viz-panel']);
    const tab = {
      textContent: '▼',
      attrs: {},
      setAttribute(k, v) { this.attrs[k] = String(v); },
    };
    const el = {
      dataset: { vizLayout: 'edge' },
      classList: {
        toggle: (cls, force) => {
          if (force) classList.add(cls);
          else classList.delete(cls);
        },
        contains: (cls) => classList.has(cls),
      },
      querySelector: (sel) => (sel === '.viz-panel-tab' ? tab : null),
    };
    setVisualizationPanelCollapsed(el, true);
    expect(classList.has('is-collapsed')).toBe(true);
    expect(tab.textContent).toBe('▲');
    expect(tab.attrs['aria-expanded']).toBe('false');
    setVisualizationPanelCollapsed(el, false);
    expect(classList.has('is-collapsed')).toBe(false);
    expect(tab.textContent).toBe('▼');
  });

  it('setVisualizationPanelLayout keeps vertical glyphs on sheet', () => {
    const classList = new Set(['section-card', 'viz-panel', 'is-collapsed']);
    const tab = {
      textContent: '▲',
      attrs: {},
      setAttribute(k, v) { this.attrs[k] = String(v); },
    };
    const el = {
      dataset: { vizLayout: 'edge' },
      classList: {
        toggle: (cls, force) => {
          if (force) classList.add(cls);
          else classList.delete(cls);
        },
        contains: (cls) => classList.has(cls),
      },
      querySelector: (sel) => (sel === '.viz-panel-tab' ? tab : null),
    };
    setVisualizationPanelLayout(el, 'sheet');
    expect(el.dataset.vizLayout).toBe('sheet');
    expect(tab.textContent).toBe('▲');
  });
});

describe('shouldShowActivation / filter helpers', () => {
  const samples = [1, 0.5, 0.005, -0.5, -1];

  it('all mode shows every sample', () => {
    for (const v of samples) {
      expect(shouldShowActivation(v, 'all')).toBe(true);
    }
  });

  it('+ only hides negatives and near-zero', () => {
    expect(shouldShowActivation(1, 'positive')).toBe(true);
    expect(shouldShowActivation(0.5, 'positive')).toBe(true);
    expect(shouldShowActivation(0.005, 'positive')).toBe(false);
    expect(shouldShowActivation(-0.5, 'positive')).toBe(false);
    expect(shouldShowActivation(-1, 'positive')).toBe(false);
  });

  it('− only hides positives and near-zero', () => {
    expect(shouldShowActivation(1, 'negative')).toBe(false);
    expect(shouldShowActivation(0.5, 'negative')).toBe(false);
    expect(shouldShowActivation(0.005, 'negative')).toBe(false);
    expect(shouldShowActivation(-0.5, 'negative')).toBe(true);
    expect(shouldShowActivation(-1, 'negative')).toBe(true);
  });

  it('uses ε = 0.01 by default', () => {
    expect(NEAR_ZERO_EPS).toBe(0.01);
    expect(shouldShowActivation(0.009, 'positive')).toBe(false);
    expect(shouldShowActivation(0.01, 'positive')).toBe(true);
  });

  it('filterPointsData keeps aligned entries', () => {
    const points = samples.map((activation, i) => ({ i, activation }));
    const kept = filterPointsData(points, samples, 'positive');
    expect(kept.map((p) => p.i)).toEqual([0, 1]);
  });

  it('lineSegmentIndices breaks across hidden signs', () => {
    // visible, visible, near-zero, visible-neg → only first segment
    const norm = [0.5, 0.8, 0.0, -0.5];
    expect(lineSegmentIndices(norm, 'positive')).toEqual([0, 1]);
    expect(lineSegmentIndices(norm, 'all')).toEqual([0, 1, 1, 2, 2, 3]);
  });

  it('wideRibbonQuadIndices omits quads for filtered pairs', () => {
    const norm = [0.5, 0.8, -0.5];
    expect(wideRibbonQuadIndices(norm, 'positive')).toEqual([0, 2, 1, 1, 2, 3]);
    expect(wideRibbonQuadIndices(norm, 'negative')).toEqual([]);
  });
});

describe('getDivergentColor with color anchors', () => {
  const anchors = anchorsFromSettings(DEFAULT_VISUALIZATION_SETTINGS);

  it('t=1 → +1 hex', () => {
    const c = getDivergentColor(1, 1, anchors);
    expect(c.r).toBeCloseTo(anchors.positive.r, 5);
    expect(c.g).toBeCloseTo(anchors.positive.g, 5);
    expect(c.b).toBeCloseTo(anchors.positive.b, 5);
  });

  it('t=0 → 0 hex with low alpha', () => {
    const c = getDivergentColor(0, 1, anchors);
    expect(c.r).toBeCloseTo(anchors.zero.r, 5);
    expect(c.g).toBeCloseTo(anchors.zero.g, 5);
    expect(c.b).toBeCloseTo(anchors.zero.b, 5);
    expect(c.alpha).toBeCloseTo(0.05, 5);
  });

  it('t=-1 → −1 hex', () => {
    const c = getDivergentColor(-1, 1, anchors);
    expect(c.r).toBeCloseTo(anchors.negative.r, 5);
    expect(c.g).toBeCloseTo(anchors.negative.g, 5);
    expect(c.b).toBeCloseTo(anchors.negative.b, 5);
  });

  it('t=0.5 → midpoint lerp 0↔+1', () => {
    const c = getDivergentColor(0.5, 1, anchors);
    expect(c.r).toBeCloseTo((anchors.zero.r + anchors.positive.r) / 2, 5);
    expect(c.g).toBeCloseTo((anchors.zero.g + anchors.positive.g) / 2, 5);
    expect(c.b).toBeCloseTo((anchors.zero.b + anchors.positive.b) / 2, 5);
  });

  it('zero coverage 50% keeps mid activations at zero color', () => {
    const c = getDivergentColor(0.4, 1, anchors, 50);
    expect(c.r).toBeCloseTo(anchors.zero.r, 5);
    expect(c.g).toBeCloseTo(anchors.zero.g, 5);
    expect(c.b).toBeCloseTo(anchors.zero.b, 5);
    const midPos = getDivergentColor(0.75, 1, anchors, 50);
    // remapped k = (0.75-0.5)/(1-0.5) = 0.5 → midpoint
    expect(midPos.r).toBeCloseTo((anchors.zero.r + anchors.positive.r) / 2, 5);
  });
});

describe('remapAbsTWithZeroCoverage', () => {
  it('identity at 0 coverage', () => {
    expect(remapAbsTWithZeroCoverage(0.4, 0)).toBeCloseTo(0.4, 5);
  });

  it('holds zero then stretches', () => {
    expect(remapAbsTWithZeroCoverage(0.3, 0.5)).toBe(0);
    expect(remapAbsTWithZeroCoverage(0.5, 0.5)).toBe(0);
    expect(remapAbsTWithZeroCoverage(0.75, 0.5)).toBeCloseTo(0.5, 5);
    expect(remapAbsTWithZeroCoverage(1, 0.5)).toBeCloseTo(1, 5);
  });

  it('supports 100% coverage (full zero band)', () => {
    const c = HIGH_COVERAGE_MAX / 100;
    expect(c).toBe(1);
    expect(remapAbsTWithZeroCoverage(0.99, c)).toBe(0);
    expect(remapAbsTWithZeroCoverage(1, c)).toBe(0);
  });

  it('normalizeZeroCoverage clamps conflict cover 0–90', () => {
    expect(normalizeZeroCoverage(150)).toBe(90);
    expect(normalizeZeroCoverage(-3)).toBe(0);
    expect(normalizeZeroCoverage('40')).toBe(40);
  });

  it('normalizeHighCoverage clamps 30…100', () => {
    expect(normalizeHighCoverage(10)).toBe(HIGH_COVERAGE_MIN);
    expect(normalizeHighCoverage(100)).toBe(HIGH_COVERAGE_MAX);
    expect(normalizeHighCoverage(150)).toBe(HIGH_COVERAGE_MAX);
    expect(normalizeHighCoverage(50.12345)).toBeCloseTo(50.12345, 5);
    expect(normalizeHighCoverage(50.123456)).toBeCloseTo(50.12346, 5);
  });

  it('highCoverage slider maps endpoints', () => {
    expect(highCoverageFromSlider(0)).toBe(HIGH_COVERAGE_MIN);
    expect(highCoverageFromSlider(HIGH_COVERAGE_SLIDER_MAX)).toBe(HIGH_COVERAGE_MAX);
    expect(highCoverageToSlider(HIGH_COVERAGE_MIN)).toBe(0);
    expect(highCoverageToSlider(HIGH_COVERAGE_MAX)).toBe(HIGH_COVERAGE_SLIDER_MAX);
    expect(formatHighCoverage(HIGH_COVERAGE_MAX)).toBe('100%');
  });

  it('parseHighCoverageInput accepts typed percents', () => {
    expect(parseHighCoverageInput('100')).toBe(100);
    expect(parseHighCoverageInput('100%')).toBe(100);
    expect(parseHighCoverageInput(' 55.5 ')).toBe(55.5);
    expect(parseHighCoverageInput('bogus')).toBe(HIGH_COVERAGE_MIN);
  });

  it('effectiveZeroCoveragePercent is 0 when Off', () => {
    expect(effectiveZeroCoveragePercent({ zeroCoverageEnabled: false, zeroCoverage: 80 })).toBe(0);
    expect(effectiveZeroCoveragePercent({ zeroCoverageEnabled: true, zeroCoverage: 80 })).toBe(80);
  });

  it('syncGroupHueColorRows uses textarea labels and scrolls past 3 groups', () => {
    let rowsHtml = '';
    let scrollable = false;
    const host = {
      classList: {
        toggle: (cls, on) => {
          if (cls === 'is-scrollable') scrollable = Boolean(on);
        },
      },
      set innerHTML(v) { rowsHtml = String(v); },
      get innerHTML() { return rowsHtml; },
      querySelectorAll: () => [],
    };
    const container = {
      querySelector: (sel) => {
        if (sel === '#viz-group-hue-rows') return host;
        return null;
      },
      querySelectorAll: () => [],
    };
    const config = resolveVisualizationSettings({ groupHueEnabled: true });
    syncGroupHueColorRows(container, [
      { id: 'animals', label: 'animals' },
      { id: 'it_core', label: 'it_core' },
      { id: 'women', label: 'women' },
    ], config);
    expect(rowsHtml).toContain('>animals<');
    expect(rowsHtml).toContain('>it_core<');
    expect(rowsHtml).toContain('>women<');
    expect(rowsHtml).toContain('data-group-id="animals"');
    expect(scrollable).toBe(false);

    syncGroupHueColorRows(container, ['G1', 'G2', 'G3', 'G4'], config);
    expect(rowsHtml).toContain('>G1<');
    expect(rowsHtml).toContain('>G4<');
    expect(scrollable).toBe(true);
  });

  describe('Spectral Quorum UI and wiring', () => {
    function createMockElement(initial = {}) {
      const listeners = {};
      const classes = new Set(initial.classes || []);
      return {
        value: initial.value ?? '',
        checked: initial.checked ?? false,
        disabled: initial.disabled ?? false,
        textContent: initial.textContent ?? '',
        classList: {
          contains: (cls) => classes.has(cls),
          add: (cls) => classes.add(cls),
          remove: (cls) => classes.delete(cls),
          toggle: (cls, on) => (on ? classes.add(cls) : classes.delete(cls)),
        },
        addEventListener: (type, fn) => {
          listeners[type] = listeners[type] || [];
          listeners[type].push(fn);
        },
        trigger: (type, eventObj = {}) => {
          (listeners[type] || []).forEach((fn) => fn(eventObj));
        },
      };
    }

    function createMockContainer(contrastDisabled = false) {
      const elements = {
        '#viz-spectral-enabled': createMockElement(),
        '#viz-spectral-swatch': createMockElement({ value: '#00E5FF' }),
        '#viz-spectral-hex': createMockElement({ value: '#00E5FF' }),
        '#viz-spectral-quorum': createMockElement({ value: '10' }),
        '#viz-spectral-quorum-val': createMockElement({ textContent: '10%' }),
        '#viz-spectral-gain': createMockElement({ value: '10' }),
        '#viz-spectral-gain-val': createMockElement({ textContent: '10×' }),
        '#viz-spectral-strength': createMockElement({ value: '100' }),
        '#viz-spectral-strength-val': createMockElement({ textContent: '100%' }),
        '#viz-spectral-paja-cancel': createMockElement({ value: '100' }),
        '#viz-spectral-paja-cancel-val': createMockElement({ textContent: '100%' }),
        '#viz-group-contrast': createMockElement({ classes: contrastDisabled ? ['is-disabled'] : [] }),
        '#viz-shared-noise': createMockElement({ classes: ['is-disabled'] }),
        '#viz-same-sign-enabled': createMockElement(),
        '#viz-opposite-enabled': createMockElement(),
        '#viz-group-hue-enabled': createMockElement(),
      };

      const spectralRow = createMockElement();
      const rows = {
        '.viz-fx-slider[data-requires="spectral"]': [spectralRow],
        '.viz-fx-slider[data-requires="opposite"]': [],
        '.viz-fx-slider[data-requires="same-sign"]': [],
        '.viz-fx-slider[data-requires="zero-coverage"]': [],
        'input[name="viz-filter-mode"]': [],
        '#viz-group-hue-rows input': [],
      };

      return {
        elements,
        spectralRow,
        querySelector: (sel) => elements[sel] || null,
        querySelectorAll: (sel) => rows[sel] || [],
      };
    }

    it('syncVisualizationControlsFromConfig populates spectral inputs and labels', () => {
      const container = createMockContainer();
      const custom = {
        ...DEFAULT_VISUALIZATION_SETTINGS,
        spectralQuorumEnabled: true,
        spectralHighlightColor: '#FF0055',
        spectralQuorumPercent: 20,
        spectralDecimalGain: 25,
        spectralHighlightStrength: 80,
        spectralPajaCancelCoverage: 75,
      };
      syncVisualizationControlsFromConfig(container, custom);

      expect(container.querySelector('#viz-spectral-enabled').checked).toBe(true);
      expect(container.querySelector('#viz-spectral-swatch').value).toBe('#FF0055');
      expect(container.querySelector('#viz-spectral-hex').value).toBe('#FF0055');
      expect(container.querySelector('#viz-spectral-quorum').value).toBe('20');
      expect(container.querySelector('#viz-spectral-quorum-val').textContent).toBe('20%');
      expect(container.querySelector('#viz-spectral-gain').value).toBe('25');
      expect(container.querySelector('#viz-spectral-gain-val').textContent).toBe('25×');
      expect(container.querySelector('#viz-spectral-strength').value).toBe('80');
      expect(container.querySelector('#viz-spectral-strength-val').textContent).toBe('80%');
      expect(container.querySelector('#viz-spectral-paja-cancel').value).toBe('75');
      expect(container.querySelector('#viz-spectral-paja-cancel-val').textContent).toBe('75%');
    });

    it('syncGroupFxSliderEnabled gates spectral controls based on groupsOk & enabled', () => {
      // 1. Group contrast disabled
      const c1 = createMockContainer(true);
      syncGroupFxSliderEnabled(c1, { ...DEFAULT_VISUALIZATION_SETTINGS, spectralQuorumEnabled: true });
      expect(c1.querySelector('#viz-spectral-enabled').disabled).toBe(true);
      expect(c1.querySelector('#viz-spectral-swatch').disabled).toBe(true);
      expect(c1.querySelector('#viz-spectral-quorum').disabled).toBe(true);
      expect(c1.querySelector('#viz-spectral-gain').disabled).toBe(true);
      expect(c1.spectralRow.classList.contains('is-inert')).toBe(true);

      // 2. Group contrast enabled, but spectralQuorumEnabled = false
      const c2 = createMockContainer(false);
      syncGroupFxSliderEnabled(c2, { ...DEFAULT_VISUALIZATION_SETTINGS, spectralQuorumEnabled: false });
      expect(c2.querySelector('#viz-spectral-enabled').disabled).toBe(false);
      expect(c2.querySelector('#viz-spectral-swatch').disabled).toBe(true);
      expect(c2.querySelector('#viz-spectral-quorum').disabled).toBe(true);
      expect(c2.querySelector('#viz-spectral-gain').disabled).toBe(true);
      expect(c2.spectralRow.classList.contains('is-inert')).toBe(true);

      // 3. Group contrast enabled, and spectralQuorumEnabled = true
      const c3 = createMockContainer(false);
      syncGroupFxSliderEnabled(c3, { ...DEFAULT_VISUALIZATION_SETTINGS, spectralQuorumEnabled: true });
      expect(c3.querySelector('#viz-spectral-enabled').disabled).toBe(false);
      expect(c3.querySelector('#viz-spectral-swatch').disabled).toBe(false);
      expect(c3.querySelector('#viz-spectral-quorum').disabled).toBe(false);
      expect(c3.querySelector('#viz-spectral-gain').disabled).toBe(false);
      expect(c3.querySelector('#viz-spectral-strength').disabled).toBe(false);
      expect(c3.querySelector('#viz-spectral-paja-cancel').disabled).toBe(false);
      expect(c3.spectralRow.classList.contains('is-inert')).toBe(false);
    });

    it('wireVisualizationControls updates config and emits on spectral input events', () => {
      const container = createMockContainer(false);
      const config = { ...DEFAULT_VISUALIZATION_SETTINGS };
      let emitCount = 0;
      wireVisualizationControls(container, config, () => { emitCount += 1; });

      // Toggle enabled
      const specOn = container.querySelector('#viz-spectral-enabled');
      specOn.checked = true;
      specOn.trigger('change');
      expect(config.spectralQuorumEnabled).toBe(true);
      expect(emitCount).toBe(1);

      // Slider Quorum %
      const specQuorum = container.querySelector('#viz-spectral-quorum');
      specQuorum.value = '15';
      specQuorum.trigger('input');
      expect(config.spectralQuorumPercent).toBe(15);
      expect(container.querySelector('#viz-spectral-quorum-val').textContent).toBe('15%');
      expect(emitCount).toBe(2);

      // Slider Decimal gain
      const specGain = container.querySelector('#viz-spectral-gain');
      specGain.value = '20';
      specGain.trigger('input');
      expect(config.spectralDecimalGain).toBe(20);
      expect(container.querySelector('#viz-spectral-gain-val').textContent).toBe('20×');
      expect(emitCount).toBe(3);

      // Slider Strength
      const specStr = container.querySelector('#viz-spectral-strength');
      specStr.value = '50';
      specStr.trigger('input');
      expect(config.spectralHighlightStrength).toBe(50);
      expect(container.querySelector('#viz-spectral-strength-val').textContent).toBe('50%');
      expect(emitCount).toBe(4);

      // Slider Paja cancel
      const specCancel = container.querySelector('#viz-spectral-paja-cancel');
      specCancel.value = '80';
      specCancel.trigger('input');
      expect(config.spectralPajaCancelCoverage).toBe(80);
      expect(container.querySelector('#viz-spectral-paja-cancel-val').textContent).toBe('80%');
      expect(emitCount).toBe(5);

      // Swatch color
      const specSwatch = container.querySelector('#viz-spectral-swatch');
      specSwatch.value = '#112233';
      specSwatch.trigger('input');
      expect(config.spectralHighlightColor).toBe('#112233');
      expect(emitCount).toBe(6);
    });
  });
});
