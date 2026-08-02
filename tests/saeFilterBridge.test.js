import { describe, it, expect } from 'vitest';
import {
  SAE_ON_FILTER_MODE,
  snapshotFilterForSae,
  filterModeForSaeOn,
  restoreFilterAfterSae,
} from '../src/ui/saeFilterBridge.js';

describe('saeFilterBridge', () => {
  it('SAE ON forces + Only (positive)', () => {
    expect(filterModeForSaeOn()).toBe('positive');
    expect(SAE_ON_FILTER_MODE).toBe('positive');
  });

  it('snapshots current filter and restores it after SAE OFF', () => {
    const snap = snapshotFilterForSae('all');
    expect(snap.previousMode).toBe('all');
    expect(restoreFilterAfterSae(snap)).toBe('all');

    const snapNeg = snapshotFilterForSae('negative');
    expect(restoreFilterAfterSae(snapNeg)).toBe('negative');
  });

  it('normalizes invalid snapshot modes to all', () => {
    expect(snapshotFilterForSae('bogus').previousMode).toBe('all');
    expect(restoreFilterAfterSae(null)).toBeNull();
    expect(restoreFilterAfterSae(undefined)).toBeNull();
  });
});
