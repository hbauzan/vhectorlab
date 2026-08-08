import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RENDER_MODE,
  DEFAULT_VIEW_MODE,
  DEFAULT_WORKSPACE_MODE,
} from '../src/ui/appViewDefaults.js';
import {
  canvasStartupContext,
  formatHoverForFooter,
  resolveCanvasSize,
} from '../src/v25/canvasHost.js';

describe('v25 canvasHost helpers', () => {
  it('startup context is ARITHMETIC | ANALYSIS | POINTS', () => {
    expect(canvasStartupContext()).toEqual({
      workspaceMode: DEFAULT_WORKSPACE_MODE,
      viewMode: DEFAULT_VIEW_MODE,
      renderMode: DEFAULT_RENDER_MODE,
    });
    expect(canvasStartupContext()).toEqual({
      workspaceMode: 'ARITHMETIC',
      viewMode: 'ANALYSIS',
      renderMode: 'POINTS',
    });
  });

  it('resolveCanvasSize floors to at least 1×1', () => {
    expect(resolveCanvasSize(null)).toEqual({ width: 1, height: 1 });
    expect(resolveCanvasSize({ clientWidth: 0, clientHeight: 0 })).toEqual({
      width: 1,
      height: 1,
    });
    expect(resolveCanvasSize({ clientWidth: 640, clientHeight: 400 })).toEqual({
      width: 640,
      height: 400,
    });
  });

  it('formatHoverForFooter clears when no hit', () => {
    const cleared = formatHoverForFooter(null);
    expect(cleared.coords).toContain('--');
    expect(cleared.segment).toBe('NEUTRAL SPACE');
    expect(cleared.dim).toBe('DIM: --');
    expect(cleared.activation).toMatch(/ACTIVATION:\s*--/);
    expect(cleared.token).toBe('NONE');
  });

  it('formatHoverForFooter maps pointsData activation', () => {
    const formatted = formatHoverForFooter({
      index: 0,
      point: { x: 12.4, y: -3.2, z: 90.7 },
      userData: {
        pointsData: [
          {
            activation: 0.55,
            meta: { type: 'res', token: 'queen', dim: 7 },
          },
        ],
      },
    });
    expect(formatted.coords).toBe('X: 12 | Y: -3 | Z: 91');
    expect(formatted.segment).toBe('RES');
    expect(formatted.dim).toBe('DIM: 7');
    expect(formatted.token).toBe('queen');
    expect(formatted.activation).toMatch(/ACTIVATION:/);
    expect(formatted.activation).toContain('0.55');
  });
});
