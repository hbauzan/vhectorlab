import { updateAllThreadPositions } from '../visualizer/LayoutEngine.js';

/**
 * Returns HTML markup for the 3 spatial sliders control panel.
 * @param {Object} config - Initial configuration object { threadSpacing, threadWidth, threadThickness }
 * @returns {string} HTML string
 */
export function threadSlidersMarkup(config = {}) {
  const spacing = config.threadSpacing ?? 0.4;
  const vectorDist = config.threadVectorDistance ?? config.threadSpacingY ?? 10.0;
  const amplitudeY = config.threadAmplitudeY ?? 7.0;
  const width = config.threadWidth ?? 0.2;
  const thickness = config.threadThickness ?? 0.10;

  return `
<div id="thread-sliders-container" class="section-card">
  <h3 class="sliders-title">📐 Control Espacial 3D</h3>

  <!-- Slider 1: Spacing X -->
  <div class="slider-group">
    <div class="slider-header">
      <label for="thread-spacing-slider">Separación (X):</label>
      <span id="thread-spacing-val" class="slider-val">${spacing.toFixed(1)}</span>
    </div>
    <input type="range" id="thread-spacing-slider" min="0.1" max="10.0" step="0.1" value="${spacing}">
  </div>

  <!-- Slider 2: Vector Distance Y -->
  <div class="slider-group">
    <div class="slider-header">
      <label for="thread-vector-dist-slider">Distancia Vectores (Y):</label>
      <span id="thread-vector-dist-val" class="slider-val">${vectorDist.toFixed(1)}</span>
    </div>
    <input type="range" id="thread-vector-dist-slider" min="10.0" max="120.0" step="1.0" value="${vectorDist}">
  </div>

  <!-- Slider 3: Amplitude Y -->
  <div class="slider-group">
    <div class="slider-header">
      <label for="thread-amplitude-y-slider">Amplitud (Y):</label>
      <span id="thread-amplitude-y-val" class="slider-val">${amplitudeY.toFixed(1)}</span>
    </div>
    <input type="range" id="thread-amplitude-y-slider" min="1.0" max="240.0" step="1.0" value="${amplitudeY}">
  </div>

  <!-- Slider 4: Width Z -->
  <div class="slider-group">
    <div class="slider-header">
      <label for="thread-width-slider">Longitud (Z):</label>
      <span id="thread-width-val" class="slider-val">${width.toFixed(1)}</span>
    </div>
    <input type="range" id="thread-width-slider" min="0.1" max="5.0" step="0.1" value="${width}">
  </div>

  <!-- Slider 5: Thickness -->
  <div class="slider-group">
    <div class="slider-header">
      <label for="thread-thickness-slider">Grosor Puntos:</label>
      <span id="thread-thickness-val" class="slider-val">${thickness.toFixed(2)}</span>
    </div>
    <input type="range" id="thread-thickness-slider" min="0.1" max="1.0" step="0.05" value="${thickness}">
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

  const vectorDistInput = container.querySelector('#thread-vector-dist-slider');
  const vectorDistVal = container.querySelector('#thread-vector-dist-val');

  const ampYInput = container.querySelector('#thread-amplitude-y-slider');
  const ampYVal = container.querySelector('#thread-amplitude-y-val');

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

  if (vectorDistInput) {
    vectorDistInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      config.threadVectorDistance = val;
      config.threadSpacingY = val;
      if (vectorDistVal) vectorDistVal.textContent = val.toFixed(1);
      triggerChange();
    });
  }

  if (ampYInput) {
    ampYInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      config.threadAmplitudeY = val;
      if (ampYVal) ampYVal.textContent = val.toFixed(1);
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
      if (thicknessVal) thicknessVal.textContent = val.toFixed(2);
      triggerChange();
    });
  }
}
