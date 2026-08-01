/**
 * Top Navbar component with title, status indicator, and Render Mode selector tabs (MESH | POINTS | RIBBONS).
 */
export class Navbar {
  constructor(containerElement, onRenderModeChangeCallback) {
    this.container = containerElement || document.body;
    this.onRenderModeChange = onRenderModeChangeCallback;

    this.element = document.createElement('header');
    this.element.id = 'top-navbar';
    this.element.className = 'glass-navbar';
    this.element.innerHTML = `
      <div class="navbar-brand">
        <div class="logo-icon">🌐</div>
        <div class="title-group">
          <h1>VECTORLAB <span class="accent-3d">3D</span></h1>
          <span class="version-tag">v0.1.0</span>
        </div>
      </div>

      <div class="render-mode-tabs">
        <span class="tab-label">RENDER:</span>
        <button data-mode="POINTS" class="mode-tab active">POINTS</button>
        <button data-mode="MESH" class="mode-tab">MESH</button>
        <button data-mode="RIBBONS" class="mode-tab">RIBBONS</button>
      </div>

      <div class="status-indicator">
        <span id="backend-status-dot" class="status-dot offline"></span>
        <span id="backend-status-text" class="status-text">OFFLINE</span>
      </div>
    `;

    this.container.appendChild(this.element);

    this.tabs = this.element.querySelectorAll('.mode-tab');
    this.statusDot = this.element.querySelector('#backend-status-dot');
    this.statusText = this.element.querySelector('#backend-status-text');

    this.initEventListeners();
  }

  initEventListeners() {
    this.tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const mode = e.target.getAttribute('data-mode');
        this.tabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');

        if (this.onRenderModeChange) {
          this.onRenderModeChange(mode);
        }
      });
    });
  }

  setStatus(online, modelName = '') {
    if (online) {
      this.statusDot.className = 'status-dot online';
      this.statusText.textContent = modelName ? `ONLINE (${modelName})` : 'ONLINE';
    } else {
      this.statusDot.className = 'status-dot offline';
      this.statusText.textContent = 'OFFLINE';
    }
  }
}
