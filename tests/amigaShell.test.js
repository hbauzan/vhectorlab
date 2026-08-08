import { describe, expect, it } from 'vitest';
import { MOBILE_MQ } from '../src/ui/CollapsibleDock.js';
import {
  AMIGA_MOBILE_MQ,
  SHELL_ZONES,
  amigaLayoutModel,
} from '../src/amiga/shell.js';

describe('amiga layout model', () => {
  it('is fullscreen + floating docks — not a v25 panel grid', () => {
    expect(amigaLayoutModel()).toBe('fullscreen-floating-docks');
    expect([...SHELL_ZONES]).toEqual([]);
  });

  it('keeps mobile MQ identical to legacy docks', () => {
    expect(AMIGA_MOBILE_MQ).toBe(MOBILE_MQ);
  });
});
