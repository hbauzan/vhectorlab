/**
 * Resolve hover raycast payload → HUD telemetry fields.
 * Points meshes store per-vertex data in userData.pointsData[index].
 */

export const MAX_ACTIVATION_DECIMALS = 32;

/**
 * Map a Three.js intersect payload to display fields.
 * @param {object|null|undefined} data
 * @returns {{
 *   point: { x: number, y: number, z: number } | null,
 *   index: number | null,
 *   activation: number,
 *   type: string,
 *   token: string,
 *   dim: number | null,
 * } | null}
 */
export function resolveHoverTelemetry(data) {
  if (!data) return null;

  const index = data.index != null ? data.index : null;
  const ud = data.userData || {};
  const pointsData = ud.pointsData;

  let activation = null;
  /** @type {Record<string, unknown>} */
  let meta = {};

  if (Array.isArray(pointsData) && index != null && pointsData[index]) {
    const pt = pointsData[index];
    activation = typeof pt.activation === 'number' ? pt.activation : pt.meta?.val;
    meta = pt.meta && typeof pt.meta === 'object' ? pt.meta : {};
  } else if (Array.isArray(ud.activations)) {
    const actIdx = resolveActivationIndex(data, ud);
    if (actIdx != null && actIdx >= 0 && actIdx < ud.activations.length) {
      activation = ud.activations[actIdx];
      const sourceDim = Array.isArray(ud.sourceDims) && ud.sourceDims[actIdx] != null
        ? Number(ud.sourceDims[actIdx])
        : actIdx;
      meta = {
        dim: sourceDim,
        token: ud.token,
        type: ud.type,
        val: activation,
      };
    }
  } else if (typeof data.activation === 'number') {
    activation = data.activation;
  } else if (typeof ud.val === 'number') {
    activation = ud.val;
  }

  if (typeof activation !== 'number' || !Number.isFinite(activation)) {
    activation = 0;
  }

  const dim = meta.dim != null ? Number(meta.dim) : index;
  const token =
    (typeof meta.token === 'string' && meta.token)
    || (typeof meta.word === 'string' && meta.word)
    || (typeof ud.token === 'string' && ud.token)
    || (typeof ud.word === 'string' && ud.word)
    || (dim != null ? `DIM #${dim}` : '—');

  const typeRaw = meta.type || ud.type || 'VECTOR';

  return {
    point: data.point || null,
    index,
    activation,
    type: String(typeRaw).toUpperCase(),
    token: String(token),
    dim: dim != null && Number.isFinite(dim) ? dim : null,
  };
}

/**
 * @param {object} data
 * @param {object} ud
 * @returns {number|null}
 */
function resolveActivationIndex(data, ud) {
  if (ud.kind === 'wideRibbon' && data.face) {
    const a = data.face.a;
    if (typeof a === 'number') return Math.floor(a / 2);
  }
  if (data.index != null && Number.isFinite(data.index)) {
    return data.index;
  }
  return null;
}

/**
 * Format an activation for the bottom HUD.
 * Uses enough decimals to show significance (cap 32), then shrinks to fit maxChars.
 * Tiny values that still overflow fall back to scientific notation.
 *
 * @param {number} value
 * @param {{ maxDecimals?: number, maxChars?: number }} [options]
 * @returns {string}
 */
export function formatActivationValue(value, options = {}) {
  const maxDecimals = Math.min(
    Math.max(0, options.maxDecimals ?? MAX_ACTIVATION_DECIMALS),
    MAX_ACTIVATION_DECIMALS
  );
  const maxChars = Math.max(3, options.maxChars ?? 20);

  if (!Number.isFinite(value)) return '--';
  if (value === 0) return '0';

  const abs = Math.abs(value);
  let idealDecimals;
  if (abs >= 1) {
    idealDecimals = Math.min(maxDecimals, 6);
  } else {
    // Digits after decimal until first significant + a few more for nuance
    const firstSig = Math.ceil(-Math.log10(abs));
    idealDecimals = Math.min(maxDecimals, Math.max(4, firstSig + 4));
  }

  for (let d = idealDecimals; d >= 0; d--) {
    const candidate = trimFixed(value, d);
    if (candidate.length <= maxChars) {
      // Avoid collapsing tiny non-zero to "0" — try scientific instead
      if (Number(candidate) === 0 && value !== 0) break;
      return candidate;
    }
  }

  return formatScientific(value, maxChars);
}

/**
 * Estimate how many monospace characters fit in a pixel budget.
 * @param {number} widthPx
 * @param {number} [fontSizePx=12]
 * @returns {number}
 */
export function estimateMonospaceChars(widthPx, fontSizePx = 12) {
  if (!(widthPx > 0) || !(fontSizePx > 0)) return 8;
  // Typical monospace advance ≈ 0.6em
  return Math.max(3, Math.floor(widthPx / (fontSizePx * 0.6)));
}

/**
 * Char budget for the numeric part given total activation slot width and label.
 * @param {number} slotWidthPx
 * @param {string} label - e.g. "ACTIVATION: " or "ACT: "
 * @param {number} [fontSizePx]
 * @returns {{ maxChars: number, compactLabel: boolean }}
 */
export function activationDisplayBudget(slotWidthPx, label = 'ACTIVATION: ', fontSizePx = 12) {
  const totalChars = estimateMonospaceChars(slotWidthPx, fontSizePx);
  const labelLen = label.length;
  let maxChars = totalChars - labelLen;
  let compactLabel = false;

  if (maxChars < 8) {
    compactLabel = true;
    maxChars = totalChars - 'ACT: '.length;
  }
  return {
    maxChars: Math.max(4, maxChars),
    compactLabel,
  };
}

function trimFixed(value, decimals) {
  if (decimals <= 0) {
    return String(Math.round(value));
  }
  const fixed = value.toFixed(decimals);
  // Keep at least one digit after decimal when present; strip trailing zeros
  return fixed.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
}

function formatScientific(value, maxChars) {
  for (let p = 6; p >= 0; p--) {
    const s = value.toExponential(p);
    if (s.length <= maxChars) return s;
  }
  return value.toExponential(0);
}
