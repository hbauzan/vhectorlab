/**
 * ARITHMETIC workspace persistence — defaults + localStorage (`vl3d.arithmetic.*`).
 */

/** @typedef {{
 *   wordA: string,
 *   wordB: string,
 *   wordC: string,
 *   topK: number,
 *   lastResult: object|null,
 * }} ArithmeticUiSettings */

export const ARITHMETIC_STORAGE_PREFIX = 'vl3d.arithmetic.';

export const ARITHMETIC_STORAGE_KEYS = Object.freeze({
  wordA: `${ARITHMETIC_STORAGE_PREFIX}wordA`,
  wordB: `${ARITHMETIC_STORAGE_PREFIX}wordB`,
  wordC: `${ARITHMETIC_STORAGE_PREFIX}wordC`,
  topK: `${ARITHMETIC_STORAGE_PREFIX}topK`,
  lastResult: `${ARITHMETIC_STORAGE_PREFIX}lastResult`,
});

export const DEFAULT_ARITHMETIC_SETTINGS = Object.freeze({
  wordA: 'king',
  wordB: 'man',
  wordC: 'woman',
  topK: 10,
  lastResult: null,
});

/**
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string}
 */
function normalizeWord(value, fallback) {
  if (value == null) return fallback;
  const s = String(value).trim();
  return s || fallback;
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function clampTopK(value, fallback) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.max(1, Math.min(100, Math.round(n)));
}

/**
 * @param {unknown} value
 * @returns {object|null}
 */
export function normalizeLastResult(value) {
  if (value == null || value === '') return null;
  let obj = value;
  if (typeof value === 'string') {
    try {
      obj = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object') return null;
  if (!Array.isArray(obj.results) || !Array.isArray(obj.vector_res)) return null;
  return obj;
}

/**
 * @param {Partial<ArithmeticUiSettings>|null|undefined} partial
 * @returns {ArithmeticUiSettings}
 */
export function resolveArithmeticSettings(partial = null) {
  const src = partial && typeof partial === 'object' ? partial : {};
  return {
    wordA: normalizeWord(src.wordA, DEFAULT_ARITHMETIC_SETTINGS.wordA),
    wordB: normalizeWord(src.wordB, DEFAULT_ARITHMETIC_SETTINGS.wordB),
    wordC: normalizeWord(src.wordC, DEFAULT_ARITHMETIC_SETTINGS.wordC),
    topK: clampTopK(src.topK, DEFAULT_ARITHMETIC_SETTINGS.topK),
    lastResult: normalizeLastResult(src.lastResult),
  };
}

/**
 * @param {Storage|null|undefined} storage
 * @returns {ArithmeticUiSettings}
 */
export function loadArithmeticSettings(
  storage = typeof localStorage !== 'undefined' ? localStorage : null,
) {
  if (!storage) return { ...DEFAULT_ARITHMETIC_SETTINGS, lastResult: null };
  try {
    return resolveArithmeticSettings({
      wordA: storage.getItem(ARITHMETIC_STORAGE_KEYS.wordA),
      wordB: storage.getItem(ARITHMETIC_STORAGE_KEYS.wordB),
      wordC: storage.getItem(ARITHMETIC_STORAGE_KEYS.wordC),
      topK: storage.getItem(ARITHMETIC_STORAGE_KEYS.topK),
      lastResult: storage.getItem(ARITHMETIC_STORAGE_KEYS.lastResult),
    });
  } catch {
    return { ...DEFAULT_ARITHMETIC_SETTINGS, lastResult: null };
  }
}

/**
 * @param {ArithmeticUiSettings|Partial<ArithmeticUiSettings>} settings
 * @param {Storage|null|undefined} storage
 */
export function saveArithmeticSettings(
  settings,
  storage = typeof localStorage !== 'undefined' ? localStorage : null,
) {
  if (!storage) return;
  const resolved = resolveArithmeticSettings(settings);
  try {
    storage.setItem(ARITHMETIC_STORAGE_KEYS.wordA, resolved.wordA);
    storage.setItem(ARITHMETIC_STORAGE_KEYS.wordB, resolved.wordB);
    storage.setItem(ARITHMETIC_STORAGE_KEYS.wordC, resolved.wordC);
    storage.setItem(ARITHMETIC_STORAGE_KEYS.topK, String(resolved.topK));
    if (resolved.lastResult) {
      storage.setItem(
        ARITHMETIC_STORAGE_KEYS.lastResult,
        JSON.stringify(resolved.lastResult),
      );
    } else {
      storage.removeItem(ARITHMETIC_STORAGE_KEYS.lastResult);
    }
  } catch {
    // Quota / private mode
  }
}

/**
 * @param {Storage|null|undefined} storage
 */
export function clearArithmeticSettings(
  storage = typeof localStorage !== 'undefined' ? localStorage : null,
) {
  if (!storage) return;
  try {
    for (const key of Object.values(ARITHMETIC_STORAGE_KEYS)) {
      storage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Format navbar status from /health payload fields.
 * @param {string} [modelName]
 * @param {string} [device]
 * @returns {string}
 */
export function formatOnlineStatusLabel(modelName = '', device = '') {
  const model = String(modelName || '').trim();
  const dev = String(device || '').trim().toLowerCase();
  if (model && dev) return `ONLINE (${model} · ${dev})`;
  if (model) return `ONLINE (${model})`;
  if (dev) return `ONLINE (${dev})`;
  return 'ONLINE';
}
