/**
 * VHectorLab-3D v25 right dock chrome — spatial sliders + viz settings (UI-only).
 */
import { resolveSpatialDefaults } from '../../ui/spatialSliderDefaults.js';
import {
  DEFAULT_VISUALIZATION_SETTINGS,
} from '../../ui/visualizationControlsDefaults.js';

export const SPATIAL_SLIDER_DEFS = Object.freeze([
  {
    id: 'lab-spacing',
    key: 'threadSpacing',
    label: 'Spacing (X)',
    min: 0.4,
    max: 2.0,
    step: 0.05,
    decimals: 2,
  },
  {
    id: 'lab-vector-dist',
    key: 'threadVectorDistance',
    label: 'Vector Distance (Y)',
    min: 1.0,
    max: 19.0,
    step: 0.1,
    decimals: 1,
  },
  {
    id: 'lab-amplitude',
    key: 'threadAmplitudeY',
    label: 'Amplitude (Y)',
    min: 1.0,
    max: 40.0,
    step: 0.1,
    decimals: 1,
  },
  {
    id: 'lab-length',
    key: 'threadWidth',
    label: 'Length (Z)',
    min: 0.001,
    max: 0.2,
    step: 0.001,
    decimals: 3,
  },
  {
    id: 'lab-thickness',
    key: 'threadThickness',
    label: 'Point Thickness',
    min: 0.01,
    max: 0.09,
    step: 0.01,
    decimals: 2,
  },
]);

function sliderRow(def, value) {
  const shown = Number(value).toFixed(def.decimals);
  return `
    <div class="lab-slider" data-key="${def.key}">
      <div class="lab-slider__header">
        <label class="lab-slider__label" for="${def.id}">${def.label}</label>
        <span class="lab-slider__val lab-mono" id="${def.id}-val">${shown}</span>
      </div>
      <input
        class="lab-slider__input"
        type="range"
        id="${def.id}"
        min="${def.min}"
        max="${def.max}"
        step="${def.step}"
        value="${value}"
      />
    </div>`;
}

/**
 * @param {ReturnType<typeof resolveSpatialDefaults>} spatial
 * @param {typeof DEFAULT_VISUALIZATION_SETTINGS} viz
 */
export function rightDockMarkup(spatial, viz) {
  const s = spatial ?? resolveSpatialDefaults({});
  const v = viz ?? { ...DEFAULT_VISUALIZATION_SETTINGS };
  const filter = v.vizFilterMode || v.filterMode || 'all';

  return `
    <div id="lab-right-dock" class="lab-right" data-chrome="right">
      <section class="lab-right__section" aria-label="Spatial controls">
        <h2 class="lab-right__title">3D Spatial Controls</h2>
        ${SPATIAL_SLIDER_DEFS.map((def) => sliderRow(def, s[def.key])).join('')}
      </section>

      <section class="lab-right__section" aria-label="Visualization">
        <h2 class="lab-right__title">Visualization</h2>
        <div class="lab-viz-filter" role="radiogroup" aria-label="Sign filter">
          <span class="lab-field__label">Show</span>
          <div class="lab-seg">
            ${['all', 'positive', 'negative']
              .map(
                (mode) => `
              <label class="lab-seg__option">
                <input type="radio" name="lab-viz-filter" value="${mode}" ${filter === mode ? 'checked' : ''} />
                <span>${mode === 'all' ? 'All' : mode === 'positive' ? '+' : '−'}</span>
              </label>`,
              )
              .join('')}
          </div>
        </div>

        <div class="lab-viz-colors">
          <div class="lab-field__label">Colors</div>
          <div class="lab-viz-colors__row">
            <label for="lab-color-pos">+1</label>
            <input type="color" id="lab-color-pos" value="${v.colorPositive}" aria-label="Positive color" />
            <label for="lab-color-zero">0</label>
            <input type="color" id="lab-color-zero" value="${v.colorZero}" aria-label="Zero color" />
            <label for="lab-color-neg">−1</label>
            <input type="color" id="lab-color-neg" value="${v.colorNegative}" aria-label="Negative color" />
          </div>
        </div>

        <button type="button" id="lab-labels-toggle" class="lab-btn" aria-pressed="${v.labelsVisible ? 'true' : 'false'}">
          ${v.labelsVisible ? 'Hide labels' : 'Show labels'}
        </button>
      </section>
    </div>
  `.trim();
}

/**
 * @param {HTMLElement} container
 * @param {{
 *   onSpatialChange?: (values: object) => void,
 *   onVizChange?: (values: object) => void,
 *   spatialContext?: { workspaceMode?: string, viewMode?: string, renderMode?: string },
 *   initialSpatial?: object,
 * }} [options]
 */
export function mountRightDock(container, options = {}) {
  if (!container) throw new Error('mountRightDock requires a container');

  const spatialContext = options.spatialContext || {};
  const defaults = resolveSpatialDefaults(spatialContext);
  const spatial = { ...defaults, ...(options.initialSpatial || {}) };
  spatial.threadSpacingY = spatial.threadVectorDistance;
  let viz = { ...DEFAULT_VISUALIZATION_SETTINGS };
  container.innerHTML = rightDockMarkup(spatial, viz);

  const spatialState = { ...spatial };
  const onSpatialChange =
    typeof options.onSpatialChange === 'function' ? options.onSpatialChange : null;
  const onVizChange = typeof options.onVizChange === 'function' ? options.onVizChange : null;

  const emitSpatial = () => {
    spatialState.threadSpacingY = spatialState.threadVectorDistance;
    if (onSpatialChange) onSpatialChange({ ...spatialState });
  };

  const applySliderValue = (def, value) => {
    const input = container.querySelector(`#${def.id}`);
    const label = container.querySelector(`#${def.id}-val`);
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    spatialState[def.key] = n;
    if (input) input.value = String(n);
    if (label) label.textContent = n.toFixed(def.decimals);
  };

  for (const def of SPATIAL_SLIDER_DEFS) {
    const input = container.querySelector(`#${def.id}`);
    input?.addEventListener('input', () => {
      applySliderValue(def, input.value);
      emitSpatial();
    });
    // Double-click restores context default (lessons §4.5).
    input?.addEventListener('dblclick', () => {
      applySliderValue(def, defaults[def.key]);
      emitSpatial();
    });
  }

  container.querySelectorAll('input[name="lab-viz-filter"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      viz = { ...viz, vizFilterMode: radio.value };
      if (onVizChange) onVizChange({ ...viz });
    });
  });

  const bindColor = (id, key) => {
    const el = container.querySelector(`#${id}`);
    el?.addEventListener('input', () => {
      viz = { ...viz, [key]: el.value };
      if (onVizChange) onVizChange({ ...viz });
    });
  };
  bindColor('lab-color-pos', 'colorPositive');
  bindColor('lab-color-zero', 'colorZero');
  bindColor('lab-color-neg', 'colorNegative');

  const labelsBtn = container.querySelector('#lab-labels-toggle');
  labelsBtn?.addEventListener('click', () => {
    viz = { ...viz, labelsVisible: !viz.labelsVisible };
    labelsBtn.setAttribute('aria-pressed', viz.labelsVisible ? 'true' : 'false');
    labelsBtn.textContent = viz.labelsVisible ? 'Hide labels' : 'Show labels';
    if (onVizChange) onVizChange({ ...viz });
  });

  return {
    getSpatial: () => ({ ...spatialState }),
    getViz: () => ({ ...viz }),
  };
}
