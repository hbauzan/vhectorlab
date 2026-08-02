import { reorderCompareItems } from './compareCosine.js';

/**
 * Left Sidebar Control Panel component for COMPARE Mode token sequences (1 to 1024 tokens).
 */
export class ComparePanel {
  constructor(containerElement, onCalculateCallback, onReorderCallback = null) {
    this.container = containerElement || document.body;
    this.onCalculate = onCalculateCallback;
    this.onReorder = onReorderCallback;

    /** @type {Array|null} */
    this.items = null;
    this.reorderLocked = false;

    this.element = document.createElement('div');
    this.element.id = 'compare-panel';
    this.element.className = 'glass-sidebar hidden';
    this.element.innerHTML = `
      <div class="sidebar-header">
        <h2>🔍 TOKEN COMPARISON</h2>
        <span class="sidebar-subtitle">Multi-sequence Vector Space (1–1024 Tokens)</span>
      </div>

      <form id="compare-form" class="sidebar-form">
        <div class="input-group">
          <label for="compare-tokens">Tokens / Words (separated by comma, space, or newline)</label>
          <textarea id="compare-tokens" rows="6" placeholder="Enter words/tokens e.g. king, queen, man, woman, apple, orange..." required></textarea>
        </div>

        <div class="preset-buttons-row">
          <button type="button" class="btn-preset" data-preset="sample5">5 Tokens</button>
          <button type="button" class="btn-preset" data-preset="sample20">20 Tokens</button>
          <button type="button" class="btn-preset" data-preset="sample50">50 Tokens</button>
        </div>

        <button type="submit" id="btn-compare-submit" class="btn-primary">
          🔍 VISUALIZAR SECUENCIA (3D)
        </button>
      </form>

      <div class="results-container compare-results">
        <h3>ACTIVE SEQUENCE METRICS</h3>
        <div id="compare-metrics" class="compare-metrics-box">
          <span class="metric-item">Loaded Tokens: <strong id="token-count-val">0</strong></span>
        </div>

        <h3 id="compare-cosine-subtitle" class="compare-cosine-subtitle">SIMILITUD COSENO vs — (1.er token)</h3>
        <ul id="compare-cosine-list" class="compare-cosine-list">
          <li class="empty-state">Visualizá una secuencia para ver similitud vs el 1.er token...</li>
        </ul>
      </div>
    `;

    this.container.appendChild(this.element);

    this.form = this.element.querySelector('#compare-form');
    this.textarea = this.element.querySelector('#compare-tokens');
    this.btnSubmit = this.element.querySelector('#btn-compare-submit');
    this.tokenCountVal = this.element.querySelector('#token-count-val');
    this.cosineSubtitle = this.element.querySelector('#compare-cosine-subtitle');
    this.cosineList = this.element.querySelector('#compare-cosine-list');

    // Default sample values
    this.textarea.value = "king, queen, man, woman, prince, princess, emperor, empress, royalty, monarch";

    this.initEventListeners();
  }

  initEventListeners() {
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const rawText = this.textarea.value;
      const tokens = rawText
        .split(/[\s,\n]+/)
        .map(t => t.trim())
        .filter(t => t.length > 0)
        .slice(0, 1024);

      if (tokens.length === 0) return;

      if (this.onCalculate) {
        this.setLoading(true);
        this.onCalculate(tokens)
          .finally(() => this.setLoading(false));
      }
    });

    this.element.querySelectorAll('.btn-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.target.getAttribute('data-preset');
        if (type === 'sample5') {
          this.textarea.value = "king, queen, man, woman, child";
        } else if (type === 'sample20') {
          this.textarea.value = "king, queen, man, woman, prince, princess, emperor, empress, royalty, monarch, lord, lady, knight, castle, crown, throne, empire, kingdom, palace, scepter";
        } else if (type === 'sample50') {
          const sample = [];
          const baseWords = ["vector", "tensor", "matrix", "linear", "space", "dimension", "gradient", "loss", "model", "token"];
          for (let i = 0; i < 50; i++) {
            sample.push(`${baseWords[i % baseWords.length]}_${Math.floor(i / baseWords.length) + 1}`);
          }
          this.textarea.value = sample.join(", ");
        }
      });
    });

    // Arrow reorder only — rows themselves do not focus the 3D camera
    this.cosineList.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-reorder');
      if (!btn || this.reorderLocked) return;
      e.preventDefault();
      e.stopPropagation();

      const index = Number(btn.getAttribute('data-index'));
      const delta = btn.getAttribute('data-dir') === 'up' ? -1 : 1;
      this.handleReorder(index, delta);
    });
  }

  handleReorder(fromIndex, delta) {
    if (!this.items || this.reorderLocked) return;
    const result = reorderCompareItems(this.items, fromIndex, delta);
    if (!result) return;

    this.items = result.items;
    this.renderCosineList(result.anchor, result.items);

    if (this.onReorder) {
      this.setReorderLocked(true);
      Promise.resolve(this.onReorder(result))
        .catch(() => {})
        .finally(() => this.setReorderLocked(false));
    }
  }

  setReorderLocked(locked) {
    this.reorderLocked = locked;
    this.cosineList.querySelectorAll('.btn-reorder').forEach((btn) => {
      if (locked) {
        btn.disabled = true;
      } else {
        const index = Number(btn.getAttribute('data-index'));
        const dir = btn.getAttribute('data-dir');
        const n = this.items ? this.items.length : 0;
        btn.disabled = (dir === 'up' && index === 0) || (dir === 'down' && index === n - 1);
      }
    });
  }

  setLoading(loading) {
    if (loading) {
      this.btnSubmit.disabled = true;
      this.btnSubmit.textContent = '⏳ COMPUTING SEQUENCE EMBEDDINGS...';
    } else {
      this.btnSubmit.disabled = false;
      this.btnSubmit.textContent = '🔍 VISUALIZAR SECUENCIA (3D)';
    }
  }

  updateMetrics(count) {
    if (this.tokenCountVal) {
      this.tokenCountVal.textContent = count;
    }
  }

  /**
   * Populate metrics + cosine-vs-anchor list from /compare response (or reordered payload).
   * @param {{ count: number, anchor?: { text: string }, items: Array }} data
   */
  updateCompareResults(data) {
    if (!data || !data.items) {
      this.items = null;
      this.updateMetrics(0);
      this.cosineSubtitle.textContent = 'SIMILITUD COSENO vs — (1.er token)';
      this.cosineList.innerHTML = '<li class="empty-state">Visualizá una secuencia para ver similitud vs el 1.er token...</li>';
      return;
    }

    this.items = data.items.slice();
    this.updateMetrics(data.count);
    const anchor = data.anchor || (data.items[0] ? { index: 0, text: data.items[0].text } : null);
    this.renderCosineList(anchor, data.items);
  }

  renderCosineList(anchor, items) {
    const anchorWord = anchor?.text ?? items[0]?.text ?? '—';
    this.cosineSubtitle.textContent = `SIMILITUD COSENO vs «${anchorWord}» (1.er token)`;

    this.cosineList.innerHTML = '';
    if (!items || items.length === 0) {
      this.cosineList.innerHTML = '<li class="empty-state">No tokens loaded</li>';
      return;
    }

    items.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'compare-cosine-item';
      li.setAttribute('data-id', item.id || `tok_${index}`);

      const score = index === 0
        ? 1
        : (typeof item.cosine_vs_first === 'number' ? item.cosine_vs_first : 0);

      const refBadge = index === 0 ? '<span class="badge-ref">REF</span>' : '';
      li.innerHTML = `
        <span class="rank">#${index + 1}</span>
        <span class="word">${item.text}</span>
        ${refBadge}
        <span class="score">${score.toFixed(4)}</span>
        <span class="reorder-btns">
          <button type="button" class="btn-reorder" data-dir="up" data-index="${index}" ${index === 0 || this.reorderLocked ? 'disabled' : ''} aria-label="Move up">▲</button>
          <button type="button" class="btn-reorder" data-dir="down" data-index="${index}" ${index === items.length - 1 || this.reorderLocked ? 'disabled' : ''} aria-label="Move down">▼</button>
        </span>
      `;
      this.cosineList.appendChild(li);
    });
  }

  show() {
    this.element.classList.remove('hidden');
  }

  hide() {
    this.element.classList.add('hidden');
  }
}
