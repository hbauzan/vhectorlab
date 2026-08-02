/**
 * Left Sidebar Control Panel component for COMPARE Mode token sequences (1 to 1024 tokens).
 */
export class ComparePanel {
  constructor(containerElement, onCalculateCallback) {
    this.container = containerElement || document.body;
    this.onCalculate = onCalculateCallback;

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

      <div class="results-container">
        <h3>ACTIVE SEQUENCE METRICS</h3>
        <div id="compare-metrics" class="compare-metrics-box">
          <span class="metric-item">Loaded Tokens: <strong id="token-count-val">0</strong></span>
        </div>
      </div>
    `;

    this.container.appendChild(this.element);

    this.form = this.element.querySelector('#compare-form');
    this.textarea = this.element.querySelector('#compare-tokens');
    this.btnSubmit = this.element.querySelector('#btn-compare-submit');
    this.tokenCountVal = this.element.querySelector('#token-count-val');

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

  show() {
    this.element.classList.remove('hidden');
  }

  hide() {
    this.element.classList.add('hidden');
  }
}
