import { describe, expect, it } from 'vitest';
import {
  SHELL_ZONES,
  V25_MOBILE_MQ,
  queryShellZones,
  shellMarkup,
} from '../src/v25/ui/shell.js';
import { MOBILE_MQ } from '../src/ui/CollapsibleDock.js';

describe('v25 shell', () => {
  it('defines exactly five zones in stable order', () => {
    expect([...SHELL_ZONES]).toEqual([
      'header',
      'left',
      'canvas',
      'right',
      'footer',
    ]);
  });

  it('markup includes data-zone for each region', () => {
    const html = shellMarkup();
    for (const id of SHELL_ZONES) {
      expect(html).toContain(`data-zone="${id}"`);
    }
    expect(html).toContain('data-shell="v25"');
  });

  it('queryShellZones resolves all regions from a parsed root', () => {
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
    expect(Object.keys(zones).sort()).toEqual([...SHELL_ZONES].sort());
    for (const id of SHELL_ZONES) {
      expect(zones[id]?.dataset.zone).toBe(id);
    }
  });

  it('reuses legacy MOBILE_MQ string', () => {
    expect(V25_MOBILE_MQ).toBe(MOBILE_MQ);
  });
});
