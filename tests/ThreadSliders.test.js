import { describe, it, expect } from 'vitest';
import { threadSlidersMarkup } from '../src/ui/ThreadSliders.js';

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

/** Defaults = midpoint of each spatial slider (Control Espacial 3D). */
const SPATIAL_SLIDER_SPECS = [
  { id: 'thread-spacing-slider', mid: 0.4, min: 0.1, max: 0.7, step: 0.1 },
  { id: 'thread-vector-dist-slider', mid: 10.0, min: 1.0, max: 19.0, step: 1.0 },
  { id: 'thread-amplitude-y-slider', mid: 7.0, min: 1.0, max: 13.0, step: 1.0 },
  { id: 'thread-width-slider', mid: 0.2, min: 0.1, max: 0.3, step: 0.1 },
  { id: 'thread-thickness-slider', mid: 0.1, min: 0.05, max: 0.15, step: 0.05 },
];

describe('threadSlidersMarkup — ranges centered on defaults', () => {
  it('emits min/max/step/value so each default is the linear midpoint', () => {
    const html = threadSlidersMarkup();

    for (const spec of SPATIAL_SLIDER_SPECS) {
      const input = parseRangeInput(html, spec.id);
      expect(input, spec.id).not.toBeNull();
      expect(input.min).toBeCloseTo(spec.min, 5);
      expect(input.max).toBeCloseTo(spec.max, 5);
      expect(input.step).toBeCloseTo(spec.step, 5);
      expect(input.value).toBeCloseTo(spec.mid, 5);

      const mid = (input.min + input.max) / 2;
      expect(mid).toBeCloseTo(spec.mid, 5);
      // Mid must land on a step tick (within float noise).
      const ticksFromMin = (spec.mid - input.min) / input.step;
      expect(ticksFromMin).toBeCloseTo(Math.round(ticksFromMin), 5);
    }
  });

  it('keeps explicit config values as the input value (still within range)', () => {
    const html = threadSlidersMarkup({
      threadSpacing: 0.4,
      threadVectorDistance: 10.0,
      threadAmplitudeY: 7.0,
      threadWidth: 0.2,
      threadThickness: 0.1,
    });

    expect(parseRangeInput(html, 'thread-spacing-slider').value).toBeCloseTo(0.4, 5);
    expect(parseRangeInput(html, 'thread-vector-dist-slider').value).toBeCloseTo(10.0, 5);
    expect(parseRangeInput(html, 'thread-amplitude-y-slider').value).toBeCloseTo(7.0, 5);
    expect(parseRangeInput(html, 'thread-width-slider').value).toBeCloseTo(0.2, 5);
    expect(parseRangeInput(html, 'thread-thickness-slider').value).toBeCloseTo(0.1, 5);
  });
});
