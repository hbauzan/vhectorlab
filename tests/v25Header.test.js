import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RENDER_MODE,
  DEFAULT_VIEW_MODE,
  DEFAULT_WORKSPACE_MODE,
} from '../src/ui/appViewDefaults.js';
import {
  applyHeaderSelection,
  applyOnlineStatus,
  createHeaderState,
  HEADER_OPTIONS,
} from '../src/v25/ui/header.js';
import { PRODUCT_NAME, PRODUCT_VERSION } from '../src/v25/version.js';

describe('v25 header state', () => {
  it('defaults to ARITHMETIC | ANALYSIS | POINTS + online', () => {
    expect(createHeaderState()).toEqual({
      workspace: DEFAULT_WORKSPACE_MODE,
      view: DEFAULT_VIEW_MODE,
      render: DEFAULT_RENDER_MODE,
      online: true,
    });
  });

  it('switches workspace / view / render independently', () => {
    let state = createHeaderState();
    state = applyHeaderSelection(state, 'workspace', 'COMPARE');
    state = applyHeaderSelection(state, 'view', 'NAVIGATION');
    state = applyHeaderSelection(state, 'render', 'RIBBONS');
    expect(state).toEqual({
      workspace: 'COMPARE',
      view: 'NAVIGATION',
      render: 'RIBBONS',
      online: true,
    });
  });

  it('ignores unknown values', () => {
    const state = createHeaderState();
    expect(applyHeaderSelection(state, 'render', 'MESH')).toBe(state);
    expect(applyHeaderSelection(state, 'nope', 'X')).toBe(state);
  });

  it('toggles online badge state', () => {
    const online = createHeaderState({ online: true });
    expect(applyOnlineStatus(online, false).online).toBe(false);
    expect(applyOnlineStatus(online, true)).toBe(online);
  });

  it('exposes product option sets matching legacy chrome', () => {
    expect(HEADER_OPTIONS.workspace).toEqual(['ARITHMETIC', 'COMPARE']);
    expect(HEADER_OPTIONS.view).toEqual(['ANALYSIS', 'NAVIGATION']);
    expect(HEADER_OPTIONS.render).toEqual(['POINTS', 'RIBBONS']);
  });

  it('keeps brand + version constants', () => {
    expect(PRODUCT_NAME).toBe('VHectorLab-3D');
    expect(PRODUCT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
