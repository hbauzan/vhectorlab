/**
 * Galaxy VIEW chrome — triad lock/restore (no layout / no /project).
 * Entering Galaxy forces COMPARE + POINTS; leaving restores the pre-Galaxy triad.
 */

export const GALAXY_VIEW = 'GALAXY';
export const DEFAULT_GALAXY_METHOD = 'umap';

/** Methods shown under GALAXY; only umap is enabled in v1. */
export const GALAXY_METHODS = Object.freeze({
  umap: { id: 'umap', label: 'UMAP', enabled: true },
  pca: {
    id: 'pca',
    label: 'PCA',
    enabled: false,
    title: 'Coming next — PCA / t-SNE projection',
  },
  tsne: {
    id: 'tsne',
    label: 't-SNE',
    enabled: false,
    title: 'Coming next — PCA / t-SNE projection',
  },
});

/**
 * @param {string} [viewMode]
 * @returns {boolean}
 */
export function isGalaxyView(viewMode) {
  return viewMode === GALAXY_VIEW;
}

/**
 * @param {{ workspaceMode?: string, viewMode?: string, renderMode?: string }} triad
 * @returns {{ workspaceMode: string, viewMode: string, renderMode: string }}
 */
export function snapshotTriad(triad = {}) {
  return {
    workspaceMode: triad.workspaceMode || 'ARITHMETIC',
    viewMode: triad.viewMode || 'ANALYSIS',
    renderMode: triad.renderMode || 'POINTS',
  };
}

/**
 * @param {{ workspaceMode?: string, viewMode?: string, renderMode?: string }} prev
 * @returns {{
 *   viewMode: string,
 *   workspaceMode: string,
 *   renderMode: string,
 *   method: string,
 *   modeRenderLocked: boolean,
 *   restore: { workspaceMode: string, viewMode: string, renderMode: string },
 * }}
 */
export function enterGalaxyChrome(prev = {}) {
  const restore = snapshotTriad(prev);
  return {
    viewMode: GALAXY_VIEW,
    workspaceMode: 'COMPARE',
    renderMode: 'POINTS',
    method: DEFAULT_GALAXY_METHOD,
    modeRenderLocked: true,
    restore,
  };
}

/**
 * @param {{ workspaceMode?: string, viewMode?: string, renderMode?: string }|null|undefined} restore
 * @param {string} nextView ANALYSIS | NAVIGATION (or anything non-GALAXY)
 * @returns {{
 *   viewMode: string,
 *   workspaceMode: string,
 *   renderMode: string,
 *   modeRenderLocked: boolean,
 * }}
 */
export function leaveGalaxyChrome(restore, nextView) {
  const snap = snapshotTriad(restore || {});
  const viewMode = nextView === GALAXY_VIEW ? 'ANALYSIS' : nextView;
  return {
    viewMode,
    workspaceMode: snap.workspaceMode,
    renderMode: snap.renderMode,
    modeRenderLocked: false,
  };
}

/**
 * @param {string} [method]
 * @returns {boolean}
 */
export function isGalaxyMethodEnabled(method) {
  const m = GALAXY_METHODS[method];
  return !!(m && m.enabled);
}
