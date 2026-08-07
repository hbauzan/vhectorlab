/**
 * VHectorLab-3D v25 left Arithmetic chrome — form + Top-10 host (no API wire yet).
 * Scroll contract reuses legacy `ARITHMETIC_TOP10_SCROLL` formulas (lessons §4.1).
 */
import { ARITHMETIC_TOP10_SCROLL } from '../../ui/arithmeticResultsScroll.js';

export const ARITHMETIC_DEFAULTS = Object.freeze({
  wordA: 'king',
  wordB: 'man',
  wordC: 'woman',
  topK: 10,
});

export const ARITHMETIC_COPY = Object.freeze({
  title: 'VECTOR ARITHMETIC',
  subtitle: 'Semantic embedding space (A − B + C)',
  wordA: '+ Base Word A',
  wordB: '− Subtract Word B',
  wordC: '+ Add Word C',
  calculate: 'CALCULATE VECTOR',
  calculating: 'CALCULATING…',
  resultsTitle: 'NEAREST COSINE RESULTS (TOP-10)',
  empty: 'Run calculation to explore 3D semantic neighbors…',
});

/**
 * CSS max-height expressions for the v25 Top-10 list (same floors/caps as legado).
 */
export const V25_ARITHMETIC_SCROLL = Object.freeze({
  panelSelector: '#lab-arithmetic-panel',
  listSelector: '#lab-arithmetic-panel .lab-results-list',
  desktopMaxHeight: ARITHMETIC_TOP10_SCROLL.desktopMaxHeight,
  mobileMaxHeight: ARITHMETIC_TOP10_SCROLL.mobileMaxHeight,
  shortPanelScrollMq: ARITHMETIC_TOP10_SCROLL.shortPanelScrollMq,
});

/**
 * @returns {string}
 */
export function arithmeticPanelMarkup() {
  const d = ARITHMETIC_DEFAULTS;
  const c = ARITHMETIC_COPY;
  return `
    <div id="lab-arithmetic-panel" class="lab-arithmetic" data-chrome="arithmetic">
      <header class="lab-arithmetic__header">
        <h2 class="lab-arithmetic__title">${c.title}</h2>
        <p class="lab-arithmetic__subtitle lab-muted">${c.subtitle}</p>
      </header>

      <form id="lab-arithmetic-form" class="lab-arithmetic__form">
        <div class="lab-field">
          <label class="lab-field__label" for="lab-word-a">${c.wordA}</label>
          <input class="lab-field__input" type="text" id="lab-word-a" name="wordA" value="${d.wordA}" required autocomplete="off" />
        </div>
        <div class="lab-field">
          <label class="lab-field__label" for="lab-word-b">${c.wordB}</label>
          <input class="lab-field__input" type="text" id="lab-word-b" name="wordB" value="${d.wordB}" required autocomplete="off" />
        </div>
        <div class="lab-field">
          <label class="lab-field__label" for="lab-word-c">${c.wordC}</label>
          <input class="lab-field__input" type="text" id="lab-word-c" name="wordC" value="${d.wordC}" required autocomplete="off" />
        </div>
        <button type="submit" id="lab-btn-calculate" class="lab-btn lab-btn--primary lab-arithmetic__submit">
          ${c.calculate}
        </button>
      </form>

      <div class="lab-arithmetic__results">
        <h3 class="lab-arithmetic__results-title">${c.resultsTitle}</h3>
        <ul id="lab-results-list" class="lab-results-list" aria-live="polite">
          <li class="lab-results-list__empty lab-muted">${c.empty}</li>
        </ul>
      </div>
    </div>
  `.trim();
}

/**
 * @param {HTMLElement} container
 * @param {{ onCalculate?: (words: { wordA: string, wordB: string, wordC: string, topK: number }) => void | Promise<void> }} [options]
 */
export function mountArithmeticPanel(container, options = {}) {
  if (!container) throw new Error('mountArithmeticPanel requires a container');
  container.innerHTML = arithmeticPanelMarkup();

  const form = container.querySelector('#lab-arithmetic-form');
  const btn = container.querySelector('#lab-btn-calculate');
  const onCalculate = typeof options.onCalculate === 'function' ? options.onCalculate : null;

  const setLoading = (loading) => {
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? ARITHMETIC_COPY.calculating : ARITHMETIC_COPY.calculate;
  };

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const wordA = container.querySelector('#lab-word-a')?.value.trim() || '';
    const wordB = container.querySelector('#lab-word-b')?.value.trim() || '';
    const wordC = container.querySelector('#lab-word-c')?.value.trim() || '';
    if (!onCalculate) return;
    setLoading(true);
    Promise.resolve(
      onCalculate({ wordA, wordB, wordC, topK: ARITHMETIC_DEFAULTS.topK }),
    ).finally(() => setLoading(false));
  });

  return {
    getValues() {
      return {
        wordA: container.querySelector('#lab-word-a')?.value.trim() || '',
        wordB: container.querySelector('#lab-word-b')?.value.trim() || '',
        wordC: container.querySelector('#lab-word-c')?.value.trim() || '',
        topK: ARITHMETIC_DEFAULTS.topK,
      };
    },
    setLoading,
  };
}
