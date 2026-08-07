import { describe, expect, it } from 'vitest';
import { DEFAULT_VISUALIZATION_SETTINGS } from '../src/ui/visualizationControlsDefaults.js';
import { mergeVizConfig } from '../src/v25/canvasHost.js';

describe('v25 viz wire', () => {
  it('mergeVizConfig patches filter colors and labels', () => {
    const next = mergeVizConfig(DEFAULT_VISUALIZATION_SETTINGS, {
      vizFilterMode: 'positive',
      colorPositive: '#ff0000',
      labelsVisible: false,
      ignore: 1,
    });
    expect(next.vizFilterMode).toBe('positive');
    expect(next.colorPositive).toBe('#ff0000');
    expect(next.labelsVisible).toBe(false);
    expect(next.colorZero).toBe(DEFAULT_VISUALIZATION_SETTINGS.colorZero);
    expect(next).not.toHaveProperty('ignore');
  });
});
