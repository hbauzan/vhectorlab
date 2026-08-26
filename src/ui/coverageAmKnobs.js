/**
 * Dual A / mA knobs for high-coverage percent (30…100).
 * One persisted percent; knobs are a projection (studio-gear metaphor).
 * Interaction = DAW-style vertical drag (long throw, ns-resize cursor).
 */

import {
  HIGH_COVERAGE_MIN,
  HIGH_COVERAGE_MAX,
  normalizeHighCoverage,
  formatHighCoverageEdit,
  parseHighCoverageInput,
} from './visualizationControlsDefaults.js';
import { FIELD_INFO, infoTipMarkup } from './fieldInfo.js';

export const COVERAGE_A_MIN = HIGH_COVERAGE_MIN;
export const COVERAGE_A_MAX = HIGH_COVERAGE_MAX;
export const COVERAGE_MA_MIN = 0;
/** Fractional % via mA: up to 5 decimals (0 … 0.99999). µA knob later if needed. */
export const COVERAGE_MA_MAX = 0.99999;
export const COVERAGE_MA_STEP = 0.00001;
export const COVERAGE_MA_SLIDER_MAX = Math.round(COVERAGE_MA_MAX / COVERAGE_MA_STEP);

/** Dial sweep degrees (CSS rotate). */
export const COVERAGE_KNOB_ANGLE_MIN = -135;
export const COVERAGE_KNOB_ANGLE_MAX = 135;

/** Visual lerp when readout commits / value jumps (ms). */
export const COVERAGE_KNOB_LERP_MS = 200;

/**
 * Long vertical throw (px) — grip / slow feel.
 * Full A 30→100 ≈ 980px; full mA 0→≈1 ≈ 1600px.
 */
export const COVERAGE_KNOB_PX_PER_A = 14;
/** @deprecated alias — prefer COVERAGE_KNOB_PX_PER_MA_UNIT */
export const COVERAGE_KNOB_PX_PER_MA_STEP = 30;
/** Pixels to drag across the full mA span (0 → ~1). */
export const COVERAGE_KNOB_PX_PER_MA_UNIT = 1600;

/**
 * Snap milliamperes metaphor to 5-decimal fractional percent [0, 0.99999].
 * @param {unknown} raw
 * @returns {number}
 */
export function normalizeCoverageMilliAmps(raw) {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return COVERAGE_MA_MIN;
  const steps = Math.round(n / COVERAGE_MA_STEP);
  const clamped = Math.max(0, Math.min(COVERAGE_MA_SLIDER_MAX, steps));
  return Number((clamped * COVERAGE_MA_STEP).toFixed(5));
}

/**
 * Integer amperes metaphor [30, 100].
 * @param {unknown} raw
 * @returns {number}
 */
export function normalizeCoverageAmps(raw) {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return COVERAGE_A_MIN;
  return Math.max(COVERAGE_A_MIN, Math.min(COVERAGE_A_MAX, Math.round(n)));
}

/**
 * Percent → { a, mA }. 100→A100/mA0; 99.12345→A99/mA0.12345.
 * @param {unknown} percent
 * @returns {{ a: number, mA: number }}
 */
export function decomposeCoveragePercent(percent) {
  const v = normalizeHighCoverage(percent);
  if (v >= HIGH_COVERAGE_MAX - 1e-12) {
    return { a: COVERAGE_A_MAX, mA: 0 };
  }
  const a = Math.floor(v + 1e-12);
  const mA = normalizeCoverageMilliAmps(v - a);
  return { a, mA };
}

/**
 * Compose A + mA → clamped percent.
 * With `{ fromMilli: true }`, A=100 + mA>0 forces A→99 so fine fraction stays usable.
 *
 * @param {unknown} a
 * @param {unknown} mA
 * @param {{ fromMilli?: boolean }} [opts]
 * @returns {number}
 */
export function composeCoveragePercent(a, mA, opts = {}) {
  let amps = typeof a === 'number' ? a : Number(a);
  if (!Number.isFinite(amps)) amps = COVERAGE_A_MIN;
  const milli = normalizeCoverageMilliAmps(mA);
  if (opts.fromMilli === true && amps >= COVERAGE_A_MAX - 1e-12 && milli > 0) {
    amps = COVERAGE_A_MAX - 1;
  }
  return normalizeHighCoverage(amps + milli);
}

/**
 * Map a scalar in [min,max] to dial angle degrees.
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function coverageKnobAngleDeg(value, min, max) {
  const v = typeof value === 'number' ? value : Number(value);
  const lo = Number(min);
  const hi = Number(max);
  if (!Number.isFinite(v) || !Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) {
    return COVERAGE_KNOB_ANGLE_MIN;
  }
  const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  return COVERAGE_KNOB_ANGLE_MIN + t * (COVERAGE_KNOB_ANGLE_MAX - COVERAGE_KNOB_ANGLE_MIN);
}

/**
 * Screen dy → value delta. Pointer up (negative dy) increases value (DAW).
 * @param {number} dyPx
 * @param {number} pxPerUnit
 * @returns {number}
 */
export function coverageKnobValueDeltaFromDy(dyPx, pxPerUnit) {
  const dy = typeof dyPx === 'number' ? dyPx : Number(dyPx);
  const px = typeof pxPerUnit === 'number' ? pxPerUnit : Number(pxPerUnit);
  if (!Number.isFinite(dy) || !Number.isFinite(px) || px <= 0) return 0;
  return -dy / px;
}

/**
 * Integer steps 0…99999 ↔ mA 0…0.99999 for HTML range (a11y fallback).
 * @param {number} mA
 * @returns {number}
 */
export function milliAmpsToSlider(mA) {
  return Math.round(normalizeCoverageMilliAmps(mA) / COVERAGE_MA_STEP);
}

/**
 * @param {unknown} pos
 * @returns {number}
 */
export function milliAmpsFromSlider(pos) {
  const p = typeof pos === 'number' ? pos : Number(pos);
  if (!Number.isFinite(p)) return COVERAGE_MA_MIN;
  return normalizeCoverageMilliAmps(p * COVERAGE_MA_STEP);
}

/**
 * @param {HTMLElement|null|undefined} dial
 * @param {number} angleDeg
 * @param {{ animate?: boolean }} [opts]
 */
export function setCoverageKnobDialAngle(dial, angleDeg, opts = {}) {
  if (!dial) return;
  const animate = opts.animate === true;
  dial.classList.toggle('is-lerping', animate);
  dial.style.setProperty('--knob-angle', `${angleDeg}deg`);
  if (animate) {
    window.clearTimeout(dial._knobLerpTimer);
    dial._knobLerpTimer = window.setTimeout(() => {
      dial.classList.remove('is-lerping');
    }, COVERAGE_KNOB_LERP_MS + 40);
  }
}

/**
 * Markup for Coverage / Similarity dual A+mA knobs + editable %.
 *
 * @param {{
 *   idPrefix: string,
 *   amountLabel: string,
 *   amountTip: string,
 *   percent: number,
 *   disabled?: boolean,
 *   requires: string,
 * }} opts
 * @returns {string}
 */
export function coverageAmKnobsMarkup(opts) {
  const id = String(opts.idPrefix || 'viz-coverage');
  const disabled = opts.disabled === true;
  const dis = disabled ? 'disabled' : '';
  const percent = normalizeHighCoverage(opts.percent);
  const { a, mA } = decomposeCoveragePercent(percent);
  const aAngle = coverageKnobAngleDeg(a, COVERAGE_A_MIN, COVERAGE_A_MAX);
  const mAngle = coverageKnobAngleDeg(mA, COVERAGE_MA_MIN, COVERAGE_MA_MAX);
  const maSlider = milliAmpsToSlider(mA);
  const amountLabel = opts.amountLabel || 'Coverage';
  const amountTip = opts.amountTip || FIELD_INFO.zeroCoverageAmount;

  return `
      <div class="viz-coverage-knobs viz-fx-slider" data-requires="${opts.requires}">
        <div class="slider-header">
          <label for="${id}-val"><span class="field-label-text">${amountLabel}:</span>${infoTipMarkup(amountTip)}</label>
          <span class="viz-coverage-edit-wrap">
            <input type="number" id="${id}-val" class="slider-val viz-coverage-edit" min="${HIGH_COVERAGE_MIN}" max="${HIGH_COVERAGE_MAX}" step="any" value="${formatHighCoverageEdit(percent)}" ${dis} inputmode="decimal" aria-label="${amountLabel} percent">
            <span class="viz-coverage-unit" aria-hidden="true">%</span>
          </span>
        </div>
        <div class="viz-am-knobs-row" role="group" aria-label="${amountLabel} A and mA">
          <div class="viz-am-knob viz-am-knob--a">
            <div class="viz-am-knob-label"><span class="field-label-text">A</span>${infoTipMarkup(FIELD_INFO.coverageAmps)}</div>
            <div class="viz-am-knob-face" id="${id}-a-face" role="slider" tabindex="0" aria-valuemin="${COVERAGE_A_MIN}" aria-valuemax="${COVERAGE_A_MAX}" aria-valuenow="${a}" aria-label="${amountLabel} A" title="Drag vertically (DAW)">
              <div class="viz-am-knob-dial" id="${id}-a-dial" style="--knob-angle: ${aAngle}deg" aria-hidden="true">
                <span class="viz-am-knob-pointer"></span>
              </div>
              <input type="range" id="${id}-a" class="viz-am-knob-range" min="${COVERAGE_A_MIN}" max="${COVERAGE_A_MAX}" step="1" value="${a}" ${dis} tabindex="-1" aria-hidden="true">
            </div>
          </div>
          <div class="viz-am-knob viz-am-knob--ma">
            <div class="viz-am-knob-label"><span class="field-label-text">mA</span>${infoTipMarkup(FIELD_INFO.coverageMilliAmps)}</div>
            <div class="viz-am-knob-face" id="${id}-ma-face" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="${COVERAGE_MA_SLIDER_MAX}" aria-valuenow="${maSlider}" aria-label="${amountLabel} mA" title="Drag vertically (DAW)">
              <div class="viz-am-knob-dial" id="${id}-ma-dial" style="--knob-angle: ${mAngle}deg" aria-hidden="true">
                <span class="viz-am-knob-pointer"></span>
              </div>
              <input type="range" id="${id}-ma" class="viz-am-knob-range" min="0" max="${COVERAGE_MA_SLIDER_MAX}" step="1" value="${maSlider}" ${dis} tabindex="-1" aria-hidden="true">
            </div>
          </div>
        </div>
      </div>`;
}

/**
 * DAW vertical drag on a knob face (long throw + ns-resize).
 *
 * @param {HTMLElement} face
 * @param {{
 *   isDisabled: () => boolean,
 *   getFloat: () => number,
 *   applyFloat: (v: number) => void,
 *   pxPerUnit: number,
 *   min: number,
 *   max: number,
 * }} opts
 */
export function bindCoverageKnobVerticalDrag(face, opts) {
  if (!face || !opts) return;
  let dragging = false;
  let lastY = 0;
  let floatVal = 0;

  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    face.classList.remove('is-dragging');
    document.body.classList.remove('viz-am-knob-dragging');
    try {
      if (e?.pointerId != null) face.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  face.addEventListener('pointerdown', (e) => {
    if (opts.isDisabled()) return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    lastY = e.clientY;
    floatVal = opts.getFloat();
    face.classList.add('is-dragging');
    document.body.classList.add('viz-am-knob-dragging');
    face.setPointerCapture(e.pointerId);
  });

  face.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dy = e.clientY - lastY;
    lastY = e.clientY;
    floatVal += coverageKnobValueDeltaFromDy(dy, opts.pxPerUnit);
    floatVal = Math.max(opts.min, Math.min(opts.max, floatVal));
    opts.applyFloat(floatVal);
  });

  face.addEventListener('pointerup', endDrag);
  face.addEventListener('pointercancel', endDrag);
  face.addEventListener('lostpointercapture', () => {
    if (!dragging) return;
    dragging = false;
    face.classList.remove('is-dragging');
    document.body.classList.remove('viz-am-knob-dragging');
  });
}

/**
 * Bind readout + A/mA DAW knobs for one coverage control.
 *
 * @param {HTMLElement} container
 * @param {{
 *   idPrefix: string,
 *   getPercent: () => number,
 *   setPercent: (v: number) => void,
 *   emit: () => void,
 * }} opts
 */
export function wireCoverageAmKnobs(container, opts) {
  if (!container || !opts?.idPrefix) return;
  const id = opts.idPrefix;
  const readout = container.querySelector(`#${id}-val`);
  const aRange = container.querySelector(`#${id}-a`);
  const maRange = container.querySelector(`#${id}-ma`);
  const aDial = container.querySelector(`#${id}-a-dial`);
  const maDial = container.querySelector(`#${id}-ma-dial`);
  const aFace = container.querySelector(`#${id}-a-face`);
  const maFace = container.querySelector(`#${id}-ma-face`);
  if (!readout || !aRange || !maRange) return;

  const paint = (percent, animate) => {
    const v = normalizeHighCoverage(percent);
    const { a, mA } = decomposeCoveragePercent(v);
    readout.value = formatHighCoverageEdit(v);
    aRange.value = String(a);
    maRange.value = String(milliAmpsToSlider(mA));
    if (aFace) {
      aFace.setAttribute('aria-valuenow', String(a));
      aFace.toggleAttribute('aria-disabled', aRange.disabled);
    }
    if (maFace) {
      maFace.setAttribute('aria-valuenow', String(milliAmpsToSlider(mA)));
      maFace.toggleAttribute('aria-disabled', maRange.disabled);
    }
    setCoverageKnobDialAngle(aDial, coverageKnobAngleDeg(a, COVERAGE_A_MIN, COVERAGE_A_MAX), { animate });
    setCoverageKnobDialAngle(maDial, coverageKnobAngleDeg(mA, COVERAGE_MA_MIN, COVERAGE_MA_MAX), { animate });
  };

  const commitAmps = (floatA) => {
    const a = normalizeCoverageAmps(floatA);
    const mA = milliAmpsFromSlider(maRange.value);
    const next = composeCoveragePercent(a, mA);
    opts.setPercent(next);
    paint(next, false);
    opts.emit();
  };

  const commitMilli = (floatMa) => {
    const mA = normalizeCoverageMilliAmps(floatMa);
    const a = Number(aRange.value);
    const next = composeCoveragePercent(a, mA, { fromMilli: true });
    opts.setPercent(next);
    paint(next, false);
    opts.emit();
  };

  const commitFromReadout = () => {
    const next = parseHighCoverageInput(readout.value);
    opts.setPercent(next);
    paint(next, true);
    opts.emit();
  };

  bindCoverageKnobVerticalDrag(aFace, {
    isDisabled: () => aRange.disabled,
    getFloat: () => Number(aRange.value) || COVERAGE_A_MIN,
    applyFloat: commitAmps,
    pxPerUnit: COVERAGE_KNOB_PX_PER_A,
    min: COVERAGE_A_MIN,
    max: COVERAGE_A_MAX,
  });

  bindCoverageKnobVerticalDrag(maFace, {
    isDisabled: () => maRange.disabled,
    getFloat: () => milliAmpsFromSlider(maRange.value),
    applyFloat: commitMilli,
    // Long throw across full fractional span (0 → ~1)
    pxPerUnit: COVERAGE_KNOB_PX_PER_MA_UNIT,
    min: COVERAGE_MA_MIN,
    max: COVERAGE_MA_MAX,
  });

  // Keyboard a11y on faces
  const onFaceKey = (which) => (e) => {
    const range = which === 'a' ? aRange : maRange;
    if (range.disabled) return;
    let dir = 0;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') dir = 1;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') dir = -1;
    else return;
    e.preventDefault();
    if (which === 'a') {
      commitAmps(Number(aRange.value) + dir);
    } else {
      const step = e.shiftKey ? 0.001 : COVERAGE_MA_STEP;
      commitMilli(milliAmpsFromSlider(maRange.value) + dir * step);
    }
  };
  aFace?.addEventListener('keydown', onFaceKey('a'));
  maFace?.addEventListener('keydown', onFaceKey('ma'));

  readout.addEventListener('change', commitFromReadout);
  readout.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitFromReadout();
    }
  });

  paint(opts.getPercent(), false);
}

/**
 * Sync dials + readout from a percent (no emit).
 * @param {HTMLElement} container
 * @param {string} idPrefix
 * @param {unknown} percent
 * @param {{ animate?: boolean }} [opts]
 */
export function syncCoverageAmKnobsFromPercent(container, idPrefix, percent, opts = {}) {
  if (!container || !idPrefix) return;
  const readout = container.querySelector(`#${idPrefix}-val`);
  const aRange = container.querySelector(`#${idPrefix}-a`);
  const maRange = container.querySelector(`#${idPrefix}-ma`);
  const aDial = container.querySelector(`#${idPrefix}-a-dial`);
  const maDial = container.querySelector(`#${idPrefix}-ma-dial`);
  const aFace = container.querySelector(`#${idPrefix}-a-face`);
  const maFace = container.querySelector(`#${idPrefix}-ma-face`);
  if (!readout || !aRange || !maRange) return;
  const v = normalizeHighCoverage(percent);
  const { a, mA } = decomposeCoveragePercent(v);
  const animate = opts.animate === true;
  readout.value = formatHighCoverageEdit(v);
  aRange.value = String(a);
  maRange.value = String(milliAmpsToSlider(mA));
  if (aFace) aFace.setAttribute('aria-valuenow', String(a));
  if (maFace) maFace.setAttribute('aria-valuenow', String(milliAmpsToSlider(mA)));
  setCoverageKnobDialAngle(aDial, coverageKnobAngleDeg(a, COVERAGE_A_MIN, COVERAGE_A_MAX), { animate });
  setCoverageKnobDialAngle(maDial, coverageKnobAngleDeg(mA, COVERAGE_MA_MIN, COVERAGE_MA_MAX), { animate });
}

/**
 * Enable/disable A/mA + readout for a coverage knobs block.
 * @param {HTMLElement} container
 * @param {string} idPrefix
 * @param {boolean} enabled
 */
export function setCoverageAmKnobsEnabled(container, idPrefix, enabled) {
  if (!container || !idPrefix) return;
  const disabled = !enabled;
  for (const sel of [`#${idPrefix}-val`, `#${idPrefix}-a`, `#${idPrefix}-ma`]) {
    const el = container.querySelector(sel);
    if (el) el.disabled = disabled;
  }
  for (const sel of [`#${idPrefix}-a-face`, `#${idPrefix}-ma-face`]) {
    const face = container.querySelector(sel);
    if (!face) continue;
    face.toggleAttribute('aria-disabled', disabled);
    face.tabIndex = disabled ? -1 : 0;
    face.classList.toggle('is-disabled', disabled);
  }
}
