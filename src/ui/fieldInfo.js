/**
 * Compact field-info tips ("i") for editable controls.
 * Tap/click opens a short English tip (mobile-friendly; not hover-only title).
 */

/** Soft cap so tips stay readable on phone panels. */
export const MAX_FIELD_INFO_LEN = 28;

/**
 * Short EN help for every user-editable value/field.
 * Keep copy ≤ MAX_FIELD_INFO_LEN.
 */
export const FIELD_INFO = Object.freeze({
  wordA: 'Base term (+).',
  wordB: 'Subtract this.',
  wordC: 'Add this.',
  compareTokens: 'Words or GROUP_x = list.',
  dimSort: 'Order X by group Δ.',
  saeToggle: 'Paint SAE activations.',
  saeHidden: 'Max latent width.',
  saeK: 'Keep top-K features.',
  saeEpochs: 'Train passes.',
  saeLr: 'Step size.',
  saeBatch: 'Batch size.',
  spacingX: 'Gap between threads.',
  vectorDistY: 'Stack spacing.',
  amplitudeY: 'Peak height.',
  lengthZ: 'Thread depth.',
  thickness: 'Point size.',
  vizFilter: 'Which signs show.',
  colorPos: 'Color at +1.',
  colorZero: 'Color at 0.',
  colorNeg: 'Color at −1.',
  zeroCoverage: 'Hold range at zero.',
  zeroCoverageAmount: '30%…99.9999% band.',
  labelsToggle: 'Floating names.',
  groupContrast: 'Groups only (G1↔G2).',
  sameSignCancel: 'Blacken same-sign dims.',
  sameSignCoverage: '30%…99.9999% sim.',
  oppositeHighlight: 'Mark opposite signs.',
  oppositeColor: 'Conflict color.',
  oppositeStrength: 'Highlight × |Δ|.',
  oppositeCancel: 'Fade conflicts black.',
  groupHue: 'Per group: black (−1) → color (+1).',
  groupHueSwatch: 'This group’s +1 color.',
  dimRuler: 'Cross-token links at each dim.',
  dimRulerColor: 'Ruler stroke color.',
  dimRulerThickness: 'Ruler strip width.',
  dimRulerCursor: 'Jump to dim, then + / −.',
  dimRulerLink: 'Path = token→token; Span = min↔max Y.',
});

/**
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtmlAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Inline "i" button markup for a label row.
 * @param {string} text
 * @returns {string}
 */
export function infoTipMarkup(text) {
  const t = String(text ?? '').trim();
  if (!t) return '';
  return (
    `<button type="button" class="field-info-btn" aria-label="Info" ` +
    `aria-expanded="false" data-field-info="${escapeHtmlAttr(t)}">i</button>`
  );
}

/**
 * Pure click resolver for one-tip-at-a-time UX.
 * @param {unknown} openBtn currently open trigger (or null)
 * @param {unknown} clickedBtn info button clicked, or null for outside
 * @returns {{ action: 'open'|'close'|'noop', button?: unknown }}
 */
export function resolveFieldInfoClick(openBtn, clickedBtn) {
  if (clickedBtn) {
    if (openBtn === clickedBtn) return { action: 'close' };
    return { action: 'open', button: clickedBtn };
  }
  if (openBtn) return { action: 'close' };
  return { action: 'noop' };
}

/**
 * Position tip near the trigger; clamp to viewport (phone-safe).
 * @param {HTMLElement} btn
 * @param {HTMLElement} tip
 */
function positionTip(btn, tip) {
  const pad = 8;
  const r = btn.getBoundingClientRect();
  tip.style.visibility = 'hidden';
  tip.style.left = '0px';
  tip.style.top = '0px';
  const tw = tip.offsetWidth || 160;
  const th = tip.offsetHeight || 40;
  let left = r.left + r.width / 2 - tw / 2;
  let top = r.bottom + 6;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 360;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 640;
  left = Math.max(pad, Math.min(left, vw - tw - pad));
  if (top + th > vh - pad) {
    top = r.top - th - 6;
  }
  tip.style.left = `${left}px`;
  tip.style.top = `${Math.max(pad, top)}px`;
  tip.style.visibility = 'visible';
}

/**
 * Event-delegated tips for all `.field-info-btn` under root.
 * One tip open at a time; outside click / Escape closes.
 *
 * @param {ParentNode} [root=document]
 * @returns {{ close: () => void, getOpenButton: () => HTMLElement|null }}
 */
export function wireFieldInfo(root = document) {
  /** @type {HTMLElement|null} */
  let tipEl = null;
  /** @type {HTMLElement|null} */
  let openBtn = null;

  const close = () => {
    if (tipEl && tipEl.parentNode) tipEl.parentNode.removeChild(tipEl);
    tipEl = null;
    if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
    openBtn = null;
  };

  /**
   * @param {HTMLElement} btn
   */
  const open = (btn) => {
    close();
    const text = btn.getAttribute('data-field-info') || '';
    if (!text) return;
    tipEl = document.createElement('div');
    tipEl.className = 'field-info-tip';
    tipEl.setAttribute('role', 'tooltip');
    tipEl.textContent = text;
    document.body.appendChild(tipEl);
    openBtn = btn;
    btn.setAttribute('aria-expanded', 'true');
    positionTip(btn, tipEl);
  };

  /**
   * @param {Event} e
   */
  const onClick = (e) => {
    const target = e.target;
    if (!target || typeof target.closest !== 'function') return;
    if (target.closest('.field-info-tip')) return;

    const btn = target.closest('.field-info-btn');
    const inRoot = !!(btn && (root === document || (root.contains && root.contains(btn))));
    const decision = resolveFieldInfoClick(openBtn, inRoot ? btn : null);

    if (decision.action === 'open') {
      e.preventDefault();
      e.stopPropagation();
      open(/** @type {HTMLElement} */ (decision.button));
      return;
    }
    if (decision.action === 'close') {
      if (inRoot) {
        e.preventDefault();
        e.stopPropagation();
      }
      close();
    }
  };

  /**
   * @param {KeyboardEvent} e
   */
  const onKeydown = (e) => {
    if (e.key === 'Escape') close();
  };

  root.addEventListener('click', onClick);
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeydown);
  }

  return {
    close,
    getOpenButton: () => openBtn,
    /** @internal test/teardown */
    destroy() {
      close();
      root.removeEventListener('click', onClick);
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', onKeydown);
      }
    },
  };
}
