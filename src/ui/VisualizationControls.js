/**
 * Visualization panel: sign filter + divergent color anchors (right dock).
 * Includes an edge collapse tab (same affordance as CollapsibleDock).
 */

import {
  DEFAULT_VISUALIZATION_SETTINGS,
  normalizeHex,
  normalizeFilterMode,
  normalizeZeroCoverage,
  resolveVisualizationSettings,
  saveVisualizationSettings,
  resetVisualizationSettings,
  VIZ_STORAGE_PREFIX,
  ZERO_COVERAGE_MIN,
  ZERO_COVERAGE_MAX,
} from './visualizationControlsDefaults.js';
import {
  readCollapsedPreference,
  writeCollapsedPreference,
  isMobileViewport,
} from './CollapsibleDock.js';

export const VIZ_PANEL_COLLAPSE_KEY = `${VIZ_STORAGE_PREFIX}panelCollapsed`;

/**
 * @param {boolean} collapsed
 * @returns {string}
 */
export function vizPanelTabGlyph(collapsed) {
  return collapsed ? '◀' : '▶';
}

/**
 * @param {boolean} collapsed
 * @returns {string}
 */
export function vizPanelTabLabel(collapsed) {
  return collapsed ? 'Expand Visualization panel' : 'Collapse Visualization panel';
}

/**
 * Button label for thread-labels visibility toggle.
 * @param {boolean} labelsVisible
 * @returns {string}
 */
export function labelsToggleButtonText(labelsVisible) {
  return labelsVisible ? 'Hide labels' : 'Show labels';
}

/**
 * @param {import('./visualizationControlsDefaults.js').VisualizationSettings} [config]
 * @param {{ collapsed?: boolean }} [opts]
 * @returns {string}
 */
export function visualizationControlsMarkup(config = DEFAULT_VISUALIZATION_SETTINGS, opts = {}) {
  const s = resolveVisualizationSettings(config);
  const collapsed = opts.collapsed === true;
  const checked = (mode) => (s.vizFilterMode === mode ? 'checked' : '');
  const collapsedClass = collapsed ? ' is-collapsed' : '';
  const glyph = vizPanelTabGlyph(collapsed);
  const label = vizPanelTabLabel(collapsed);

  return `
<div id="visualization-controls-container" class="section-card viz-panel${collapsedClass}">
  <button type="button" class="viz-panel-tab dock-tab" aria-expanded="${collapsed ? 'false' : 'true'}" aria-controls="viz-panel-body" title="${label}" aria-label="${label}">${glyph}</button>
  <div id="viz-panel-body" class="viz-panel-body">
    <h3 class="sliders-title">Visualization</h3>

    <div class="viz-filter-group">
      <span class="viz-filter-label">Show:</span>
      <div class="viz-segmented" role="radiogroup" aria-label="Sign filter">
        <label class="viz-seg-option">
          <input type="radio" name="viz-filter-mode" value="all" ${checked('all')}>
          <span>All</span>
        </label>
        <label class="viz-seg-option">
          <input type="radio" name="viz-filter-mode" value="positive" ${checked('positive')}>
          <span>+ Only</span>
        </label>
        <label class="viz-seg-option">
          <input type="radio" name="viz-filter-mode" value="negative" ${checked('negative')}>
          <span>− Only</span>
        </label>
      </div>
    </div>

    <div class="viz-colors-section">
      <div class="viz-colors-title">Colors</div>
      <div class="viz-color-row">
        <label for="viz-color-positive-hex">+1</label>
        <input type="color" id="viz-color-positive-swatch" class="viz-color-swatch" value="${s.colorPositive}" title="Positive (+1)" aria-label="Positive color swatch">
        <input type="text" id="viz-color-positive-hex" class="viz-color-hex" value="${s.colorPositive}" maxlength="7" spellcheck="false" placeholder="#FFE600" title="Positive (+1) hex">
      </div>
      <div class="viz-color-row">
        <label for="viz-color-zero-hex">0</label>
        <input type="color" id="viz-color-zero-swatch" class="viz-color-swatch" value="${s.colorZero}" title="Zero (0)" aria-label="Zero color swatch">
        <input type="text" id="viz-color-zero-hex" class="viz-color-hex" value="${s.colorZero}" maxlength="7" spellcheck="false" placeholder="#000000" title="Zero (0) hex">
      </div>
      <div class="viz-color-row">
        <label for="viz-color-negative-hex">−1</label>
        <input type="color" id="viz-color-negative-swatch" class="viz-color-swatch" value="${s.colorNegative}" title="Negative (−1)" aria-label="Negative color swatch">
        <input type="text" id="viz-color-negative-hex" class="viz-color-hex" value="${s.colorNegative}" maxlength="7" spellcheck="false" placeholder="#9900E6" title="Negative (−1) hex">
      </div>
    </div>

    <div class="viz-coverage-row slider-group">
      <div class="slider-header">
        <label for="viz-zero-coverage-slider">Zero coverage:</label>
        <span id="viz-zero-coverage-val" class="slider-val">${s.zeroCoverage}%</span>
      </div>
      <input type="range" id="viz-zero-coverage-slider" min="${ZERO_COVERAGE_MIN}" max="${ZERO_COVERAGE_MAX}" step="1" value="${s.zeroCoverage}" title="How much of ± range stays at the zero color before blending to +1/−1">
    </div>

    <button type="button" id="viz-labels-toggle" class="viz-labels-toggle" aria-pressed="${s.labelsVisible ? 'true' : 'false'}" title="Show or hide floating thread labels">
      ${labelsToggleButtonText(s.labelsVisible)}
    </button>

    <button type="button" id="viz-reset-btn" class="viz-reset-btn">Reset</button>
  </div>
</div>
`;
}

/**
 * Sync form controls from config object.
 * @param {HTMLElement} container
 * @param {import('./visualizationControlsDefaults.js').VisualizationSettings} config
 */
export function syncVisualizationControlsFromConfig(container, config) {
  if (!container || !config) return;
  const s = resolveVisualizationSettings(config);
  for (const radio of container.querySelectorAll('input[name="viz-filter-mode"]')) {
    radio.checked = radio.value === s.vizFilterMode;
  }
  const pairs = [
    ['positive', s.colorPositive],
    ['zero', s.colorZero],
    ['negative', s.colorNegative],
  ];
  for (const [key, hex] of pairs) {
    const swatch = container.querySelector(`#viz-color-${key}-swatch`);
    const text = container.querySelector(`#viz-color-${key}-hex`);
    if (swatch) swatch.value = hex;
    if (text) text.value = hex;
  }
  const covInput = container.querySelector('#viz-zero-coverage-slider');
  const covLabel = container.querySelector('#viz-zero-coverage-val');
  if (covInput) covInput.value = String(s.zeroCoverage);
  if (covLabel) covLabel.textContent = `${s.zeroCoverage}%`;

  const labelsBtn = container.querySelector('#viz-labels-toggle');
  if (labelsBtn) {
    labelsBtn.setAttribute('aria-pressed', s.labelsVisible ? 'true' : 'false');
    labelsBtn.textContent = labelsToggleButtonText(s.labelsVisible);
  }
}

/**
 * Apply collapsed visual state to the Visualization panel host.
 * @param {HTMLElement} container
 * @param {boolean} collapsed
 */
export function setVisualizationPanelCollapsed(container, collapsed) {
  if (!container) return;
  const next = Boolean(collapsed);
  container.classList.toggle('is-collapsed', next);
  const tab = container.querySelector('.viz-panel-tab');
  if (tab) {
    const label = vizPanelTabLabel(next);
    tab.setAttribute('aria-expanded', next ? 'false' : 'true');
    tab.setAttribute('aria-label', label);
    tab.setAttribute('title', label);
    tab.textContent = vizPanelTabGlyph(next);
  }
}

/**
 * Wire filter radios, hex/swatch inputs, Reset, and edge collapse tab.
 * Mutates `config` in place; persists to localStorage; calls onChange.
 *
 * @param {HTMLElement} container
 * @param {import('./visualizationControlsDefaults.js').VisualizationSettings} config
 * @param {Function} [onChangeCallback]
 * @param {{ storage?: Storage|null, isMobile?: () => boolean }} [options]
 */
export function wireVisualizationControls(container, config, onChangeCallback = null, options = {}) {
  if (!container || !config) return;

  const storage = options.storage !== undefined
    ? options.storage
    : (typeof localStorage !== 'undefined' ? localStorage : null);

  const isMobileFn = typeof options.isMobile === 'function'
    ? options.isMobile
    : () => isMobileViewport();

  const emit = () => {
    saveVisualizationSettings(config, storage);
    if (typeof onChangeCallback === 'function') onChangeCallback(config);
  };

  for (const radio of container.querySelectorAll('input[name="viz-filter-mode"]')) {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      config.vizFilterMode = normalizeFilterMode(radio.value);
      emit();
    });
  }

  const bindColor = (key, configKey) => {
    const swatch = container.querySelector(`#viz-color-${key}-swatch`);
    const text = container.querySelector(`#viz-color-${key}-hex`);
    if (!swatch || !text) return;

    swatch.addEventListener('input', () => {
      const hex = normalizeHex(swatch.value);
      if (!hex) return;
      config[configKey] = hex;
      text.value = hex;
      emit();
    });

    const commitHex = () => {
      const hex = normalizeHex(text.value);
      if (!hex) {
        text.value = config[configKey];
        return;
      }
      config[configKey] = hex;
      swatch.value = hex;
      text.value = hex;
      emit();
    };

    text.addEventListener('change', commitHex);
    text.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitHex();
      }
    });
  };

  bindColor('positive', 'colorPositive');
  bindColor('zero', 'colorZero');
  bindColor('negative', 'colorNegative');

  const covInput = container.querySelector('#viz-zero-coverage-slider');
  const covLabel = container.querySelector('#viz-zero-coverage-val');
  if (covInput) {
    covInput.addEventListener('input', () => {
      const next = normalizeZeroCoverage(covInput.value);
      config.zeroCoverage = next;
      if (covLabel) covLabel.textContent = `${next}%`;
      emit();
    });
  }

  const labelsBtn = container.querySelector('#viz-labels-toggle');
  if (labelsBtn) {
    labelsBtn.addEventListener('click', () => {
      config.labelsVisible = !config.labelsVisible;
      labelsBtn.setAttribute('aria-pressed', config.labelsVisible ? 'true' : 'false');
      labelsBtn.textContent = labelsToggleButtonText(config.labelsVisible);
      emit();
    });
  }

  const resetBtn = container.querySelector('#viz-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const defaults = resetVisualizationSettings(storage);
      Object.assign(config, defaults);
      syncVisualizationControlsFromConfig(container, config);
      if (typeof onChangeCallback === 'function') onChangeCallback(config);
    });
  }

  const tab = container.querySelector('.viz-panel-tab');
  if (tab) {
    tab.addEventListener('click', () => {
      const next = !container.classList.contains('is-collapsed');
      setVisualizationPanelCollapsed(container, next);
      writeCollapsedPreference(storage, VIZ_PANEL_COLLAPSE_KEY, next, {
        isMobile: isMobileFn(),
      });
    });
  }
}

/**
 * Initial collapsed preference for Visualization panel (desktop persists; mobile defaults collapsed).
 * @param {Storage|null|undefined} storage
 * @param {{ isMobile?: boolean }} [opts]
 * @returns {boolean}
 */
export function readVisualizationPanelCollapsed(storage, opts = {}) {
  return readCollapsedPreference(storage, VIZ_PANEL_COLLAPSE_KEY, {
    isMobile: opts.isMobile ?? false,
    defaultCollapsed: false,
  });
}
