/**
 * Hold-to-repeat with accelerating interval (for ± steppers).
 * Immediate tick on start, then after initialDelay, repeats faster toward minInterval.
 */

/**
 * @typedef {{
 *   initialDelayMs?: number,
 *   intervalStartMs?: number,
 *   intervalMinMs?: number,
 *   accelFactor?: number,
 * }} HoldRepeatTiming
 */

/** @type {Required<HoldRepeatTiming>} */
export const DEFAULT_HOLD_REPEAT_TIMING = Object.freeze({
  initialDelayMs: 280,
  intervalStartMs: 110,
  intervalMinMs: 28,
  accelFactor: 0.82,
});

/**
 * Delay before the next repeat tick.
 * stepIndex 0 = wait after the immediate first press before first auto-tick.
 * stepIndex ≥1 = subsequent auto-ticks (accelerating).
 * @param {number} stepIndex
 * @param {HoldRepeatTiming} [timing]
 * @returns {number}
 */
export function holdRepeatIntervalMs(stepIndex, timing = {}) {
  const src = timing && typeof timing === 'object' ? timing : {};
  /** @type {Required<HoldRepeatTiming>} */
  const t = { ...DEFAULT_HOLD_REPEAT_TIMING };
  if (src.initialDelayMs != null) t.initialDelayMs = src.initialDelayMs;
  if (src.intervalStartMs != null) t.intervalStartMs = src.intervalStartMs;
  if (src.intervalMinMs != null) t.intervalMinMs = src.intervalMinMs;
  if (src.accelFactor != null) t.accelFactor = src.accelFactor;
  const step = Math.max(0, Math.round(Number(stepIndex) || 0));
  if (step <= 0) return t.initialDelayMs;
  const scaled = t.intervalStartMs * (t.accelFactor ** (step - 1));
  return Math.max(t.intervalMinMs, Math.round(scaled));
}

/**
 * @param {{
 *   onTick: () => void,
 *   initialDelayMs?: number,
 *   intervalStartMs?: number,
 *   intervalMinMs?: number,
 *   accelFactor?: number,
 *   schedule?: (fn: () => void, ms: number) => unknown,
 *   cancel?: (id: unknown) => void,
 * }} opts
 */
export function createHoldRepeatController(opts) {
  const onTick = opts.onTick;
  const timing = {
    initialDelayMs: opts.initialDelayMs,
    intervalStartMs: opts.intervalStartMs,
    intervalMinMs: opts.intervalMinMs,
    accelFactor: opts.accelFactor,
  };
  const schedule = typeof opts.schedule === 'function'
    ? opts.schedule
    : (fn, ms) => setTimeout(fn, ms);
  const cancel = typeof opts.cancel === 'function'
    ? opts.cancel
    : (id) => clearTimeout(/** @type {ReturnType<typeof setTimeout>} */ (id));

  let timer = /** @type {unknown|null} */ (null);
  let active = false;
  let steps = 0;

  function clearTimer() {
    if (timer != null) {
      cancel(timer);
      timer = null;
    }
  }

  function stop() {
    active = false;
    clearTimer();
    steps = 0;
  }

  function armNext() {
    clearTimer();
    if (!active) return;
    const ms = holdRepeatIntervalMs(steps, timing);
    timer = schedule(() => {
      if (!active) return;
      steps += 1;
      onTick();
      armNext();
    }, ms);
  }

  function start() {
    stop();
    active = true;
    onTick();
    armNext();
  }

  return { start, stop };
}

/**
 * Wire pointer hold-repeat onto a button (no duplicate click handler).
 * @param {HTMLElement} button
 * @param {() => void} onTick
 * @param {HoldRepeatTiming & { schedule?: Function, cancel?: Function }} [timing]
 * @returns {() => void} dispose
 */
export function bindHoldRepeatButton(button, onTick, timing = {}) {
  if (!button || typeof onTick !== 'function') return () => {};

  const ctrl = createHoldRepeatController({ onTick, ...timing });
  let pointerId = /** @type {number|null} */ (null);

  const onDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    pointerId = e.pointerId;
    try {
      button.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
    ctrl.start();
  };

  const onUp = (e) => {
    if (pointerId != null && e.pointerId !== pointerId) return;
    pointerId = null;
    ctrl.stop();
  };

  const onCancel = () => {
    pointerId = null;
    ctrl.stop();
  };

  button.addEventListener('pointerdown', onDown);
  button.addEventListener('pointerup', onUp);
  button.addEventListener('pointercancel', onCancel);
  button.addEventListener('lostpointercapture', onCancel);
  button.addEventListener('contextmenu', (e) => e.preventDefault());

  return () => {
    ctrl.stop();
    button.removeEventListener('pointerdown', onDown);
    button.removeEventListener('pointerup', onUp);
    button.removeEventListener('pointercancel', onCancel);
    button.removeEventListener('lostpointercapture', onCancel);
  };
}
