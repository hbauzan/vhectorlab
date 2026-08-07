import { describe, expect, it } from 'vitest';
import {
  leftPanelVisibility,
  preferredViewForWorkspace,
} from '../src/v25/leftPanelMode.js';

describe('v25 left panel MODE visibility', () => {
  it('hides the inactive slot so flex cannot leave a black gap', () => {
    expect(leftPanelVisibility('COMPARE')).toEqual({
      arithmeticHidden: true,
      compareHidden: false,
    });
    expect(leftPanelVisibility('ARITHMETIC')).toEqual({
      arithmeticHidden: false,
      compareHidden: true,
    });
  });

  it('prefers NAVIGATION framing for Compare, ANALYSIS for Arithmetic', () => {
    expect(preferredViewForWorkspace('COMPARE')).toBe('NAVIGATION');
    expect(preferredViewForWorkspace('ARITHMETIC')).toBe('ANALYSIS');
  });
});
