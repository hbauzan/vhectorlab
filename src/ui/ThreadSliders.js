import { updateAllThreadPositions } from '../visualizer/LayoutEngine.js';

/**
 * Returns HTML markup for the 3 spatial sliders control panel.
 * @param {Object} config - Initial configuration object { threadSpacing, threadWidth, threadThickness }
 * @returns {string} HTML string
 */
export function threadSlidersMarkup(config = {}) {
  const spacing = config.threadSpacing ?? 0.8;
  const width = config.threadWidth ?? 1.0;
  const thickness = config.threadThickness ?? 2.0;

  return `
<div id="thread-sliders-container" class="section-card">
  <h3 class="sliders-title">📐 Control Espacial 3D</h3>

  <!-- Slider 1: Spacing X -->
  <div class="slider-group">
    <div class="slider-header">
      <label for="thread-spacing-slider">Separación (X):</label>
      <span id="thread-spacing-val" class="slider-val">${spacing.toFixed(1)}</span>
    </div>
    <input type="range" id="thread-spacing-slider" min="0.1" max="3.0" step="0.1" value="${spacing}">
  </div>

  <!-- Slider 2: Width Z -->
  <div class="slider-group">
    <div class="slider-header">
      <label for="thread-width-slider">Longitud (Z):</label>
      <span id="thread-width-val" class="slider-val">${width.toFixed(1)}</span>
    </div>
    <input type="range" id="thread-width-slider" min="0.2" max="3.0" step="0.1" value="${width}">
  </div>

  <!-- Slider 3: Thickness -->
  <div class="slider-group">
    <div class="slider-header">
      <label for="thread-thickness-slider">Grosor Puntos:</label>
      <span id="thread-thickness-val" class="slider-val">${thickness.toFixed(1)}</span>
    </div>
    <input type="range" id="thread-thickness-slider" min="0.5" max="5.0" step="0.5" value="${thickness}">
  </div>
</div>
`;
}

/**
 * Binds real-time event listeners to sliders for immediate 60fps spatial updates.
 *
 * @param {HTMLElement} container - DOM container containing slider elements
 * @param {Array<Object>|null} threads - Synthetic threads array (optional)
 * @param {Object} config - Config object mutated on input
 * @param {Function} [onChangeCallback] - Optional callback triggered on slider input
 */
export function wireThreadSliders(container, threads, config, onChangeCallback = null) {
  if (!container) return;

  const spacingInput = container.querySelector('#thread-spacing-slider');
  const spacingVal = container.querySelector('#thread-spacing-val');

  const widthInput = container.querySelector('#thread-width-slider');
  const widthVal = container.querySelector('#thread-width-val');

  const thicknessInput = container.querySelector('#thread-thickness-slider');
  const thicknessVal = container.querySelector('#thread-thickness-val');

  const triggerChange = () => {
    if (threads && threads.length) {
      updateAllThreadPositions(threads, config);
    }
    if (typeof onChangeCallback === 'function') {
      onChangeCallback(config);
    }
  };

  if (spacingInput) {
    spacingInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      config.threadSpacing = val;
      if (spacingVal) spacingVal.textContent = val.toFixed(1);
      triggerChange();
    });
  }

  if (widthInput) {
    widthInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      config.threadWidth = val;
      if (widthVal) widthVal.textContent = val.toFixed(1);
      triggerChange();
    });
  }

  if (thicknessInput) {
    thicknessInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      config.threadThickness = val;
      if (thicknessVal) thicknessVal.textContent = val.toFixed(1);
      triggerChange();
    });
  }
}
