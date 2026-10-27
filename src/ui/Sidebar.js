import {
  AMIGA_WINDOW_TITLES,
  amigaWindowTitlebarMarkup,
  collapseNearestDock,
  wireAmigaWindowClose,
} from './amigaWindow.js';
import { FIELD_INFO, infoTipMarkup } from './fieldInfo.js';

/**
 * Left Sidebar Control Panel component for A - B + C Vector Arithmetic operations.
 */
export class Sidebar {
  /**
   * @param {HTMLElement} containerElement
   * @param {(wordA: string, wordB: string, wordC: string, topK: number) => Promise<void>} onCalculateCallback
   * @param {{ onCollapse?: () => void }} [options]
   */
  constructor(containerElement, onCalculateCallback, options = {}) {
    this.container = containerElement || document.body;
    this.onCalculate = onCalculateCallback;
    this.onCollapse = typeof options.onCollapse === 'function' ? options.onCollapse : null;

    this.element = document.createElement('div');
    this.element.id = 'sidebar-panel';
    this.element.className = 'glass-sidebar amiga-window';
    this.element.innerHTML = `
      ${amigaWindowTitlebarMarkup(AMIGA_WINDOW_TITLES.arithmetic)}
      <div class="amiga-window-client">
      <span class="sidebar-subtitle">Semantic Embedding Space ($A - B + C$)</span>

      <form id="arithmetic-form" class="sidebar-form">
        <div class="input-group positive">
          <label for="word-a"><span class="field-label-text"><span class="op">+</span> Base Word A</span>${infoTipMarkup(FIELD_INFO.wordA)}</label>
          <input type="text" id="word-a" value="king" required autocomplete="off" />
        </div>

        <div class="input-group negative">
          <label for="word-b"><span class="field-label-text"><span class="op">-</span> Subtract Word B</span>${infoTipMarkup(FIELD_INFO.wordB)}</label>
          <input type="text" id="word-b" value="man" required autocomplete="off" />
        </div>

        <div class="input-group positive">
          <label for="word-c"><span class="field-label-text"><span class="op">+</span> Add Word C</span>${infoTipMarkup(FIELD_INFO.wordC)}</label>
          <input type="text" id="word-c" value="woman" required autocomplete="off" />
        </div>

        <button type="submit" id="btn-calculate" class="btn-primary">
          ⚡ CALCULATE VECTOR
        </button>
      </form>

      <div class="results-container">
        <h3>NEAREST COSINE RESULTS (TOP-10)</h3>
        <ul id="results-list" class="results-list">
          <li class="empty-state">Run calculation to explore 3D semantic neighbors...</li>
        </ul>
      </div>
      </div>
    `;

    this.container.appendChild(this.element);

    wireAmigaWindowClose(this.element, () => {
      if (typeof this.onCollapse === 'function') this.onCollapse();
      else collapseNearestDock(this.element);
    });

    this.form = this.element.querySelector('#arithmetic-form');
    this.btnCalculate = this.element.querySelector('#btn-calculate');
    this.resultsList = this.element.querySelector('#results-list');

    this.initEventListeners();
  }

  initEventListeners() {
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const wordA = this.element.querySelector('#word-a').value.trim();
      const wordB = this.element.querySelector('#word-b').value.trim();
      const wordC = this.element.querySelector('#word-c').value.trim();
      const topK = 10;

      if (this.onCalculate) {
        this.setLoading(true);
        this.onCalculate(wordA, wordB, wordC, topK)
          .finally(() => this.setLoading(false));
      }
    });
  }

  setInputs(wordA, wordB, wordC) {
    const a = this.element.querySelector('#word-a');
    const b = this.element.querySelector('#word-b');
    const c = this.element.querySelector('#word-c');
    if (a) a.value = wordA ?? '';
    if (b) b.value = wordB ?? '';
    if (c) c.value = wordC ?? '';
  }

  setLoading(loading) {
    this.btnCalculate.disabled = loading;
    this.btnCalculate.textContent = loading
      ? '⏳ COMPUTING EMBEDDINGS...'
      : '⚡ CALCULATE VECTOR';
  }

  updateResults(results) {
    this.resultsList.innerHTML = '';

    if (!results || results.length === 0) {
      this.resultsList.innerHTML = '<li class="empty-state">No semantic matches found</li>';
      return;
    }

    results.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'result-item';
      li.innerHTML = `
        <span class="rank">#${index + 1}</span>
        <span class="word">${item.word}</span>
        <span class="score">${item.score.toFixed(4)}</span>
      `;
      this.resultsList.appendChild(li);
    });
  }
}
