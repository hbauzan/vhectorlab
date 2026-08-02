import { describe, it, expect, afterEach } from 'vitest';
import { threadSlidersMarkup, wireThreadSliders, syncThreadSlidersFromConfig } from '../src/ui/ThreadSliders.js';
import {
  GLOBAL_SPATIAL_DEFAULTS,
  SPATIAL_DEFAULT_OVERRIDES,
} from '../src/ui/spatialSliderDefaults.js';

/** Parse <input id="..." min max step value> attrs from markup. */
function parseRangeInput(html, id) {
  const re = new RegExp(
    `<input[^>]*id="${id}"[^>]*>`,
    'i'
  );
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  const attr = (name) => {
    const m = tag.match(new RegExp(`${name}="([^"]*)"`));
    return m ? parseFloat(m[1]) : NaN;
  };
  return {
    min: attr('min'),
    max: attr('max'),
    step: attr('step'),
    value: attr('value'),
  };
}

/**
 * Defaults + ranges. Most stay linearly centered (defaultMid === (min+max)/2).
 * Amplitud Y keeps default 7 (no scene regression) with max 40 → asymmetric by design.
 */
const SPATIAL_SLIDER_SPECS = [
  { id: 'thread-spacing-slider', defaultMid: 0.4, min: 0.1, max: 0.7, step: 0.05, centered: true },
  { id: 'thread-vector-dist-slider', defaultMid: 10.0, min: 1.0, max: 19.0, step: 0.1, centered: true },
  { id: 'thread-amplitude-y-slider', defaultMid: 7.0, min: 1.0, max: 40.0, step: 0.1, centered: false },
  { id: 'thread-width-slider', defaultMid: 0.2, min: 0.1, max: 0.3, step: 0.01, centered: true },
  { id: 'thread-thickness-slider', defaultMid: 0.05, min: 0.01, max: 0.09, step: 0.01, centered: true },
];

function createMockEl(id = '') {
  const listeners = {};
  const el = {
    id,
    value: '',
    textContent: '',
    addEventListener: (type, fn) => {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
    },
    dispatch: (type, event = {}) => {
      for (const fn of listeners[type] || []) fn(event);
    },
  };
  return el;
}

describe('threadSlidersMarkup — ranges centered on defaults', () => {
  it('emits min/max/step/value with defaults in range (centered where required)', () => {
    const html = threadSlidersMarkup();

    for (const spec of SPATIAL_SLIDER_SPECS) {
      const input = parseRangeInput(html, spec.id);
      expect(input, spec.id).not.toBeNull();
      expect(input.min).toBeCloseTo(spec.min, 5);
      expect(input.max).toBeCloseTo(spec.max, 5);
      expect(input.step).toBeCloseTo(spec.step, 5);
      expect(input.value).toBeCloseTo(spec.defaultMid, 5);

      // Default must land on a step tick and allow travel both ways.
      const ticksFromMin = (spec.defaultMid - input.min) / input.step;
      expect(ticksFromMin).toBeCloseTo(Math.round(ticksFromMin), 5);
      expect(input.value).toBeGreaterThan(input.min);
      expect(input.value).toBeLessThan(input.max);

      if (spec.centered) {
        const mid = (input.min + input.max) / 2;
        expect(mid).toBeCloseTo(spec.defaultMid, 5);
      }
    }
  });

  it('keeps explicit config values as the input value (still within range)', () => {
    const html = threadSlidersMarkup({
      threadSpacing: 0.4,
      threadVectorDistance: 10.0,
      threadAmplitudeY: 7.0,
      threadWidth: 0.2,
      threadThickness: 0.05,
    });

    expect(parseRangeInput(html, 'thread-spacing-slider').value).toBeCloseTo(0.4, 5);
    expect(parseRangeInput(html, 'thread-vector-dist-slider').value).toBeCloseTo(10.0, 5);
    expect(parseRangeInput(html, 'thread-amplitude-y-slider').value).toBeCloseTo(7.0, 5);
    expect(parseRangeInput(html, 'thread-width-slider').value).toBeCloseTo(0.2, 5);
    expect(parseRangeInput(html, 'thread-thickness-slider').value).toBeCloseTo(0.05, 5);
  });

  it('formats default labels with decimals matching each step', () => {
    const html = threadSlidersMarkup();
    const labelFor = (id) => {
      const m = html.match(new RegExp(`id="${id}"[^>]*>\\s*([\\d.]+)`));
      return m ? m[1] : null;
    };
    expect(labelFor('thread-spacing-val')).toBe('0.40');
    expect(labelFor('thread-vector-dist-val')).toBe('10.0');
    expect(labelFor('thread-amplitude-y-val')).toBe('7.0');
    expect(labelFor('thread-width-val')).toBe('0.20');
    expect(labelFor('thread-thickness-val')).toBe('0.05');
  });
});

describe('wireThreadSliders — dblclick reset', () => {
  const overrideKeys = [];

  afterEach(() => {
    for (const key of overrideKeys.splice(0)) {
      delete SPATIAL_DEFAULT_OVERRIDES[key];
    }
  });

  it('restores only the double-clicked slider to the resolved default', () => {
    const ampInput = createMockEl('thread-amplitude-y-slider');
    const ampLabel = createMockEl('thread-amplitude-y-val');

    const byId = {
      'thread-amplitude-y-slider': ampInput,
      'thread-amplitude-y-val': ampLabel,
      'thread-spacing-slider': createMockEl(),
      'thread-spacing-val': createMockEl(),
      'thread-vector-dist-slider': createMockEl(),
      'thread-vector-dist-val': createMockEl(),
      'thread-width-slider': createMockEl(),
      'thread-width-val': createMockEl(),
      'thread-thickness-slider': createMockEl(),
      'thread-thickness-val': createMockEl(),
    };

    const container = {
      querySelector: (sel) => byId[sel.replace('#', '')] || null,
    };

    const config = {
      threadSpacing: 0.55,
      threadVectorDistance: 14.0,
      threadSpacingY: 14.0,
      threadAmplitudeY: 11.0,
      threadWidth: 0.28,
      threadThickness: 0.08,
    };

    let changeCount = 0;
    wireThreadSliders(container, null, config, () => { changeCount += 1; }, {
      getContext: () => ({
        workspaceMode: 'ARITHMETIC',
        viewMode: 'NAVIGATION',
        renderMode: 'POINTS',
      }),
    });

    ampInput.dispatch('dblclick', { preventDefault() {} });

    expect(config.threadAmplitudeY).toBe(GLOBAL_SPATIAL_DEFAULTS.threadAmplitudeY);
    expect(ampInput.value).toBe(String(GLOBAL_SPATIAL_DEFAULTS.threadAmplitudeY));
    expect(ampLabel.textContent).toBe('7.0');
    expect(config.threadSpacing).toBe(0.55);
    expect(config.threadVectorDistance).toBe(14.0);
    expect(config.threadWidth).toBe(0.28);
    expect(config.threadThickness).toBe(0.08);
    expect(changeCount).toBe(1);
  });

  it('uses context override when defined for current MODE/VISTA/RENDER', () => {
    SPATIAL_DEFAULT_OVERRIDES['COMPARE|ANALYSIS|MESH'] = { threadSpacing: 0.6 };
    overrideKeys.push('COMPARE|ANALYSIS|MESH');

    const spacingInput = createMockEl('thread-spacing-slider');
    const spacingLabel = createMockEl('thread-spacing-val');
    const byId = {
      'thread-spacing-slider': spacingInput,
      'thread-spacing-val': spacingLabel,
      'thread-vector-dist-slider': createMockEl(),
      'thread-vector-dist-val': createMockEl(),
      'thread-amplitude-y-slider': createMockEl(),
      'thread-amplitude-y-val': createMockEl(),
      'thread-width-slider': createMockEl(),
      'thread-width-val': createMockEl(),
      'thread-thickness-slider': createMockEl(),
      'thread-thickness-val': createMockEl(),
    };
    const container = {
      querySelector: (sel) => byId[sel.replace('#', '')] || null,
    };
    const config = { threadSpacing: 0.2 };

    wireThreadSliders(container, null, config, null, {
      getContext: () => ({
        workspaceMode: 'COMPARE',
        viewMode: 'ANALYSIS',
        renderMode: 'MESH',
      }),
    });

    spacingInput.dispatch('dblclick', { preventDefault() {} });
    expect(config.threadSpacing).toBe(0.6);
    expect(spacingLabel.textContent).toBe('0.60');
  });
});

describe('syncThreadSlidersFromConfig', () => {
  it('writes config into inputs and labels', () => {
    const ampInput = createMockEl('thread-amplitude-y-slider');
    const ampLabel = createMockEl('thread-amplitude-y-val');
    const byId = {
      'thread-amplitude-y-slider': ampInput,
      'thread-amplitude-y-val': ampLabel,
      'thread-spacing-slider': createMockEl(),
      'thread-spacing-val': createMockEl(),
      'thread-vector-dist-slider': createMockEl(),
      'thread-vector-dist-val': createMockEl(),
      'thread-width-slider': createMockEl(),
      'thread-width-val': createMockEl(),
      'thread-thickness-slider': createMockEl(),
      'thread-thickness-val': createMockEl(),
    };
    const container = {
      querySelector: (sel) => byId[sel.replace('#', '')] || null,
    };

    syncThreadSlidersFromConfig(container, { threadAmplitudeY: 40.0 });
    expect(ampInput.value).toBe('40');
    expect(ampLabel.textContent).toBe('40.0');
  });
});
