/**
 * LLM Engine Manager preferences.
 * Desktop persists under vl3d.engine.*. Mobile collapse follows CollapsibleDock:
 * default collapsed, writes ignored.
 */

import {
  readCollapsedPreference,
  writeCollapsedPreference,
} from './CollapsibleDock.js';

export const ENGINE_STORAGE_PREFIX = 'vl3d.engine.';

export const ENGINE_STORAGE_KEYS = Object.freeze({
  panelCollapsed: `${ENGINE_STORAGE_PREFIX}panelCollapsed`,
  shieldEnabled: `${ENGINE_STORAGE_PREFIX}shieldEnabled`,
  dualPathEnabled: `${ENGINE_STORAGE_PREFIX}dualPathEnabled`,
});

export const DEFAULT_ENGINE_SETTINGS = Object.freeze({
  shieldEnabled: true,
  dualPathEnabled: false,
});

/**
 * @param {Storage | null | undefined} storage
 * @param {string} key
 * @returns {string | null}
 */
function readRaw(storage, key) {
  if (!storage || typeof storage.getItem !== 'function') return null;
  try {
    const raw = storage.getItem(key);
    return raw == null ? null : String(raw);
  } catch {
    return null;
  }
}

/**
 * @param {string | null} raw
 * @param {boolean} fallback
 * @returns {boolean}
 */
function readFlag(raw, fallback) {
  if (raw == null) return fallback;
  return raw === '1' || raw === 'true';
}

/**
 * @param {Storage | null | undefined} storage
 * @returns {{ shieldEnabled: boolean, dualPathEnabled: boolean }}
 */
export function readEngineSettings(storage) {
  return {
    shieldEnabled: readFlag(
      readRaw(storage, ENGINE_STORAGE_KEYS.shieldEnabled),
      DEFAULT_ENGINE_SETTINGS.shieldEnabled,
    ),
    dualPathEnabled: readFlag(
      readRaw(storage, ENGINE_STORAGE_KEYS.dualPathEnabled),
      DEFAULT_ENGINE_SETTINGS.dualPathEnabled,
    ),
  };
}

/**
 * @param {Storage | null | undefined} storage
 * @param {{ shieldEnabled?: boolean, dualPathEnabled?: boolean }} settings
 */
export function saveEngineSettings(storage, settings = {}) {
  if (!storage || typeof storage.setItem !== 'function') return;
  const shield = settings.shieldEnabled ?? DEFAULT_ENGINE_SETTINGS.shieldEnabled;
  const dual = settings.dualPathEnabled ?? DEFAULT_ENGINE_SETTINGS.dualPathEnabled;
  try {
    storage.setItem(ENGINE_STORAGE_KEYS.shieldEnabled, shield ? '1' : '0');
    storage.setItem(ENGINE_STORAGE_KEYS.dualPathEnabled, dual ? '1' : '0');
  } catch {
    /* private mode / blocked storage */
  }
}

/**
 * @param {Storage | null | undefined} storage
 * @param {{ isMobile?: boolean }} [opts]
 * @returns {boolean}
 */
export function readEnginePanelCollapsed(storage, opts = {}) {
  return readCollapsedPreference(storage, ENGINE_STORAGE_KEYS.panelCollapsed, {
    isMobile: opts.isMobile ?? false,
    defaultCollapsed: false,
  });
}

/**
 * @param {Storage | null | undefined} storage
 * @param {boolean} collapsed
 * @param {{ isMobile?: boolean }} [opts]
 */
export function writeEnginePanelCollapsed(storage, collapsed, opts = {}) {
  writeCollapsedPreference(storage, ENGINE_STORAGE_KEYS.panelCollapsed, collapsed, {
    isMobile: opts.isMobile ?? false,
  });
}

/**
 * @param {unknown} ratio
 * @returns {string}
 */
export function formatEnergyConcentration(ratio) {
  const n = Number(ratio);
  if (!Number.isFinite(n)) return '—';
  const pct = Math.round(n * 10000) / 100;
  return `${pct.toFixed(2)}% L2 Norm`;
}

/**
 * Signed change shown in the sheet: pruned mean minus raw mean = −cosine_delta.
 * The raw → pruned pair is printed only when the payload carries both means.
 * cosine_delta alone cannot recover that pair.
 *
 * @param {{ cosine_delta?: unknown, cosine_raw?: unknown, cosine_pruned?: unknown, mean_raw_cosine?: unknown, mean_pruned_cosine?: unknown } | null | undefined} profile
 * @returns {string}
 */
export function formatCosineDrop(profile) {
  const delta = Number(profile?.cosine_delta);
  if (!Number.isFinite(delta)) return '—';
  const signed = -delta;
  const abs = Math.abs(signed).toFixed(4);
  const sign = signed < 0 ? '-' : '+';
  const deltaText = `${sign}${abs}`;
  const raw = Number(profile?.cosine_raw ?? profile?.mean_raw_cosine);
  const pruned = Number(profile?.cosine_pruned ?? profile?.mean_pruned_cosine);
  if (Number.isFinite(raw) && Number.isFinite(pruned)) {
    return `${raw.toFixed(4)} → ${pruned.toFixed(4)} (Δ ${deltaText})`;
  }
  return `(Δ ${deltaText})`;
}
