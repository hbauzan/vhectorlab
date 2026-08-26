/**
 * Dual A / mA knobs for high-coverage percent (30…100).
 * One persisted percent; knobs are a projection (studio-gear metaphor).
 * Interaction = disguised range sliders (not true angular capture).
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
export const COVERAGE_MA_MAX = 0.9;
export const COVERAGE_MA_STEP = 0.1;

/** Dial sweep degrees (CSS rotate). */
export const COVERAGE_KNOB_ANGLE_MIN = -135;
export const COVERAGE_KNOB_ANGLE_MAX = 135;

/** Visual lerp when readout commits / value jumps (ms). */
export const COVERAGE_KNOB_LERP_MS = 200;

/**
 * Snap milliamperes metaphor to tenths [0.0, 0.9].
 * @param {unknown} raw
 * @returns {number}
 */
export function normalizeCoverageMilliAmps(raw) {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return COVERAGE_MA_MIN;
  const snapped = Math.round(n / COVERAGE_MA_STEP) * COVERAGE_MA_STEP;
  const clamped = Math.max(COVERAGE_MA_MIN, Math.min(COVERAGE_MA_MAX, snapped));
  return Math.round(clamped * 10) / 10;
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
 * Percent → { a, mA }. 100→A100/mA0; 99.9→A99/mA0.9.
 * @param {unknown} percent
 * @returns {{ a: number, mA: number }}
 */
export function decomposeCoveragePercent(percent) {
  const v = normalizeHighCoverage(percent);
  if (v >= HIGH_COVERAGE_MAX - 1e-9) {
    return { a: COVERAGE_A_MAX, mA: 0 };
  }
  const a = Math.floor(v + 1e-9);
  const mA = normalizeCoverageMilliAmps(v - a);
  return { a, mA };
}

/**
 * Compose A + mA → clamped percent (least-effort clamp at edges).
 * @param {unknown} a
 * @param {unknown} mA
 * @returns {number}
 */
export function composeCoveragePercent(a, mA) {
  const amps = typeof a === 'number' ? a : Number(a);
  const milli = normalizeCoverageMilliAmps(mA);
  const raw = (Number.isFinite(amps) ? amps : COVERAGE_A_MIN) + milli;
  return normalizeHighCoverage(raw);
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
 * Tenths index 0…9 ↔ mA 0.0…0.9 for HTML range.
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
            <div class="viz-am-knob-face">
              <div class="viz-am-knob-dial" id="${id}-a-dial" style="--knob-angle: ${aAngle}deg" aria-hidden="true">
                <span class="viz-am-knob-pointer"></span>
              </div>
              <input type="range" id="${id}-a" class="viz-am-knob-range" min="${COVERAGE_A_MIN}" max="${COVERAGE_A_MAX}" step="1" value="${a}" ${dis} aria-label="${amountLabel} A" title="A (coarse %)">
            </div>
          </div>
          <div class="viz-am-knob viz-am-knob--ma">
            <div class="viz-am-knob-label"><span class="field-label-text">mA</span>${infoTipMarkup(FIELD_INFO.coverageMilliAmps)}</div>
            <div class="viz-am-knob-face">
              <div class="viz-am-knob-dial" id="${id}-ma-dial" style="--knob-angle: ${mAngle}deg" aria-hidden="true">
                <span class="viz-am-knob-pointer"></span>
              </div>
              <input type="range" id="${id}-ma" class="viz-am-knob-range" min="0" max="9" step="1" value="${maSlider}" ${dis} aria-label="${amountLabel} mA" title="mA (tenths %)">
            </div>
          </div>
        </div>
      </div>`;
}

/**
 * Bind readout + A/mA ranges for one coverage control.
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
  if (!readout || !aRange || !maRange) return;

  const paint = (percent, animate) => {
    const v = normalizeHighCoverage(percent);
    const { a, mA } = decomposeCoveragePercent(v);
    readout.value = formatHighCoverageEdit(v);
    aRange.value = String(a);
    maRange.value = String(milliAmpsToSlider(mA));
    setCoverageKnobDialAngle(aDial, coverageKnobAngleDeg(a, COVERAGE_A_MIN, COVERAGE_A_MAX), { animate });
    setCoverageKnobDialAngle(maDial, coverageKnobAngleDeg(mA, COVERAGE_MA_MIN, COVERAGE_MA_MAX), { animate });
  };

  const commitFromKnobs = () => {
    const next = composeCoveragePercent(aRange.value, milliAmpsFromSlider(maRange.value));
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

  aRange.addEventListener('input', commitFromKnobs);
  maRange.addEventListener('input', commitFromKnobs);
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
  if (!readout || !aRange || !maRange) return;
  const v = normalizeHighCoverage(percent);
  const { a, mA } = decomposeCoveragePercent(v);
  const animate = opts.animate === true;
  readout.value = formatHighCoverageEdit(v);
  aRange.value = String(a);
  maRange.value = String(milliAmpsToSlider(mA));
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
}
