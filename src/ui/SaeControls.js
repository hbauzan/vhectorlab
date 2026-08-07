/**
 * Shared SAE Clean/Denoise controls markup + wiring (Compare panel).
 */

import {
  loadSaeSettings,
  saveSaeSettings,
  resolveSaeSettings,
} from './saeControlsDefaults.js';
import { FIELD_INFO, infoTipMarkup } from './fieldInfo.js';

/**
 * @param {string} idPrefix  unique prefix so Arithmetic/Compare don't clash on ids
 * @returns {string}
 */
export function saeControlsMarkup(idPrefix) {
  const p = idPrefix;
  return `
      <div class="sae-controls" data-sae-controls="${p}">
        <div class="sae-cta-row">
          <button type="submit" id="${p}-btn-primary" class="btn-primary sae-cta-main">
            PRIMARY
          </button>
          <div class="sae-toggle-with-info">
            <button type="button" id="${p}-btn-sae-toggle" class="btn-sae-toggle" aria-pressed="false">
              Clean/Denoise (SAE)
            </button>
            ${infoTipMarkup(FIELD_INFO.saeToggle)}
          </div>
        </div>

        <div class="sae-train-row">
          <button type="button" id="${p}-btn-sae-train" class="btn-sae-train">Train SAE</button>
          <button type="button" id="${p}-btn-sae-params" class="btn-sae-params" aria-expanded="false" title="Train parameters">⚙</button>
        </div>

        <div id="${p}-sae-params" class="sae-params-panel hidden" hidden>
          <label><span class="field-label-text">hidden_dim (cap) ${infoTipMarkup(FIELD_INFO.saeHidden)}</span><input type="number" id="${p}-sae-hidden" min="32" max="32768" step="1" /></label>
          <label><span class="field-label-text">k (cap) ${infoTipMarkup(FIELD_INFO.saeK)}</span><input type="number" id="${p}-sae-k" min="1" max="4096" step="1" /></label>
          <label><span class="field-label-text">epochs ${infoTipMarkup(FIELD_INFO.saeEpochs)}</span><input type="number" id="${p}-sae-epochs" min="1" max="500" step="1" /></label>
          <label><span class="field-label-text">lr ${infoTipMarkup(FIELD_INFO.saeLr)}</span><input type="number" id="${p}-sae-lr" min="0.00001" max="1" step="0.0001" /></label>
          <label><span class="field-label-text">batch_size ${infoTipMarkup(FIELD_INFO.saeBatch)}</span><input type="number" id="${p}-sae-batch" min="1" max="2048" step="1" /></label>
          <p class="sae-params-hint">Trains on current Visualize scope. Dims/epochs auto-scale for speed (MPS/CUDA when available).</p>
        </div>

        <div id="${p}-sae-status" class="sae-status-line" aria-live="polite">SAE not trained — train on current scope</div>
        <div id="${p}-sae-progress" class="sae-progress hidden" hidden role="status" aria-live="polite">
          <div class="sae-progress-head">
            <span class="sae-progress-spinner" id="${p}-sae-progress-spinner" aria-hidden="true"></span>
            <div class="sae-progress-label" id="${p}-sae-progress-label"></div>
          </div>
          <div class="sae-progress-meta" id="${p}-sae-progress-meta"></div>
          <div class="sae-progress-bar" id="${p}-sae-progress-bar" aria-hidden="true">
            <div class="sae-progress-fill" id="${p}-sae-progress-fill"></div>
          </div>
        </div>
        <div id="${p}-sae-metrics" class="sae-metrics-strip hidden" hidden></div>
      </div>
  `;
}

/**
 * Wire SAE controls inside a panel element.
 *
 * @param {HTMLElement} root
 * @param {string} idPrefix
 * @param {{
 *   primaryLabel: string,
 *   primaryLoadingLabel: string,
 *   onToggle?: (enabled: boolean) => void|Promise<void>,
 *   onTrain?: (settings: import('./saeControlsDefaults.js').SaeUiSettings) => void|Promise<void>,
 *   getSettings?: () => import('./saeControlsDefaults.js').SaeUiSettings,
 *   setSettings?: (s: import('./saeControlsDefaults.js').SaeUiSettings) => void,
 * }} opts
 */
export function wireSaeControls(root, idPrefix, opts) {
  const p = idPrefix;
  const btnPrimary = root.querySelector(`#${p}-btn-primary`);
  const btnToggle = root.querySelector(`#${p}-btn-sae-toggle`);
  const btnTrain = root.querySelector(`#${p}-btn-sae-train`);
  const btnParams = root.querySelector(`#${p}-btn-sae-params`);
  const paramsPanel = root.querySelector(`#${p}-sae-params`);
  const statusEl = root.querySelector(`#${p}-sae-status`);
  const progressEl = root.querySelector(`#${p}-sae-progress`);
  const progressLabel = root.querySelector(`#${p}-sae-progress-label`);
  const progressMeta = root.querySelector(`#${p}-sae-progress-meta`);
  const progressBar = root.querySelector(`#${p}-sae-progress-bar`);
  const progressFill = root.querySelector(`#${p}-sae-progress-fill`);
  const progressSpinner = root.querySelector(`#${p}-sae-progress-spinner`);
  const metricsEl = root.querySelector(`#${p}-sae-metrics`);

  const inputs = {
    hiddenDim: root.querySelector(`#${p}-sae-hidden`),
    k: root.querySelector(`#${p}-sae-k`),
    epochs: root.querySelector(`#${p}-sae-epochs`),
    lr: root.querySelector(`#${p}-sae-lr`),
    batchSize: root.querySelector(`#${p}-sae-batch`),
  };

  if (btnPrimary) {
    btnPrimary.textContent = opts.primaryLabel;
  }

  const readSettings = () => {
    if (opts.getSettings) return resolveSaeSettings(opts.getSettings());
    return loadSaeSettings();
  };

  const writeSettings = (next) => {
    const resolved = resolveSaeSettings(next);
    if (opts.setSettings) opts.setSettings(resolved);
    else saveSaeSettings(resolved);
    return resolved;
  };

  const syncInputsFromSettings = (settings) => {
    inputs.hiddenDim.value = String(settings.hiddenDim);
    inputs.k.value = String(settings.k);
    inputs.epochs.value = String(settings.epochs);
    inputs.lr.value = String(settings.lr);
    inputs.batchSize.value = String(settings.batchSize);
  };

  const readInputsIntoSettings = () => {
    const cur = readSettings();
    return writeSettings({
      ...cur,
      hiddenDim: Number(inputs.hiddenDim.value),
      k: Number(inputs.k.value),
      epochs: Number(inputs.epochs.value),
      lr: Number(inputs.lr.value),
      batchSize: Number(inputs.batchSize.value),
    });
  };

  const setToggleUi = (enabled) => {
    btnToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    btnToggle.classList.toggle('is-active', enabled);
  };

  const initial = readSettings();
  syncInputsFromSettings(initial);
  setToggleUi(initial.enabled);

  btnParams.addEventListener('click', () => {
    const open = paramsPanel.hasAttribute('hidden');
    if (open) {
      paramsPanel.removeAttribute('hidden');
      paramsPanel.classList.remove('hidden');
      btnParams.setAttribute('aria-expanded', 'true');
    } else {
      paramsPanel.setAttribute('hidden', '');
      paramsPanel.classList.add('hidden');
      btnParams.setAttribute('aria-expanded', 'false');
    }
  });

  btnToggle.addEventListener('click', async () => {
    const cur = readSettings();
    const next = writeSettings({ ...cur, enabled: !cur.enabled });
    setToggleUi(next.enabled);
    if (opts.onToggle) await opts.onToggle(next.enabled);
  });

  btnTrain.addEventListener('click', async () => {
    const settings = readInputsIntoSettings();
    if (opts.onTrain) await opts.onTrain(settings);
  });

  Object.values(inputs).forEach((el) => {
    el.addEventListener('change', () => readInputsIntoSettings());
  });

  return {
    btnPrimary,
    btnToggle,
    btnTrain,
    setPrimaryLoading(loading) {
      if (!btnPrimary) return;
      btnPrimary.disabled = !!loading;
      btnPrimary.textContent = loading ? opts.primaryLoadingLabel : opts.primaryLabel;
    },
    setTrainBusy(busy, { trained = false } = {}) {
      if (!btnTrain) return;
      btnTrain.disabled = !!busy;
      btnTrain.classList.toggle('is-busy', !!busy);
      if (busy) {
        btnTrain.textContent = 'Training…';
      } else {
        btnTrain.textContent = trained ? 'Retrain SAE' : 'Train SAE';
      }
    },
    setTrainLabel(trained) {
      if (!btnTrain || btnTrain.classList.contains('is-busy')) return;
      btnTrain.textContent = trained ? 'Retrain SAE' : 'Train SAE';
    },
    setToggleEnabled(enabled) {
      const cur = readSettings();
      writeSettings({ ...cur, enabled });
      setToggleUi(enabled);
    },
    setStatus(text) {
      statusEl.textContent = text || '';
    },
    /**
     * @param {{
     *   visible: boolean,
     *   label?: string,
     *   meta?: string,
     *   current?: number,
     *   total?: number,
     *   percent?: number,
     *   indeterminate?: boolean,
     * }} opts
     */
    setProgress({
      visible,
      label,
      meta = '',
      current = 0,
      total = 0,
      percent = null,
      indeterminate = false,
    }) {
      if (!visible) {
        progressEl.setAttribute('hidden', '');
        progressEl.classList.add('hidden');
        progressEl.classList.remove('is-working');
        if (progressBar) progressBar.classList.remove('is-indeterminate');
        return;
      }
      progressEl.removeAttribute('hidden');
      progressEl.classList.remove('hidden');
      progressEl.classList.add('is-working');
      progressLabel.textContent = label || '';
      if (progressMeta) {
        progressMeta.textContent = meta || '';
        progressMeta.hidden = !meta;
      }
      let pct = percent;
      if (pct == null || !Number.isFinite(pct)) {
        pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
      }
      pct = Math.max(0, Math.min(100, Number(pct) || 0));
      const showIndeterminate = !!(indeterminate || pct < 1);
      if (progressBar) {
        progressBar.classList.toggle('is-indeterminate', showIndeterminate);
      }
      if (progressSpinner) {
        progressSpinner.classList.toggle('is-on', true);
      }
      progressFill.style.width = showIndeterminate ? '' : `${pct}%`;
      progressEl.setAttribute('aria-valuenow', String(Math.round(pct)));
      progressEl.setAttribute('aria-valuemin', '0');
      progressEl.setAttribute('aria-valuemax', '100');
      progressEl.setAttribute(
        'aria-busy',
        showIndeterminate || pct < 100 ? 'true' : 'false'
      );
    },
    /**
     * @param {{ l0?: number, sparsity?: number, activeFeatures?: number, trainMse?: number, deadFeaturesPct?: number }|null} m
     */
    setMetrics(m) {
      if (!m) {
        metricsEl.setAttribute('hidden', '');
        metricsEl.classList.add('hidden');
        metricsEl.innerHTML = '';
        return;
      }
      const parts = [];
      if (m.l0 != null) parts.push(`L0: <strong>${m.l0.toFixed(1)}</strong>`);
      if (m.sparsity != null) parts.push(`Sparsity: <strong>${(m.sparsity * 100).toFixed(2)}%</strong>`);
      if (m.activeFeatures != null) parts.push(`Active features: <strong>${m.activeFeatures}</strong>`);
      if (m.trainMse != null) parts.push(`Train MSE: <strong>${m.trainMse.toFixed(6)}</strong>`);
      if (m.deadFeaturesPct != null) parts.push(`Dead features: <strong>${m.deadFeaturesPct.toFixed(1)}%</strong>`);
      metricsEl.innerHTML = parts.map((part) => `<span class="sae-metric-item">${part}</span>`).join('');
      metricsEl.removeAttribute('hidden');
      metricsEl.classList.remove('hidden');
    },
    syncFromSettings() {
      const s = readSettings();
      syncInputsFromSettings(s);
      setToggleUi(s.enabled);
    },
  };
}
