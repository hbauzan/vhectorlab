/**
 * SAE Clean/Denoise controls — defaults + localStorage (`vl3d.sae.v2.*`).
 */

/** @typedef {{
 *   enabled: boolean,
 *   hiddenDim: number,
 *   k: number,
 *   epochs: number,
 *   lr: number,
 *   batchSize: number,
 * }} SaeUiSettings */

/** v2 prefix — ignores poisoned v1 keys (e.g. hidden=32 / k=1 / epochs=1 leftovers). */
export const SAE_STORAGE_PREFIX = 'vl3d.sae.v2.';

export const SAE_STORAGE_KEYS = Object.freeze({
  enabled: `${SAE_STORAGE_PREFIX}enabled`,
  hiddenDim: `${SAE_STORAGE_PREFIX}hiddenDim`,
  k: `${SAE_STORAGE_PREFIX}k`,
  epochs: `${SAE_STORAGE_PREFIX}epochs`,
  lr: `${SAE_STORAGE_PREFIX}lr`,
  batchSize: `${SAE_STORAGE_PREFIX}batchSize`,
});

/** Product defaults: auto-scale still shrinks for small N (≈672D·k32·20ep for n=136). */
export const DEFAULT_SAE_SETTINGS = Object.freeze({
  enabled: false,
  hiddenDim: 8192,
  k: 32,
  epochs: 20,
  lr: 1e-3,
  batchSize: 64,
});

/**
 * Drop legacy `vl3d.sae.*` (pre-v2) keys so Train never inherits crippled hypers.
 * @param {Storage} storage
 */
export function purgeLegacySaeStorage(storage) {
  if (!storage) return;
  try {
    const toRemove = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key) continue;
      if (key.startsWith('vl3d.sae.') && !key.startsWith(SAE_STORAGE_PREFIX)) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 */
function clampInt(value, fallback, min, max) {
  if (value === '' || value === null || value === undefined) return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  // Number('') === 0 — treat non-positive as "unset" so Train never silently becomes min (32 / k=1)
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/**
 * @param {unknown} value
 * @param {number} fallback
 */
function clampLr(value, fallback) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 1) return fallback;
  return n;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function normalizeSaeEnabled(value) {
  if (value === true || value === 'true' || value === '1') return true;
  return false;
}

/**
 * @param {Partial<SaeUiSettings>|null|undefined} partial
 * @returns {SaeUiSettings}
 */
export function resolveSaeSettings(partial = null) {
  const src = partial && typeof partial === 'object' ? partial : {};
  return {
    enabled: normalizeSaeEnabled(src.enabled),
    hiddenDim: clampInt(src.hiddenDim, DEFAULT_SAE_SETTINGS.hiddenDim, 32, 32768),
    k: clampInt(src.k, DEFAULT_SAE_SETTINGS.k, 1, 4096),
    epochs: clampInt(src.epochs, DEFAULT_SAE_SETTINGS.epochs, 1, 500),
    lr: clampLr(src.lr, DEFAULT_SAE_SETTINGS.lr),
    batchSize: clampInt(src.batchSize, DEFAULT_SAE_SETTINGS.batchSize, 1, 2048),
  };
}

/**
 * @param {Storage|null|undefined} storage
 * @returns {SaeUiSettings}
 */
export function loadSaeSettings(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return { ...DEFAULT_SAE_SETTINGS };
  try {
    purgeLegacySaeStorage(storage);
    return resolveSaeSettings({
      enabled: storage.getItem(SAE_STORAGE_KEYS.enabled),
      hiddenDim: storage.getItem(SAE_STORAGE_KEYS.hiddenDim),
      k: storage.getItem(SAE_STORAGE_KEYS.k),
      epochs: storage.getItem(SAE_STORAGE_KEYS.epochs),
      lr: storage.getItem(SAE_STORAGE_KEYS.lr),
      batchSize: storage.getItem(SAE_STORAGE_KEYS.batchSize),
    });
  } catch {
    return { ...DEFAULT_SAE_SETTINGS };
  }
}

/**
 * @param {SaeUiSettings} settings
 * @param {Storage|null|undefined} storage
 */
export function saveSaeSettings(settings, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return;
  const resolved = resolveSaeSettings(settings);
  try {
    purgeLegacySaeStorage(storage);
    storage.setItem(SAE_STORAGE_KEYS.enabled, String(resolved.enabled));
    storage.setItem(SAE_STORAGE_KEYS.hiddenDim, String(resolved.hiddenDim));
    storage.setItem(SAE_STORAGE_KEYS.k, String(resolved.k));
    storage.setItem(SAE_STORAGE_KEYS.epochs, String(resolved.epochs));
    storage.setItem(SAE_STORAGE_KEYS.lr, String(resolved.lr));
    storage.setItem(SAE_STORAGE_KEYS.batchSize, String(resolved.batchSize));
  } catch {
    // Quota / private mode
  }
}

/**
 * L0 / sparsity helpers from a batch of activation rows.
 * @param {number[][]} activations
 * @returns {{ l0: number, sparsity: number, activeFeatures: number, dim: number }}
 */
export function computeActivationMetrics(activations) {
  if (!activations || !activations.length) {
    return { l0: 0, sparsity: 0, activeFeatures: 0, dim: 0 };
  }
  const dim = activations[0].length;
  let l0Sum = 0;
  const featureHit = new Uint8Array(dim);
  for (const row of activations) {
    let active = 0;
    for (let i = 0; i < dim; i++) {
      if (row[i] > 0) {
        active += 1;
        featureHit[i] = 1;
      }
    }
    l0Sum += active;
  }
  const l0 = l0Sum / activations.length;
  let activeFeatures = 0;
  for (let i = 0; i < dim; i++) activeFeatures += featureHit[i];
  return {
    l0,
    sparsity: dim ? l0 / dim : 0,
    activeFeatures,
    dim,
  };
}

/**
 * Human-readable Train SAE progress (what / done / left / %).
 * @param {{
 *   status?: string,
 *   message?: string,
 *   phase?: string,
 *   phase_key?: string,
 *   current_epoch?: number,
 *   total_epochs?: number,
 *   remaining_epochs?: number,
 *   percent?: number,
 *   loss?: number,
 *   n_vectors?: number,
 *   resolved_hidden?: number,
 *   resolved_k?: number,
 * }|null|undefined} training
 * @returns {{ label: string, meta: string, current: number, total: number, percent: number, busy: boolean, indeterminate: boolean }}
 */
export function formatSaeTrainProgress(training) {
  const t = training && typeof training === 'object' ? training : {};
  const status = String(t.status || 'idle');
  const total = Math.max(0, Number(t.total_epochs) || 0);
  const current = Math.max(0, Math.min(total || Number.MAX_SAFE_INTEGER, Number(t.current_epoch) || 0));
  const remaining = t.remaining_epochs != null
    ? Math.max(0, Number(t.remaining_epochs))
    : Math.max(0, total - current);
  let percent = Number(t.percent);
  if (!Number.isFinite(percent)) {
    percent = total > 0 ? Math.round((1000 * current) / total) / 10 : 0;
  }
  percent = Math.max(0, Math.min(100, percent));

  const phaseKey = String(t.phase_key || '');
  const busy = status === 'training' || status === 'preparing' || phaseKey === 'installing';

  let label = String(t.message || t.phase || '').trim();
  if (!label) {
    if (phaseKey === 'preparing' || status === 'preparing') {
      label = 'Preparing training data…';
    } else if (phaseKey === 'installing') {
      label = 'Installing session model…';
    } else if (busy && total > 0) {
      const running = Math.min(total, current + 1);
      label = `Training epoch ${running}/${total} — ${remaining} remaining`;
    } else if (status === 'success') {
      label = 'Training complete';
    } else if (status === 'failed') {
      label = 'Training failed';
    } else {
      label = 'Starting SAE training…';
    }
  }

  const parts = [];
  if (total > 0) {
    parts.push(`${current}/${total} done`);
    parts.push(`${remaining} left`);
  }
  parts.push(`${percent}%`);
  if (t.n_vectors != null) parts.push(`n=${t.n_vectors}`);
  if (t.resolved_hidden != null && t.resolved_k != null) {
    parts.push(`${t.resolved_hidden}D·k=${t.resolved_k}`);
  }

  return {
    label,
    meta: parts.join(' · '),
    current: Math.floor(current),
    total: total || 1,
    percent,
    busy,
    indeterminate: busy && (percent < 2 || phaseKey === 'preparing' || phaseKey === 'installing'),
  };
}
