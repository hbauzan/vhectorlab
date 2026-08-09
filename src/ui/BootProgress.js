/**
 * Full-bleed canvas overlay: status text + progress bar for cold boot / Galaxy pipeline.
 * Visible even when left dock is collapsed (HF Space first visit).
 */

/**
 * @param {{ statusText?: string, step?: number, total?: number, label?: string }|null|undefined} progress
 * @returns {string}
 */
export function formatBootProgressLabel(progress) {
  if (!progress || typeof progress !== 'object') return '';
  if (progress.statusText) return String(progress.statusText);
  if (progress.step != null && progress.total != null) {
    return `${progress.step}/${progress.total} ${progress.label || ''}`.trim();
  }
  return String(progress.label || '').trim();
}

/**
 * @param {{ ratio?: number, step?: number, total?: number, indeterminate?: boolean }|null|undefined} progress
 * @returns {{ pct: number, indeterminate: boolean }}
 */
export function resolveBootProgressBar(progress) {
  if (!progress || typeof progress !== 'object') {
    return { pct: 0, indeterminate: false };
  }
  const indeterminate = !!progress.indeterminate;
  if (indeterminate) return { pct: 0, indeterminate: true };
  const ratio = Number.isFinite(progress.ratio)
    ? progress.ratio
    : (progress.step != null && progress.total
      ? progress.step / Math.max(1, progress.total)
      : 0);
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  return { pct, indeterminate: false };
}

/**
 * Soft time-based ratio while waiting for a hung/slow backend (model load).
 * @param {number} elapsedMs
 * @param {number} [expectMs=90000]
 */
export function softWaitRatio(elapsedMs, expectMs = 90000) {
  const t = Math.max(0, Number(elapsedMs) || 0);
  const expect = Math.max(1000, Number(expectMs) || 90000);
  return Math.min(0.92, t / expect);
}

/**
 * Soft ratio inside a Galaxy step band [lo, hi) so the bar keeps moving during long encode/UMAP.
 * @param {number} stepIndex 1-based
 * @param {number} total
 * @param {number} elapsedMs
 * @param {number} [expectMs=40000]
 */
export function softStepRatio(stepIndex, total, elapsedMs, expectMs = 40000) {
  const n = Math.max(1, Number(total) || 1);
  const step = Math.max(1, Math.min(Number(stepIndex) || 1, n));
  const lo = (step - 1) / n;
  const hi = step / n;
  const soft = softWaitRatio(elapsedMs, expectMs) / 0.92; // 0..1
  return lo + (hi - lo) * Math.min(0.95, soft);
}

/**
 * Race a promise against a timer. Resolves `fallback` on timeout when provided;
 * otherwise rejects with Error('timeout').
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {T} [fallback]
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms, fallback) {
  let timer = 0;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      if (fallback !== undefined) resolve(fallback);
      else reject(new Error('timeout'));
    }, Math.max(1, ms || 1));
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Yield so the browser can paint progress UI before the next heavy await.
 * @returns {Promise<void>}
 */
export function yieldToPaint() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * Interval ticker that keeps calling `onTick` even while an await is blocked.
 * @param {() => void} onTick
 * @param {number} [intervalMs=400]
 * @returns {() => void} stop
 */
export function startProgressTicker(onTick, intervalMs = 400) {
  if (typeof onTick !== 'function') return () => {};
  onTick();
  const id = setInterval(onTick, Math.max(50, intervalMs || 400));
  return () => clearInterval(id);
}

/**
 * Poll /health until the API answers. Uvicorn accepts TCP during lifespan model
 * load but does not respond — short aborts + a live ticker keep the overlay moving
 * even when a single fetch hangs longer than expected.
 *
 * @param {{
 *   checkHealth: (opts?: { timeoutMs?: number }) => Promise<{ ok: boolean, data?: object, error?: string }>,
 *   onProgress?: (p: object) => void,
 *   maxWaitMs?: number,
 *   attemptTimeoutMs?: number,
 *   gapMs?: number,
 *   tickMs?: number,
 * }} opts
 */
export async function waitForBackendHealthy(opts) {
  const maxWaitMs = opts.maxWaitMs ?? 120_000;
  const attemptTimeoutMs = opts.attemptTimeoutMs ?? 2500;
  const gapMs = opts.gapMs ?? 600;
  const tickMs = opts.tickMs ?? 400;
  const started = Date.now();
  let attempt = 0;

  const emit = () => {
    const elapsedMs = Date.now() - started;
    const elapsedSec = Math.floor(elapsedMs / 1000);
    opts.onProgress?.({
      statusText: `Waiting for backend… ${elapsedSec}s (model loading)`,
      ratio: softWaitRatio(elapsedMs),
      indeterminate: false,
      attempt,
    });
  };

  const stopTick = startProgressTicker(emit, tickMs);

  try {
    while (Date.now() - started < maxWaitMs) {
      attempt += 1;
      emit();
      await yieldToPaint();

      let health = { ok: false, error: 'unreachable' };
      try {
        // Belt-and-suspenders: provider aborts via AbortController; withTimeout
        // covers cases where the proxy holds the socket past abort.
        health = await withTimeout(
          Promise.resolve().then(() => opts.checkHealth({ timeoutMs: attemptTimeoutMs })),
          attemptTimeoutMs + 800,
          { ok: false, error: 'timeout' },
        );
      } catch (err) {
        health = { ok: false, error: err?.message || 'health failed' };
      }
      if (health?.ok) return health;

      await new Promise((r) => setTimeout(r, gapMs));
    }

    return { ok: false, error: 'Backend did not become ready in time' };
  } finally {
    stopTick();
  }
}

/**
 * Soft-advance progress inside a step while `work` runs (encode / UMAP / SAE).
 * @template T
 * @param {{
 *   onProgress?: (p: object) => void,
 *   step: number,
 *   total: number,
 *   label: string,
 *   expectMs?: number,
 *   tickMs?: number,
 * }} opts
 * @param {() => Promise<T>} work
 * @returns {Promise<T>}
 */
export async function withSoftStepProgress(opts, work) {
  const step = opts.step;
  const total = opts.total;
  const label = opts.label || '';
  const expectMs = opts.expectMs ?? 40_000;
  const tickMs = opts.tickMs ?? 400;
  const started = Date.now();

  const emit = () => {
    const elapsedMs = Date.now() - started;
    opts.onProgress?.({
      step,
      total,
      label,
      statusText: `${step}/${total} ${label}`.trim(),
      ratio: softStepRatio(step, total, elapsedMs, expectMs),
      indeterminate: false,
    });
  };

  const stop = startProgressTicker(emit, tickMs);
  try {
    return await work();
  } finally {
    stop();
  }
}

export class BootProgress {
  /**
   * @param {HTMLElement} parent  typically `#app`
   */
  constructor(parent) {
    if (!parent) throw new Error('BootProgress requires a parent element');

    this.root = document.createElement('div');
    this.root.id = 'boot-progress';
    this.root.className = 'boot-progress is-hidden';
    this.root.setAttribute('hidden', '');
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');
    this.root.setAttribute('aria-busy', 'false');
    this.root.style.display = 'none';

    const card = document.createElement('div');
    card.className = 'boot-progress__card';

    const title = document.createElement('div');
    title.className = 'boot-progress__title';
    title.textContent = 'VHectorLab 3D';

    this.labelEl = document.createElement('div');
    this.labelEl.className = 'boot-progress__label';
    this.labelEl.id = 'boot-progress-label';

    this.barEl = document.createElement('div');
    this.barEl.className = 'boot-progress__bar';
    this.barEl.id = 'boot-progress-bar';
    this.barEl.setAttribute('aria-hidden', 'true');

    this.fillEl = document.createElement('div');
    this.fillEl.className = 'boot-progress__fill';
    this.fillEl.id = 'boot-progress-fill';

    this.barEl.appendChild(this.fillEl);
    card.appendChild(title);
    card.appendChild(this.labelEl);
    card.appendChild(this.barEl);
    this.root.appendChild(card);
    parent.appendChild(this.root);
  }

  /**
   * @param {{
   *   statusText?: string,
   *   step?: number,
   *   total?: number,
   *   label?: string,
   *   ratio?: number,
   *   indeterminate?: boolean,
   * }|null|undefined} progress
   */
  set(progress) {
    if (!progress) {
      this.clear();
      return;
    }
    const label = formatBootProgressLabel(progress);
    const { pct, indeterminate } = resolveBootProgressBar(progress);

    this.root.removeAttribute('hidden');
    this.root.classList.remove('is-hidden');
    this.root.style.display = 'flex';
    this.root.setAttribute('aria-busy', 'true');
    this.labelEl.textContent = label;
    this.barEl.classList.toggle('is-indeterminate', indeterminate);
    this.fillEl.style.width = indeterminate ? '' : `${pct}%`;
    this.root.setAttribute('aria-valuenow', String(indeterminate ? 0 : pct));
    this.root.setAttribute('aria-valuemin', '0');
    this.root.setAttribute('aria-valuemax', '100');
  }

  clear() {
    this.root.setAttribute('hidden', '');
    this.root.classList.add('is-hidden');
    this.root.style.display = 'none';
    this.root.setAttribute('aria-busy', 'false');
    this.labelEl.textContent = '';
    this.barEl.classList.remove('is-indeterminate');
    this.fillEl.style.width = '0%';
  }

  dispose() {
    this.clear();
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
  }
}
