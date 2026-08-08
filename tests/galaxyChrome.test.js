import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GALAXY_METHOD,
  GALAXY_METHODS,
  GALAXY_VIEW,
  enterGalaxyChrome,
  isGalaxyMethodEnabled,
  isGalaxyView,
  leaveGalaxyChrome,
  snapshotTriad,
} from '../src/ui/galaxyChrome.js';
import {
  DEFAULT_RENDER_MODE,
  DEFAULT_VIEW_MODE,
  DEFAULT_WORKSPACE_MODE,
} from '../src/ui/appViewDefaults.js';

describe('galaxyChrome', () => {
  it('isGalaxyView only for GALAXY', () => {
    expect(isGalaxyView(GALAXY_VIEW)).toBe(true);
    expect(isGalaxyView('ANALYSIS')).toBe(false);
    expect(isGalaxyView('NAVIGATION')).toBe(false);
  });

  it('enterGalaxyChrome forces COMPARE + POINTS and locks MODE/RENDER', () => {
    const entered = enterGalaxyChrome({
      workspaceMode: 'ARITHMETIC',
      viewMode: 'ANALYSIS',
      renderMode: 'RIBBONS',
    });
    expect(entered.viewMode).toBe(GALAXY_VIEW);
    expect(entered.workspaceMode).toBe('COMPARE');
    expect(entered.renderMode).toBe('POINTS');
    expect(entered.method).toBe(DEFAULT_GALAXY_METHOD);
    expect(entered.modeRenderLocked).toBe(true);
    expect(entered.restore).toEqual({
      workspaceMode: 'ARITHMETIC',
      viewMode: 'ANALYSIS',
      renderMode: 'RIBBONS',
    });
  });

  it('leaveGalaxyChrome restores pre-Galaxy triad and unlocks', () => {
    const entered = enterGalaxyChrome({
      workspaceMode: 'COMPARE',
      viewMode: 'NAVIGATION',
      renderMode: 'RIBBONS',
    });
    const left = leaveGalaxyChrome(entered.restore, 'ANALYSIS');
    expect(left.viewMode).toBe('ANALYSIS');
    expect(left.workspaceMode).toBe('COMPARE');
    expect(left.renderMode).toBe('RIBBONS');
    expect(left.modeRenderLocked).toBe(false);
  });

  it('leaveGalaxyChrome to NAVIGATION keeps restored MODE/RENDER', () => {
    const left = leaveGalaxyChrome(
      {
        workspaceMode: 'ARITHMETIC',
        viewMode: 'ANALYSIS',
        renderMode: 'POINTS',
      },
      'NAVIGATION',
    );
    expect(left.viewMode).toBe('NAVIGATION');
    expect(left.workspaceMode).toBe('ARITHMETIC');
    expect(left.renderMode).toBe('POINTS');
  });

  it('PCA and t-SNE chips are disabled with coming-next title; UMAP enabled', () => {
    expect(isGalaxyMethodEnabled('umap')).toBe(true);
    expect(isGalaxyMethodEnabled('pca')).toBe(false);
    expect(isGalaxyMethodEnabled('tsne')).toBe(false);
    expect(GALAXY_METHODS.pca.title).toMatch(/Coming next/i);
    expect(GALAXY_METHODS.tsne.title).toMatch(/Coming next/i);
  });

  it('startup defaults stay ARITHMETIC | ANALYSIS | POINTS (Galaxy is opt-in)', () => {
    expect(DEFAULT_WORKSPACE_MODE).toBe('ARITHMETIC');
    expect(DEFAULT_VIEW_MODE).toBe('ANALYSIS');
    expect(DEFAULT_RENDER_MODE).toBe('POINTS');
    expect(snapshotTriad({})).toEqual({
      workspaceMode: 'ARITHMETIC',
      viewMode: 'ANALYSIS',
      renderMode: 'POINTS',
    });
  });
});
