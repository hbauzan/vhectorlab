/**
 * Left Sidebar Control Panel component for A - B + C Vector Arithmetic operations.
 */
export class Sidebar {
  constructor(containerElement, onCalculateCallback) {
    this.container = containerElement || document.body;
    this.onCalculate = onCalculateCallback;

    this.element = document.createElement('div');
    this.element.id = 'sidebar-panel';
    this.element.className = 'glass-sidebar';
    this.element.innerHTML = `
      <div class="sidebar-header">
        <h2>⚡ VECTOR ARITHMETIC</h2>
        <span class="sidebar-subtitle">Semantic Embedding Space ($A - B + C$)</span>
      </div>

      <form id="arithmetic-form" class="sidebar-form">
        <div class="input-group positive">
          <label for="word-a"><span class="op">+</span> Base Word A</label>
          <input type="text" id="word-a" value="king" required autocomplete="off" />
        </div>

        <div class="input-group negative">
          <label for="word-b"><span class="op">-</span> Subtract Word B</label>
          <input type="text" id="word-b" value="man" required autocomplete="off" />
        </div>

        <div class="input-group positive">
          <label for="word-c"><span class="op">+</span> Add Word C</label>
          <input type="text" id="word-c" value="woman" required autocomplete="off" />
        </div>

        <button type="submit" id="btn-calculate" class="btn-primary">
          ⚡ CALCULAR VECTOR
        </button>
      </form>

      <div class="results-container">
        <h3>NEAREST COSINE RESULTS (TOP-10)</h3>
        <ul id="results-list" class="results-list">
          <li class="empty-state">Run calculation to explore 3D semantic neighbors...</li>
        </ul>
      </div>
    `;

    this.container.appendChild(this.element);

    this.form = this.element.querySelector('#arithmetic-form');
    this.resultsList = this.element.querySelector('#results-list');
    this.btnCalculate = this.element.querySelector('#btn-calculate');

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

  setLoading(loading) {
    if (loading) {
      this.btnCalculate.disabled = true;
      this.btnCalculate.textContent = '⏳ COMPUTING EMBEDDINGS...';
    } else {
      this.btnCalculate.disabled = false;
      this.btnCalculate.textContent = '⚡ CALCULAR VECTOR';
    }
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
