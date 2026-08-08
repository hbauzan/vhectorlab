import { describe, expect, it } from 'vitest';
import { resolveSpatialDefaults } from '../src/ui/spatialSliderDefaults.js';
import { DEFAULT_VISUALIZATION_SETTINGS } from '../src/ui/visualizationControlsDefaults.js';
import {
  footerHudMarkup,
  HUD_PLACEHOLDERS,
} from '../src/v25/ui/footerHud.js';
import {
  rightDockMarkup,
  SPATIAL_SLIDER_DEFS,
} from '../src/v25/ui/rightDock.js';

describe('v25 right + HUD chrome', () => {
  it('defines five spatial sliders with legacy labels', () => {
    expect(SPATIAL_SLIDER_DEFS.map((d) => d.label)).toEqual([
      'Spacing (X)',
      'Vector Distance (Y)',
      'Amplitude (Y)',
      'Length (Z)',
      'Point Thickness',
    ]);
  });

  it('markup includes operable ranges and viz chrome', () => {
    const html = rightDockMarkup(resolveSpatialDefaults({
      workspaceMode: 'ARITHMETIC',
      viewMode: 'ANALYSIS',
      renderMode: 'POINTS',
    }), {
      ...DEFAULT_VISUALIZATION_SETTINGS,
    });
    expect(html).toContain('type="range"');
    expect(html).toContain('id="lab-spacing"');
    expect(html).toContain('value="40"'); // ANALYSIS amplitude override
    expect(html).toContain('name="lab-viz-filter"');
    expect(html).toContain('id="lab-color-pos"');
    expect(html).toContain('id="lab-labels-toggle"');
    expect(html).toContain('3D Spatial Controls');
  });

  it('footer HUD exposes coords / telemetry / token placeholders', () => {
    const html = footerHudMarkup();
    expect(html).toContain('id="lab-hud-coords"');
    expect(html).toContain('id="lab-hud-dim"');
    expect(html).toContain('id="lab-hud-activation"');
    expect(html).toContain('id="lab-hud-token"');
    expect(html).toContain(HUD_PLACEHOLDERS.coords);
    expect(html).toContain(HUD_PLACEHOLDERS.dim);
    expect(html).toContain('COORDS');
  });
});
