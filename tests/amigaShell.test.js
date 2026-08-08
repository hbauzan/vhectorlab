import { describe, expect, it } from 'vitest';
import { MOBILE_MQ } from '../src/ui/CollapsibleDock.js';
import {
  AMIGA_MOBILE_MQ,
  SHELL_ZONES,
  queryShellZones,
  resolveCanvasSize,
  shellMarkup,
} from '../src/amiga/shell.js';

describe('amiga shell', () => {
  it('lists five zones in product order', () => {
    expect([...SHELL_ZONES]).toEqual([
      'header',
      'left',
      'canvas',
      'right',
      'footer',
    ]);
  });

  it('keeps mobile MQ identical to legacy docks', () => {
    expect(AMIGA_MOBILE_MQ).toBe(MOBILE_MQ);
  });

  it('markup includes data-zone for each region', () => {
    const html = shellMarkup();
    for (const id of SHELL_ZONES) {
      expect(html).toContain(`data-zone="${id}"`);
    }
    expect(html).toContain('data-shell="amiga"');
  });

  it('queryShellZones resolves all regions from a stub root', () => {
    const root = {
      querySelector(sel) {
        const m = String(sel).match(/data-zone="([^"]+)"/);
        if (!m) return null;
        const id = m[1];
        return shellMarkup().includes(`data-zone="${id}"`)
          ? { dataset: { zone: id } }
          : null;
      },
    };
    const zones = queryShellZones(root);
    for (const id of SHELL_ZONES) {
      expect(zones[id]?.dataset?.zone).toBe(id);
    }
  });
});

describe('resolveCanvasSize', () => {
  it('floors to at least 1×1', () => {
    expect(resolveCanvasSize(null)).toEqual({ width: 1, height: 1 });
    expect(resolveCanvasSize({ clientWidth: 320.9, clientHeight: 200.2 })).toEqual({
      width: 320,
      height: 200,
    });
  });
});
