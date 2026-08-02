/**
 * Top Navbar component with title, status indicator, View Mode tabs (ANÁLISIS | NAVEGACIÓN), and Render Mode selector tabs (POINTS | MESH | RIBBONS).
 */
export class Navbar {
  constructor(containerElement, onRenderModeChangeCallback, onViewModeChangeCallback, onWorkspaceModeChangeCallback) {
    this.container = containerElement || document.body;
    this.onRenderModeChange = onRenderModeChangeCallback;
    this.onViewModeChange = onViewModeChangeCallback;
    this.onWorkspaceModeChange = onWorkspaceModeChangeCallback;

    this.element = document.createElement('header');
    this.element.id = 'top-navbar';
    this.element.className = 'glass-navbar';
    this.element.innerHTML = `
      <div class="navbar-brand">
        <div class="logo-icon">🌐</div>
        <div class="title-group">
          <h1>VECTORLAB <span class="accent-3d">3D</span></h1>
          <span class="version-tag">v1.4.0</span>
        </div>
      </div>

      <div class="navbar-center-controls">
        <div class="workspace-mode-tabs">
          <span class="tab-label">MODE:</span>
          <button data-workspace="ARITHMETIC" class="workspace-tab active">ARITHMETIC</button>
          <button data-workspace="COMPARE" class="workspace-tab">COMPARE</button>
        </div>

        <div class="view-mode-tabs">
          <span class="tab-label">VISTA:</span>
          <button data-view="ANALYSIS" class="view-tab">ANÁLISIS</button>
          <button data-view="NAVIGATION" class="view-tab active">NAVEGACIÓN</button>
        </div>

        <div class="render-mode-tabs">
          <span class="tab-label">RENDER:</span>
          <button data-mode="POINTS" class="mode-tab active">POINTS</button>
          <button data-mode="MESH" class="mode-tab">MESH</button>
          <button data-mode="RIBBONS" class="mode-tab">RIBBONS</button>
        </div>
      </div>

      <div class="status-indicator">
        <span id="backend-status-dot" class="status-dot offline"></span>
        <span id="backend-status-text" class="status-text">OFFLINE</span>
      </div>
    `;

    this.container.appendChild(this.element);

    this.renderTabs = this.element.querySelectorAll('.mode-tab');
    this.viewTabs = this.element.querySelectorAll('.view-tab');
    this.workspaceTabs = this.element.querySelectorAll('.workspace-tab');
    this.statusDot = this.element.querySelector('#backend-status-dot');
    this.statusText = this.element.querySelector('#backend-status-text');

    this.initEventListeners();
  }

  initEventListeners() {
    this.workspaceTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const mode = e.target.getAttribute('data-workspace');
        this.workspaceTabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');

        if (this.onWorkspaceModeChange) {
          this.onWorkspaceModeChange(mode);
        }
      });
    });

    this.renderTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const mode = e.target.getAttribute('data-mode');
        this.renderTabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');

        if (this.onRenderModeChange) {
          this.onRenderModeChange(mode);
        }
      });
    });

    this.viewTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const view = e.target.getAttribute('data-view');
        this.viewTabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');

        if (this.onViewModeChange) {
          this.onViewModeChange(view);
        }
      });
    });
  }

  setViewMode(viewMode) {
    this.viewTabs.forEach(t => {
      if (t.getAttribute('data-view') === viewMode) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });
  }

  setWorkspaceMode(workspaceMode) {
    this.workspaceTabs.forEach(t => {
      if (t.getAttribute('data-workspace') === workspaceMode) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
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
