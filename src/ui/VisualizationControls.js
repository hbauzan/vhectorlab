/**
 * Visualization panel: sign filter + divergent color anchors.
 * Mounted on the app root and glued to the bottom HUD.
 * Short left dock-tab (▼/▲) collapses the sheet down onto the HUD baseline.
 */

import {
  DEFAULT_VISUALIZATION_SETTINGS,
  normalizeHex,
  normalizeFilterMode,
  normalizeConflictCover,
  normalizeHighlightStrength,
  normalizeRulerThickness,
  normalizeRulerLinkMode,
  resolveVisualizationSettings,
  saveVisualizationSettings,
  resetVisualizationSettings,
  syncGroupHueColorsForGroups,
  VIZ_STORAGE_PREFIX,
  CONFLICT_COVER_MIN,
  CONFLICT_COVER_MAX,
  HIGH_COVERAGE_SLIDER_MAX,
  HIGHLIGHT_STRENGTH_MIN,
  HIGHLIGHT_STRENGTH_MAX,
  RULER_THICKNESS_MIN,
  RULER_THICKNESS_MAX,
  highCoverageFromSlider,
  highCoverageToSlider,
  formatHighCoverage,
} from './visualizationControlsDefaults.js';
import {
  readCollapsedPreference,
  writeCollapsedPreference,
  isMobileViewport,
} from './CollapsibleDock.js';
import { FIELD_INFO, infoTipMarkup, escapeHtmlAttr } from './fieldInfo.js';
import { normalizeGroupHueRowSpecs } from '../visualizer/groupHuePaint.js';
import {
  createDimRulerState,
  setDimRulerCursor,
  addDimRulerLine,
  removeDimRulerLine,
  clampDimRulerState,
} from '../visualizer/dimRuler.js';
import { bindHoldRepeatButton } from './holdRepeat.js';

export const VIZ_PANEL_COLLAPSE_KEY = `${VIZ_STORAGE_PREFIX}panelCollapsed`;

/** @typedef {'edge' | 'sheet'} VizPanelLayout */

/**
 * Desktop = edge sheet on HUD; phone = full-width sheet (same left tab chrome).
 * @param {boolean} isMobile
 * @returns {VizPanelLayout}
 */
export function vizPanelLayoutForViewport(isMobile) {
  return isMobile ? 'sheet' : 'edge';
}

/**
 * Where to mount the Visualization host.
 * Always on the app root — glued to the bottom HUD (desktop + phone).
 * Must not live under the right dock (`transform` traps fixed/absolute children).
 * @param {{ isMobile?: boolean, dockBody?: HTMLElement, appRoot: HTMLElement }} opts
 * @returns {HTMLElement}
 */
export function resolveVisualizationMountParent(opts) {
  if (!opts || !opts.appRoot) {
    throw new Error('resolveVisualizationMountParent requires appRoot');
  }
  void opts.isMobile;
  void opts.dockBody;
  return opts.appRoot;
}

/**
 * Vertical collapse glyphs: expanded ▼ (fold down onto HUD); collapsed ▲ (raise).
 * @param {boolean} collapsed
 * @param {VizPanelLayout} [layout='edge']
 * @returns {string}
 */
export function vizPanelTabGlyph(collapsed, layout = 'edge') {
  void layout;
  return collapsed ? '▲' : '▼';
}

/**
 * @param {boolean} collapsed
 * @param {VizPanelLayout} [layout='edge']
 * @returns {string}
 */
export function vizPanelTabLabel(collapsed, layout = 'edge') {
  if (layout === 'sheet') {
    return collapsed ? 'Expand Visualization sheet' : 'Collapse Visualization sheet';
  }
  return collapsed ? 'Expand Visualization panel' : 'Collapse Visualization panel';
}

/**
 * @param {HTMLElement | null | undefined} container
 * @returns {VizPanelLayout}
 */
export function readVizPanelLayout(container) {
  const raw = container && container.dataset ? container.dataset.vizLayout : null;
  return raw === 'sheet' ? 'sheet' : 'edge';
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
 * @param {{ collapsed?: boolean, layout?: VizPanelLayout }} [opts]
 * @returns {string}
 */
export function visualizationControlsMarkup(config = DEFAULT_VISUALIZATION_SETTINGS, opts = {}) {
  const s = resolveVisualizationSettings(config);
  const collapsed = opts.collapsed === true;
  const layout = opts.layout === 'sheet' ? 'sheet' : 'edge';
  const checked = (mode) => (s.vizFilterMode === mode ? 'checked' : '');
  const collapsedClass = collapsed ? ' is-collapsed' : '';
  const glyph = vizPanelTabGlyph(collapsed, layout);
  const label = vizPanelTabLabel(collapsed, layout);

  return `
<div id="visualization-controls-container" class="section-card viz-panel${collapsedClass}" data-viz-layout="${layout}">
  <button type="button" class="viz-panel-tab dock-tab" aria-expanded="${collapsed ? 'false' : 'true'}" aria-controls="viz-panel-body" title="${label}" aria-label="${label}">${glyph}</button>
  <div id="viz-panel-body" class="viz-panel-body">
    <h3 class="sliders-title">Visualization</h3>

    <div class="viz-filter-group">
      <span class="viz-filter-label"><span class="field-label-text">Show:</span>${infoTipMarkup(FIELD_INFO.vizFilter)}</span>
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
        <label for="viz-color-positive-hex"><span class="field-label-text">+1</span>${infoTipMarkup(FIELD_INFO.colorPos)}</label>
        <input type="color" id="viz-color-positive-swatch" class="viz-color-swatch" value="${s.colorPositive}" title="Positive (+1)" aria-label="Positive color swatch">
        <input type="text" id="viz-color-positive-hex" class="viz-color-hex" value="${s.colorPositive}" maxlength="7" spellcheck="false" placeholder="#FFE600" title="Positive (+1) hex">
      </div>
      <div class="viz-color-row">
        <label for="viz-color-zero-hex"><span class="field-label-text">0</span>${infoTipMarkup(FIELD_INFO.colorZero)}</label>
        <input type="color" id="viz-color-zero-swatch" class="viz-color-swatch" value="${s.colorZero}" title="Zero (0)" aria-label="Zero color swatch">
        <input type="text" id="viz-color-zero-hex" class="viz-color-hex" value="${s.colorZero}" maxlength="7" spellcheck="false" placeholder="#000000" title="Zero (0) hex">
      </div>
      <div class="viz-color-row">
        <label for="viz-color-negative-hex"><span class="field-label-text">−1</span>${infoTipMarkup(FIELD_INFO.colorNeg)}</label>
        <input type="color" id="viz-color-negative-swatch" class="viz-color-swatch" value="${s.colorNegative}" title="Negative (−1)" aria-label="Negative color swatch">
        <input type="text" id="viz-color-negative-hex" class="viz-color-hex" value="${s.colorNegative}" maxlength="7" spellcheck="false" placeholder="#9900E6" title="Negative (−1) hex">
      </div>
    </div>

    <div class="viz-group-fx-block viz-zero-coverage-block">
      <label class="viz-toggle-row">
        <input type="checkbox" id="viz-zero-coverage-enabled" ${s.zeroCoverageEnabled ? 'checked' : ''}>
        <span class="field-label-text">Zero coverage</span>${infoTipMarkup(FIELD_INFO.zeroCoverage)}
      </label>
      <div class="viz-coverage-row slider-group viz-fx-slider" data-requires="zero-coverage">
        <div class="slider-header">
          <label for="viz-zero-coverage-slider"><span class="field-label-text">Coverage:</span>${infoTipMarkup(FIELD_INFO.zeroCoverageAmount)}</label>
          <span id="viz-zero-coverage-val" class="slider-val">${formatHighCoverage(s.zeroCoverage)}</span>
        </div>
        <input type="range" id="viz-zero-coverage-slider" min="0" max="${HIGH_COVERAGE_SLIDER_MAX}" step="1" value="${highCoverageToSlider(s.zeroCoverage)}" ${s.zeroCoverageEnabled ? '' : 'disabled'} title="30% … 99.9999% held at zero color">
      </div>
    </div>

    <div id="viz-group-contrast" class="viz-group-contrast is-disabled" aria-disabled="true">
      <div class="viz-group-contrast-title">
        <span class="field-label-text">Group contrast</span>${infoTipMarkup(FIELD_INFO.groupContrast)}
      </div>
      <p class="viz-group-contrast-hint">Requires ≥2 compare groups.</p>

      <div class="viz-group-fx-block" data-fx="same-sign">
        <label class="viz-toggle-row">
          <input type="checkbox" id="viz-same-sign-enabled" ${s.sameSignCancelEnabled ? 'checked' : ''}>
          <span class="field-label-text">Shared noise</span>${infoTipMarkup(FIELD_INFO.sameSignCancel)}
        </label>
        <div class="viz-coverage-row slider-group viz-fx-slider" data-requires="same-sign">
          <div class="slider-header">
            <label for="viz-same-sign-coverage"><span class="field-label-text">Similarity:</span>${infoTipMarkup(FIELD_INFO.sameSignCoverage)}</label>
            <span id="viz-same-sign-coverage-val" class="slider-val">${formatHighCoverage(s.sameSignCancelCoverage)}</span>
          </div>
          <input type="range" id="viz-same-sign-coverage" min="0" max="${HIGH_COVERAGE_SLIDER_MAX}" step="1" value="${highCoverageToSlider(s.sameSignCancelCoverage)}" ${s.sameSignCancelEnabled ? '' : 'disabled'}>
        </div>
      </div>

      <div class="viz-group-fx-block" data-fx="opposite">
        <label class="viz-toggle-row">
          <input type="checkbox" id="viz-opposite-enabled" ${s.oppositeHighlightEnabled ? 'checked' : ''}>
          <span class="field-label-text">Sign conflict</span>${infoTipMarkup(FIELD_INFO.oppositeHighlight)}
        </label>
        <div class="viz-color-row viz-fx-slider" data-requires="opposite">
          <label for="viz-opposite-hex"><span class="field-label-text">Hi</span>${infoTipMarkup(FIELD_INFO.oppositeColor)}</label>
          <input type="color" id="viz-opposite-swatch" class="viz-color-swatch" value="${s.oppositeHighlightColor}" ${s.oppositeHighlightEnabled ? '' : 'disabled'} title="Opposite-sign highlight" aria-label="Opposite highlight swatch">
          <input type="text" id="viz-opposite-hex" class="viz-color-hex" value="${s.oppositeHighlightColor}" maxlength="7" spellcheck="false" ${s.oppositeHighlightEnabled ? '' : 'disabled'} placeholder="#00E5FF">
        </div>
        <div class="viz-coverage-row slider-group viz-fx-slider" data-requires="opposite">
          <div class="slider-header">
            <label for="viz-opposite-strength"><span class="field-label-text">Highlight:</span>${infoTipMarkup(FIELD_INFO.oppositeStrength)}</label>
            <span id="viz-opposite-strength-val" class="slider-val">${s.oppositeHighlightStrength}%</span>
          </div>
          <input type="range" id="viz-opposite-strength" min="${HIGHLIGHT_STRENGTH_MIN}" max="${HIGHLIGHT_STRENGTH_MAX}" step="1" value="${s.oppositeHighlightStrength}" ${s.oppositeHighlightEnabled ? '' : 'disabled'}>
        </div>
        <div class="viz-coverage-row slider-group viz-fx-slider" data-requires="opposite">
          <div class="slider-header">
            <label for="viz-opposite-coverage"><span class="field-label-text">Conflict cover:</span>${infoTipMarkup(FIELD_INFO.oppositeCancel)}</label>
            <span id="viz-opposite-coverage-val" class="slider-val">${s.oppositeCancelCoverage}%</span>
          </div>
          <input type="range" id="viz-opposite-coverage" min="${CONFLICT_COVER_MIN}" max="${CONFLICT_COVER_MAX}" step="1" value="${s.oppositeCancelCoverage}" ${s.oppositeHighlightEnabled ? '' : 'disabled'}>
        </div>
      </div>

      <div class="viz-group-fx-block" data-fx="group-hue">
        <label class="viz-toggle-row">
          <input type="checkbox" id="viz-group-hue-enabled" ${s.groupHueEnabled ? 'checked' : ''}>
          <span class="field-label-text">Group hue</span>${infoTipMarkup(FIELD_INFO.groupHue)}
        </label>
        <div id="viz-group-hue-rows" class="viz-group-hue-rows" data-requires="group-hue"></div>
      </div>
    </div>

    <div class="viz-labels-row">
      <button type="button" id="viz-labels-toggle" class="viz-labels-toggle" aria-pressed="${s.labelsVisible ? 'true' : 'false'}" title="Show or hide floating thread labels">
        ${labelsToggleButtonText(s.labelsVisible)}
      </button>
      ${infoTipMarkup(FIELD_INFO.labelsToggle)}
    </div>

    <div class="viz-ruler-section">
      <div class="viz-ruler-title">
        <span class="field-label-text">Ruler</span>${infoTipMarkup(FIELD_INFO.dimRuler)}
      </div>
      <div class="viz-ruler-link-row">
        <span class="viz-ruler-link-label"><span class="field-label-text">Link:</span>${infoTipMarkup(FIELD_INFO.dimRulerLink)}</span>
        <div class="viz-segmented viz-ruler-link-seg" role="group" aria-label="Ruler link mode">
          <button type="button" id="viz-ruler-link-path" class="viz-ruler-link-btn" aria-pressed="${s.rulerLinkMode === 'path' ? 'true' : 'false'}">Path</button>
          <button type="button" id="viz-ruler-link-span" class="viz-ruler-link-btn" aria-pressed="${s.rulerLinkMode === 'span' ? 'true' : 'false'}">Span</button>
        </div>
      </div>
      <div class="viz-ruler-style-row">
        <label for="viz-ruler-hex"><span class="field-label-text">Color</span>${infoTipMarkup(FIELD_INFO.dimRulerColor)}</label>
        <input type="color" id="viz-ruler-swatch" class="viz-color-swatch" value="${s.rulerColor}" title="Ruler color" aria-label="Ruler color swatch">
        <input type="text" id="viz-ruler-hex" class="viz-color-hex" value="${s.rulerColor}" maxlength="7" spellcheck="false" placeholder="#FFFFFF" title="Ruler hex">
        <label class="viz-ruler-thick-label" for="viz-ruler-thickness" title="Thickness">${infoTipMarkup(FIELD_INFO.dimRulerThickness)}
          <input type="range" id="viz-ruler-thickness" class="viz-ruler-thickness" min="${RULER_THICKNESS_MIN}" max="${RULER_THICKNESS_MAX}" step="1" value="${s.rulerThickness}" aria-label="Ruler thickness">
        </label>
      </div>
      <div class="viz-ruler-stepper">
        <button type="button" id="viz-ruler-minus" class="viz-ruler-btn" title="Remove ruler at cursor" aria-label="Remove ruler line">−</button>
        <input type="number" id="viz-ruler-cursor" class="viz-ruler-cursor" value="${s.rulerCursor}" min="1" step="1" inputmode="numeric" title="Dimension cursor" aria-label="Ruler dimension cursor">
        <button type="button" id="viz-ruler-plus" class="viz-ruler-btn" title="Add ruler through cursor" aria-label="Add ruler line">+</button>
        <span class="viz-ruler-meta" title="Lines / total dims">
          <span id="viz-ruler-line-count">${s.rulerLineCount}</span> lines
          ·
          <span id="viz-ruler-dim-total">—</span> dims
        </span>
        ${infoTipMarkup(FIELD_INFO.dimRulerCursor)}
      </div>
    </div>

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
  const zeroOn = container.querySelector('#viz-zero-coverage-enabled');
  if (zeroOn) zeroOn.checked = s.zeroCoverageEnabled;
  const covInput = container.querySelector('#viz-zero-coverage-slider');
  const covLabel = container.querySelector('#viz-zero-coverage-val');
  if (covInput) covInput.value = String(highCoverageToSlider(s.zeroCoverage));
  if (covLabel) covLabel.textContent = formatHighCoverage(s.zeroCoverage);

  const sameOn = container.querySelector('#viz-same-sign-enabled');
  if (sameOn) sameOn.checked = s.sameSignCancelEnabled;
  const sameCov = container.querySelector('#viz-same-sign-coverage');
  const sameCovVal = container.querySelector('#viz-same-sign-coverage-val');
  if (sameCov) sameCov.value = String(highCoverageToSlider(s.sameSignCancelCoverage));
  if (sameCovVal) sameCovVal.textContent = formatHighCoverage(s.sameSignCancelCoverage);

  const oppOn = container.querySelector('#viz-opposite-enabled');
  if (oppOn) oppOn.checked = s.oppositeHighlightEnabled;
  const oppSwatch = container.querySelector('#viz-opposite-swatch');
  const oppHex = container.querySelector('#viz-opposite-hex');
  if (oppSwatch) oppSwatch.value = s.oppositeHighlightColor;
  if (oppHex) oppHex.value = s.oppositeHighlightColor;
  const oppStr = container.querySelector('#viz-opposite-strength');
  const oppStrVal = container.querySelector('#viz-opposite-strength-val');
  if (oppStr) oppStr.value = String(s.oppositeHighlightStrength);
  if (oppStrVal) oppStrVal.textContent = `${s.oppositeHighlightStrength}%`;
  const oppCov = container.querySelector('#viz-opposite-coverage');
  const oppCovVal = container.querySelector('#viz-opposite-coverage-val');
  if (oppCov) oppCov.value = String(s.oppositeCancelCoverage);
  if (oppCovVal) oppCovVal.textContent = `${s.oppositeCancelCoverage}%`;

  const hueOn = container.querySelector('#viz-group-hue-enabled');
  if (hueOn) hueOn.checked = s.groupHueEnabled;

  syncGroupFxSliderEnabled(container, s);

  const labelsBtn = container.querySelector('#viz-labels-toggle');
  if (labelsBtn) {
    labelsBtn.setAttribute('aria-pressed', s.labelsVisible ? 'true' : 'false');
    labelsBtn.textContent = labelsToggleButtonText(s.labelsVisible);
  }

  syncDimRulerControlsFromConfig(container, s);
}

/**
 * Read runtime dimCount stored on the panel host (set after compare/arithmetic render).
 * @param {HTMLElement} container
 * @returns {number}
 */
export function readVizRulerDimCount(container) {
  if (!container) return 0;
  const n = Number(container.dataset?.vizRulerDimCount);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/**
 * Apply ruler cursor/lineCount into config + refresh stepper UI.
 * @param {HTMLElement} container
 * @param {import('./visualizationControlsDefaults.js').VisualizationSettings} config
 * @param {import('../visualizer/dimRuler.js').DimRulerState} state
 */
function applyDimRulerStateToConfig(container, config, state) {
  const s = clampDimRulerState(state);
  config.rulerCursor = s.cursor;
  config.rulerLineCount = s.lineCount;
  syncDimRulerControlsFromConfig(container, config, s.dimCount);
}

/**
 * Sync ruler color / thickness / stepper from config.
 * @param {HTMLElement} container
 * @param {import('./visualizationControlsDefaults.js').VisualizationSettings} config
 * @param {number} [dimCount]
 */
export function syncDimRulerControlsFromConfig(container, config, dimCount = null) {
  if (!container || !config) return;
  const s = resolveVisualizationSettings(config);
  const dims = dimCount != null
    ? Math.max(0, Math.round(Number(dimCount) || 0))
    : readVizRulerDimCount(container);
  const ruler = clampDimRulerState({
    dimCount: dims,
    cursor: s.rulerCursor,
    lineCount: s.rulerLineCount,
  });
  if (dims > 0) {
    config.rulerCursor = ruler.cursor;
    config.rulerLineCount = ruler.lineCount;
    container.dataset.vizRulerDimCount = String(dims);
  }

  const swatch = container.querySelector('#viz-ruler-swatch');
  const hex = container.querySelector('#viz-ruler-hex');
  if (swatch) swatch.value = s.rulerColor;
  if (hex) hex.value = s.rulerColor;
  const thick = container.querySelector('#viz-ruler-thickness');
  if (thick) thick.value = String(s.rulerThickness);
  const pathBtn = container.querySelector('#viz-ruler-link-path');
  const spanBtn = container.querySelector('#viz-ruler-link-span');
  if (pathBtn) pathBtn.setAttribute('aria-pressed', s.rulerLinkMode === 'path' ? 'true' : 'false');
  if (spanBtn) spanBtn.setAttribute('aria-pressed', s.rulerLinkMode === 'span' ? 'true' : 'false');

  const cursor = container.querySelector('#viz-ruler-cursor');
  if (cursor) {
    cursor.value = String(ruler.cursor);
    if (dims > 0) {
      cursor.min = '1';
      cursor.max = String(dims);
    }
  }
  const lineEl = container.querySelector('#viz-ruler-line-count');
  if (lineEl) lineEl.textContent = String(ruler.lineCount);
  const totalEl = container.querySelector('#viz-ruler-dim-total');
  if (totalEl) totalEl.textContent = dims > 0 ? String(dims) : '—';
}

/**
 * Update ruler dim total after compare/arithmetic layout (clamps persisted counts).
 * @param {HTMLElement|null|undefined} container
 * @param {import('./visualizationControlsDefaults.js').VisualizationSettings|null|undefined} config
 * @param {number} dimCount
 * @param {Function} [onChange]
 */
export function setVisualizationRulerDimCount(container, config, dimCount, onChange = null) {
  if (!container || !config) return;
  const dims = Math.max(0, Math.round(Number(dimCount) || 0));
  container.dataset.vizRulerDimCount = String(dims);
  const next = clampDimRulerState({
    dimCount: dims,
    cursor: config.rulerCursor,
    lineCount: config.rulerLineCount,
  });
  config.rulerCursor = next.cursor;
  config.rulerLineCount = next.lineCount;
  syncDimRulerControlsFromConfig(container, config, dims);
  if (typeof onChange === 'function') onChange(config);
}

/**
 * Enable/disable dependent sliders when parent toggles change (and when groups gate is off).
 * @param {HTMLElement} container
 * @param {import('./visualizationControlsDefaults.js').VisualizationSettings} settings
 */
export function syncGroupFxSliderEnabled(container, settings) {
  if (!container) return;
  const section = container.querySelector('#viz-group-contrast');
  const groupsOk = section ? !section.classList.contains('is-disabled') : false;
  const s = resolveVisualizationSettings(settings);

  const setDisabled = (el, disabled) => {
    if (!el) return;
    el.disabled = disabled;
  };

  setDisabled(container.querySelector('#viz-zero-coverage-enabled'), false);
  const zeroSlidersOn = s.zeroCoverageEnabled;
  setDisabled(container.querySelector('#viz-zero-coverage-slider'), !zeroSlidersOn);
  for (const row of container.querySelectorAll('.viz-fx-slider[data-requires="zero-coverage"]')) {
    row.classList.toggle('is-inert', !zeroSlidersOn);
  }

  setDisabled(container.querySelector('#viz-same-sign-enabled'), !groupsOk);
  setDisabled(container.querySelector('#viz-opposite-enabled'), !groupsOk);
  setDisabled(container.querySelector('#viz-group-hue-enabled'), !groupsOk);

  const sameSlidersOn = groupsOk && s.sameSignCancelEnabled;
  setDisabled(container.querySelector('#viz-same-sign-coverage'), !sameSlidersOn);

  const oppSlidersOn = groupsOk && s.oppositeHighlightEnabled;
  setDisabled(container.querySelector('#viz-opposite-swatch'), !oppSlidersOn);
  setDisabled(container.querySelector('#viz-opposite-hex'), !oppSlidersOn);
  setDisabled(container.querySelector('#viz-opposite-strength'), !oppSlidersOn);
  setDisabled(container.querySelector('#viz-opposite-coverage'), !oppSlidersOn);

  const hueSlidersOn = groupsOk && s.groupHueEnabled;
  for (const el of container.querySelectorAll('#viz-group-hue-rows input')) {
    setDisabled(el, !hueSlidersOn);
  }

  for (const row of container.querySelectorAll('.viz-fx-slider[data-requires="same-sign"]')) {
    row.classList.toggle('is-inert', !sameSlidersOn);
  }
  for (const row of container.querySelectorAll('.viz-fx-slider[data-requires="opposite"]')) {
    row.classList.toggle('is-inert', !oppSlidersOn);
  }
  const hueRows = container.querySelector('#viz-group-hue-rows');
  if (hueRows) hueRows.classList.toggle('is-inert', !hueSlidersOn);
}

/**
 * Gate Group contrast controls: usable only with ≥2 compare groups.
 * @param {HTMLElement|null|undefined} container
 * @param {boolean} enabled
 * @param {import('./visualizationControlsDefaults.js').VisualizationSettings} [config]
 * @param {Array<string|{ id?: string, label?: string }>} [groupsOrIds]
 */
export function setGroupContrastControlsEnabled(container, enabled, config = null, groupsOrIds = null) {
  if (!container) return;
  const section = container.querySelector('#viz-group-contrast');
  if (!section) return;
  const on = Boolean(enabled);
  section.classList.toggle('is-disabled', !on);
  section.setAttribute('aria-disabled', on ? 'false' : 'true');
  const settings = config || resolveVisualizationSettings(null);
  if (Array.isArray(groupsOrIds)) {
    const specs = normalizeGroupHueRowSpecs(groupsOrIds);
    container._vizGroupHueGroups = specs;
    container._vizGroupHueIds = specs.map((g) => g.id);
    const emit = typeof container._vizEmit === 'function'
      ? container._vizEmit
      : () => saveVisualizationSettings(settings);
    syncGroupHueColorRows(container, specs, settings, emit);
  }
  syncGroupFxSliderEnabled(container, settings);
}

/**
 * Rebuild dynamic Group hue swatch rows — labels from Compare textarea names.
 * Caps visible height at ~3 rows; overflow scrolls (4+ groups).
 * @param {HTMLElement} container
 * @param {Array<string|{ id?: string, label?: string }>} groupsOrIds
 * @param {import('./visualizationControlsDefaults.js').VisualizationSettings} config
 * @param {Function} [onColorChange]
 */
export function syncGroupHueColorRows(container, groupsOrIds, config, onColorChange = null) {
  if (!container || !config) return;
  const host = container.querySelector('#viz-group-hue-rows');
  if (!host) return;
  const specs = normalizeGroupHueRowSpecs(groupsOrIds);
  container._vizGroupHueGroups = specs;
  container._vizGroupHueIds = specs.map((g) => g.id);
  syncGroupHueColorsForGroups(config, container._vizGroupHueIds);
  const colors = config.groupHueColors || {};
  host.innerHTML = specs.map(({ id, label }) => {
    const hex = colors[id] || '#00E5FF';
    const safeId = escapeHtmlAttr(id);
    const safeLabel = escapeHtmlAttr(label);
    const safeHex = escapeHtmlAttr(hex);
    const inputId = `viz-group-hue-${safeId.replace(/[^A-Za-z0-9_-]/g, '_')}`;
    return `
      <div class="viz-color-row viz-group-hue-row" data-group-id="${safeId}" title="${safeLabel}">
        <label for="${inputId}-hex"><span class="field-label-text">${safeLabel}</span>${infoTipMarkup(FIELD_INFO.groupHueSwatch)}</label>
        <input type="color" id="${inputId}-swatch" class="viz-color-swatch" data-group-hue-swatch="${safeId}" value="${safeHex}" title="${safeLabel}" aria-label="${safeLabel} color">
        <input type="text" id="${inputId}-hex" class="viz-color-hex" data-group-hue-hex="${safeId}" value="${safeHex}" maxlength="7" spellcheck="false" placeholder="#00E5FF" aria-label="${safeLabel} hex">
      </div>`;
  }).join('');
  host.classList.toggle('is-scrollable', specs.length > 3);

  if (typeof onColorChange === 'function') {
    for (const swatch of host.querySelectorAll('[data-group-hue-swatch]')) {
      swatch.addEventListener('input', () => {
        const gid = swatch.getAttribute('data-group-hue-swatch');
        const hex = normalizeHex(swatch.value);
        if (!gid || !hex) return;
        config.groupHueColors = { ...(config.groupHueColors || {}), [gid]: hex };
        const row = swatch.closest('.viz-group-hue-row');
        const text = row?.querySelector('[data-group-hue-hex]');
        if (text) text.value = hex;
        onColorChange();
      });
    }
    for (const text of host.querySelectorAll('[data-group-hue-hex]')) {
      const commit = () => {
        const gid = text.getAttribute('data-group-hue-hex');
        const hex = normalizeHex(text.value);
        if (!gid) return;
        if (!hex) {
          text.value = (config.groupHueColors || {})[gid] || '#00E5FF';
          return;
        }
        config.groupHueColors = { ...(config.groupHueColors || {}), [gid]: hex };
        const row = text.closest('.viz-group-hue-row');
        const swatch = row?.querySelector('[data-group-hue-swatch]');
        if (swatch) swatch.value = hex;
        text.value = hex;
        onColorChange();
      };
      text.addEventListener('change', commit);
      text.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
      });
    }
  }

  syncGroupFxSliderEnabled(container, config);
}

/**
 * Apply collapsed visual state to the Visualization panel host.
 * @param {HTMLElement} container
 * @param {boolean} collapsed
 */
export function setVisualizationPanelCollapsed(container, collapsed) {
  if (!container) return;
  const next = Boolean(collapsed);
  const layout = readVizPanelLayout(container);
  container.classList.toggle('is-collapsed', next);
  const tab = container.querySelector('.viz-panel-tab');
  if (tab) {
    const label = vizPanelTabLabel(next, layout);
    tab.setAttribute('aria-expanded', next ? 'false' : 'true');
    tab.setAttribute('aria-label', label);
    tab.setAttribute('title', label);
    tab.textContent = vizPanelTabGlyph(next, layout);
  }
}

/**
 * Sync layout attribute + tab glyphs for the current viewport mode.
 * @param {HTMLElement} container
 * @param {VizPanelLayout} layout
 */
export function setVisualizationPanelLayout(container, layout) {
  if (!container) return;
  const next = layout === 'sheet' ? 'sheet' : 'edge';
  container.dataset.vizLayout = next;
  setVisualizationPanelCollapsed(container, container.classList.contains('is-collapsed'));
}

/**
 * Wire filter radios, hex/swatch inputs, Reset, and left collapse tab.
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

  const zeroOn = container.querySelector('#viz-zero-coverage-enabled');
  if (zeroOn) {
    zeroOn.addEventListener('change', () => {
      config.zeroCoverageEnabled = Boolean(zeroOn.checked);
      syncGroupFxSliderEnabled(container, config);
      emit();
    });
  }
  const covInput = container.querySelector('#viz-zero-coverage-slider');
  const covLabel = container.querySelector('#viz-zero-coverage-val');
  if (covInput) {
    covInput.addEventListener('input', () => {
      const next = highCoverageFromSlider(covInput.value);
      config.zeroCoverage = next;
      if (covLabel) covLabel.textContent = formatHighCoverage(next);
      emit();
    });
  }

  const sameOn = container.querySelector('#viz-same-sign-enabled');
  if (sameOn) {
    sameOn.addEventListener('change', () => {
      config.sameSignCancelEnabled = Boolean(sameOn.checked);
      syncGroupFxSliderEnabled(container, config);
      emit();
    });
  }
  const sameCov = container.querySelector('#viz-same-sign-coverage');
  const sameCovVal = container.querySelector('#viz-same-sign-coverage-val');
  if (sameCov) {
    sameCov.addEventListener('input', () => {
      const next = highCoverageFromSlider(sameCov.value);
      config.sameSignCancelCoverage = next;
      if (sameCovVal) sameCovVal.textContent = formatHighCoverage(next);
      emit();
    });
  }

  const oppOn = container.querySelector('#viz-opposite-enabled');
  if (oppOn) {
    oppOn.addEventListener('change', () => {
      config.oppositeHighlightEnabled = Boolean(oppOn.checked);
      syncGroupFxSliderEnabled(container, config);
      emit();
    });
  }
  const oppSwatch = container.querySelector('#viz-opposite-swatch');
  const oppHex = container.querySelector('#viz-opposite-hex');
  if (oppSwatch && oppHex) {
    oppSwatch.addEventListener('input', () => {
      const hex = normalizeHex(oppSwatch.value);
      if (!hex) return;
      config.oppositeHighlightColor = hex;
      oppHex.value = hex;
      emit();
    });
    const commitOppHex = () => {
      const hex = normalizeHex(oppHex.value);
      if (!hex) {
        oppHex.value = config.oppositeHighlightColor;
        return;
      }
      config.oppositeHighlightColor = hex;
      oppSwatch.value = hex;
      oppHex.value = hex;
      emit();
    };
    oppHex.addEventListener('change', commitOppHex);
    oppHex.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitOppHex();
      }
    });
  }
  const oppStr = container.querySelector('#viz-opposite-strength');
  const oppStrVal = container.querySelector('#viz-opposite-strength-val');
  if (oppStr) {
    oppStr.addEventListener('input', () => {
      const next = normalizeHighlightStrength(oppStr.value);
      config.oppositeHighlightStrength = next;
      if (oppStrVal) oppStrVal.textContent = `${next}%`;
      emit();
    });
  }
  const oppCov = container.querySelector('#viz-opposite-coverage');
  const oppCovVal = container.querySelector('#viz-opposite-coverage-val');
  if (oppCov) {
    oppCov.addEventListener('input', () => {
      const next = normalizeConflictCover(oppCov.value);
      config.oppositeCancelCoverage = next;
      if (oppCovVal) oppCovVal.textContent = `${next}%`;
      emit();
    });
  }

  const hueOn = container.querySelector('#viz-group-hue-enabled');
  if (hueOn) {
    hueOn.addEventListener('change', () => {
      config.groupHueEnabled = Boolean(hueOn.checked);
      syncGroupFxSliderEnabled(container, config);
      emit();
    });
  }

  /** @type {Array<{ id: string, label: string }>} */
  container._vizGroupHueGroups = container._vizGroupHueGroups || [];
  /** @type {string[]} */
  container._vizGroupHueIds = container._vizGroupHueIds
    || container._vizGroupHueGroups.map((g) => g.id);
  container._vizEmit = emit;
  syncGroupHueColorRows(
    container,
    container._vizGroupHueGroups.length
      ? container._vizGroupHueGroups
      : container._vizGroupHueIds,
    config,
    emit,
  );

  syncGroupFxSliderEnabled(container, config);

  const labelsBtn = container.querySelector('#viz-labels-toggle');
  if (labelsBtn) {
    labelsBtn.addEventListener('click', () => {
      config.labelsVisible = !config.labelsVisible;
      labelsBtn.setAttribute('aria-pressed', config.labelsVisible ? 'true' : 'false');
      labelsBtn.textContent = labelsToggleButtonText(config.labelsVisible);
      emit();
    });
  }

  const rulerSwatch = container.querySelector('#viz-ruler-swatch');
  const rulerHex = container.querySelector('#viz-ruler-hex');
  if (rulerSwatch && rulerHex) {
    rulerSwatch.addEventListener('input', () => {
      const hex = normalizeHex(rulerSwatch.value);
      if (!hex) return;
      config.rulerColor = hex;
      rulerHex.value = hex;
      emit();
    });
    const commitRulerHex = () => {
      const hex = normalizeHex(rulerHex.value);
      if (!hex) {
        rulerHex.value = config.rulerColor;
        return;
      }
      config.rulerColor = hex;
      rulerSwatch.value = hex;
      rulerHex.value = hex;
      emit();
    };
    rulerHex.addEventListener('change', commitRulerHex);
    rulerHex.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitRulerHex();
      }
    });
  }
  const rulerThick = container.querySelector('#viz-ruler-thickness');
  if (rulerThick) {
    rulerThick.addEventListener('input', () => {
      config.rulerThickness = normalizeRulerThickness(rulerThick.value);
      rulerThick.value = String(config.rulerThickness);
      emit();
    });
  }

  const setRulerLinkMode = (mode) => {
    const next = normalizeRulerLinkMode(mode);
    config.rulerLinkMode = next;
    const pathBtn = container.querySelector('#viz-ruler-link-path');
    const spanBtn = container.querySelector('#viz-ruler-link-span');
    if (pathBtn) pathBtn.setAttribute('aria-pressed', next === 'path' ? 'true' : 'false');
    if (spanBtn) spanBtn.setAttribute('aria-pressed', next === 'span' ? 'true' : 'false');
    emit();
  };
  const rulerPathBtn = container.querySelector('#viz-ruler-link-path');
  if (rulerPathBtn) {
    rulerPathBtn.addEventListener('click', () => setRulerLinkMode('path'));
  }
  const rulerSpanBtn = container.querySelector('#viz-ruler-link-span');
  if (rulerSpanBtn) {
    rulerSpanBtn.addEventListener('click', () => setRulerLinkMode('span'));
  }

  const rulerState = () => createDimRulerState(readVizRulerDimCount(container), {
    cursor: config.rulerCursor,
    lineCount: config.rulerLineCount,
  });

  const rulerCursorInput = container.querySelector('#viz-ruler-cursor');
  if (rulerCursorInput) {
    const commitCursor = () => {
      const next = setDimRulerCursor(rulerState(), rulerCursorInput.value);
      applyDimRulerStateToConfig(container, config, next);
      emit();
    };
    rulerCursorInput.addEventListener('change', commitCursor);
    rulerCursorInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitCursor();
      }
    });
  }
  const rulerPlus = container.querySelector('#viz-ruler-plus');
  if (rulerPlus) {
    bindHoldRepeatButton(rulerPlus, () => {
      const next = addDimRulerLine(rulerState());
      applyDimRulerStateToConfig(container, config, next);
      emit();
    });
  }
  const rulerMinus = container.querySelector('#viz-ruler-minus');
  if (rulerMinus) {
    bindHoldRepeatButton(rulerMinus, () => {
      const next = removeDimRulerLine(rulerState());
      applyDimRulerStateToConfig(container, config, next);
      emit();
    });
  }

  syncDimRulerControlsFromConfig(container, config);

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
