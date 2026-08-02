import { updateAllThreadPositions } from '../visualizer/LayoutEngine.js';
import {
  GLOBAL_SPATIAL_DEFAULTS,
  resolveSpatialDefaults,
  SPATIAL_SLIDER_BINDINGS,
} from './spatialSliderDefaults.js';

/**
 * Returns HTML markup for the spatial sliders control panel.
 * Defaults sit at linear midpoints; steps are fine-grained for gradual tuning.
 * @param {Object} config - Initial configuration object { threadSpacing, threadWidth, threadThickness }
 * @returns {string} HTML string
 */
export function threadSlidersMarkup(config = {}) {
  const spacing = config.threadSpacing ?? GLOBAL_SPATIAL_DEFAULTS.threadSpacing;
  const vectorDist = config.threadVectorDistance ?? config.threadSpacingY ?? GLOBAL_SPATIAL_DEFAULTS.threadVectorDistance;
  const amplitudeY = config.threadAmplitudeY ?? GLOBAL_SPATIAL_DEFAULTS.threadAmplitudeY;
  const width = config.threadWidth ?? GLOBAL_SPATIAL_DEFAULTS.threadWidth;
  const thickness = config.threadThickness ?? GLOBAL_SPATIAL_DEFAULTS.threadThickness;

  return `
<div id="thread-sliders-container" class="section-card">
  <h3 class="sliders-title">📐 3D Spatial Controls</h3>

  <!-- Slider 1: Spacing X -->
  <div class="slider-group">
    <div class="slider-header">
      <label for="thread-spacing-slider">Spacing (X):</label>
      <span id="thread-spacing-val" class="slider-val">${spacing.toFixed(2)}</span>
    </div>
    <input type="range" id="thread-spacing-slider" min="0.4" max="2.0" step="0.05" value="${spacing}" title="Double-click: restore default">
  </div>

  <!-- Slider 2: Vector Distance Y -->
  <div class="slider-group">
    <div class="slider-header">
      <label for="thread-vector-dist-slider">Vector Distance (Y):</label>
      <span id="thread-vector-dist-val" class="slider-val">${vectorDist.toFixed(1)}</span>
    </div>
    <input type="range" id="thread-vector-dist-slider" min="1.0" max="19.0" step="0.1" value="${vectorDist}" title="Double-click: restore default">
  </div>

  <!-- Slider 3: Amplitude Y -->
  <div class="slider-group">
    <div class="slider-header">
      <label for="thread-amplitude-y-slider">Amplitude (Y):</label>
      <span id="thread-amplitude-y-val" class="slider-val">${amplitudeY.toFixed(1)}</span>
    </div>
    <input type="range" id="thread-amplitude-y-slider" min="1.0" max="40.0" step="0.1" value="${amplitudeY}" title="Double-click: restore default">
  </div>

  <!-- Slider 4: Width Z -->
  <div class="slider-group">
    <div class="slider-header">
      <label for="thread-width-slider">Length (Z):</label>
      <span id="thread-width-val" class="slider-val">${width.toFixed(3)}</span>
    </div>
    <input type="range" id="thread-width-slider" min="0.001" max="0.2" step="0.001" value="${width}" title="Double-click: restore default">
  </div>

  <!-- Slider 5: Thickness -->
  <div class="slider-group">
    <div class="slider-header">
      <label for="thread-thickness-slider">Point Thickness:</label>
      <span id="thread-thickness-val" class="slider-val">${thickness.toFixed(2)}</span>
    </div>
    <input type="range" id="thread-thickness-slider" min="0.01" max="0.09" step="0.01" value="${thickness}" title="Double-click: restore default">
  </div>
</div>
`;
}


/**
 * Writes config values into range inputs + labels (e.g. after context default apply).
 * @param {HTMLElement} container
 * @param {Object} config
 */
export function syncThreadSlidersFromConfig(container, config) {
  if (!container || !config) return;
  for (const binding of SPATIAL_SLIDER_BINDINGS) {
    const val = config[binding.configKey];
    if (val === undefined || Number.isNaN(val)) continue;
    const input = container.querySelector(`#${binding.inputId}`);
    const labelEl = container.querySelector(`#${binding.labelId}`);
    if (input) input.value = String(val);
    if (labelEl) labelEl.textContent = Number(val).toFixed(binding.decimals);
  }
}

/**
 * Binds real-time event listeners to sliders for immediate 60fps spatial updates.
 * Double-click on a range input restores that slider's default for the current
 * MODE/VIEW/RENDER context (via resolveSpatialDefaults).
 *
 * @param {HTMLElement} container - DOM container containing slider elements
 * @param {Array<Object>|null} threads - Synthetic threads array (optional)
 * @param {Object} config - Config object mutated on input
 * @param {Function} [onChangeCallback] - Optional callback triggered on slider input
 * @param {{ getContext?: () => { workspaceMode?: string, viewMode?: string, renderMode?: string } }} [options]
 */
export function wireThreadSliders(container, threads, config, onChangeCallback = null, options = {}) {
  if (!container) return;

  const getContext = typeof options.getContext === 'function'
    ? options.getContext
    : () => ({});

  const triggerChange = () => {
    if (threads && threads.length) {
      updateAllThreadPositions(threads, config);
    }
    if (typeof onChangeCallback === 'function') {
      onChangeCallback(config);
    }
  };

  for (const binding of SPATIAL_SLIDER_BINDINGS) {
    const input = container.querySelector(`#${binding.inputId}`);
    const labelEl = container.querySelector(`#${binding.labelId}`);
    if (!input) continue;

    input.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      config[binding.configKey] = val;
      if (binding.aliasKeys) {
        for (const alias of binding.aliasKeys) config[alias] = val;
      }
      if (labelEl) labelEl.textContent = val.toFixed(binding.decimals);
      triggerChange();
    });

    input.addEventListener('dblclick', (e) => {
      e.preventDefault();
      const defaults = resolveSpatialDefaults(getContext());
      const val = defaults[binding.configKey];
      if (val === undefined || Number.isNaN(val)) return;
      input.value = String(val);
      config[binding.configKey] = val;
      if (binding.aliasKeys) {
        for (const alias of binding.aliasKeys) config[alias] = val;
      }
      if (labelEl) labelEl.textContent = val.toFixed(binding.decimals);
      triggerChange();
    });
  }
}
