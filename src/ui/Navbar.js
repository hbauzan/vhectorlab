/**
 * Top Navbar component with title, status indicator, View Mode tabs (ANALYSIS | NAVIGATION), and Render Mode selector tabs (POINTS | RIBBONS).
 * Mobile: overflow tab strip gets ◀ ▶ scroll arrows.
 */
import { getTabsScrollState, nextTabsScrollLeft } from './navbarTabsScroll.js';
import {
  DEFAULT_RENDER_MODE,
  DEFAULT_VIEW_MODE,
  DEFAULT_WORKSPACE_MODE,
} from './appViewDefaults.js';

export class Navbar {
  constructor(containerElement, onRenderModeChangeCallback, onViewModeChangeCallback, onWorkspaceModeChangeCallback) {
    this.container = containerElement || document.body;
    this.onRenderModeChange = onRenderModeChangeCallback;
    this.onViewModeChange = onViewModeChangeCallback;
    this.onWorkspaceModeChange = onWorkspaceModeChangeCallback;

    const workspaceActive = (mode) => (mode === DEFAULT_WORKSPACE_MODE ? ' active' : '');
    const viewActive = (mode) => (mode === DEFAULT_VIEW_MODE ? ' active' : '');
    const renderActive = (mode) => (mode === DEFAULT_RENDER_MODE ? ' active' : '');

    this.element = document.createElement('header');
    this.element.id = 'top-navbar';
    this.element.className = 'glass-navbar';
    this.element.innerHTML = `
      <div class="navbar-brand">
        <div class="logo-icon">🌐</div>
        <div class="title-group">
          <h1>VHectorLab <span class="accent-3d">3D</span></h1>
          <span class="version-tag">v2.2.0</span>
        </div>
      </div>

      <div class="navbar-tabs-scroller">
        <button type="button" class="navbar-tabs-arrow navbar-tabs-prev" aria-label="Scroll tabs left" title="Previous">◀</button>
        <div class="navbar-center-controls">
          <div class="workspace-mode-tabs">
            <span class="tab-label">MODE:</span>
            <button data-workspace="ARITHMETIC" class="workspace-tab${workspaceActive('ARITHMETIC')}">ARITHMETIC</button>
            <button data-workspace="COMPARE" class="workspace-tab${workspaceActive('COMPARE')}">COMPARE</button>
          </div>

          <div class="view-mode-tabs">
            <span class="tab-label">VIEW:</span>
            <button data-view="ANALYSIS" class="view-tab${viewActive('ANALYSIS')}">ANALYSIS</button>
            <button data-view="NAVIGATION" class="view-tab${viewActive('NAVIGATION')}">NAVIGATION</button>
          </div>

          <div class="render-mode-tabs">
            <span class="tab-label">RENDER:</span>
            <button data-mode="POINTS" class="mode-tab${renderActive('POINTS')}">POINTS</button>
            <button data-mode="RIBBONS" class="mode-tab${renderActive('RIBBONS')}">RIBBONS</button>
          </div>
        </div>
        <button type="button" class="navbar-tabs-arrow navbar-tabs-next" aria-label="Scroll tabs right" title="Next">▶</button>
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
    this.tabsTrack = this.element.querySelector('.navbar-center-controls');
    this.tabsPrev = this.element.querySelector('.navbar-tabs-prev');
    this.tabsNext = this.element.querySelector('.navbar-tabs-next');
    this.tabsScroller = this.element.querySelector('.navbar-tabs-scroller');

    this.initEventListeners();
    this.initTabsScroll();
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

  initTabsScroll() {
    if (!this.tabsTrack || !this.tabsPrev || !this.tabsNext || !this.tabsScroller) return;

    const sync = () => this.syncTabsScrollArrows();
    this.tabsTrack.addEventListener('scroll', sync, { passive: true });

    this.tabsPrev.addEventListener('click', (e) => {
      e.preventDefault();
      this.scrollTabs(-1);
    });
    this.tabsNext.addEventListener('click', (e) => {
      e.preventDefault();
      this.scrollTabs(1);
    });

    if (typeof ResizeObserver !== 'undefined') {
      this._tabsResizeObserver = new ResizeObserver(sync);
      this._tabsResizeObserver.observe(this.tabsTrack);
      this._tabsResizeObserver.observe(this.tabsScroller);
    }

    // Layout may settle after fonts / first paint
    requestAnimationFrame(sync);
    window.addEventListener('resize', sync);
    this._tabsResizeHandler = sync;
  }

  scrollTabs(direction) {
    const track = this.tabsTrack;
    if (!track) return;
    const next = nextTabsScrollLeft(
      track.scrollLeft,
      track.clientWidth,
      track.scrollWidth,
      direction,
    );
    if (typeof track.scrollTo === 'function') {
      track.scrollTo({ left: next, behavior: 'smooth' });
    } else {
      track.scrollLeft = next;
    }
    this.syncTabsScrollArrows();
  }

  syncTabsScrollArrows() {
    const track = this.tabsTrack;
    if (!track || !this.tabsPrev || !this.tabsNext || !this.tabsScroller) return;

    const state = getTabsScrollState(track.scrollLeft, track.clientWidth, track.scrollWidth);
    this.tabsScroller.classList.toggle('is-overflowing', state.overflow);
    this.tabsPrev.disabled = !state.canPrev;
    this.tabsNext.disabled = !state.canNext;
    this.tabsPrev.setAttribute('aria-disabled', state.canPrev ? 'false' : 'true');
    this.tabsNext.setAttribute('aria-disabled', state.canNext ? 'false' : 'true');
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

  setStatus(online, modelName = '', device = '') {
    if (online) {
      this.statusDot.className = 'status-dot online';
      // Inline format keeps Navbar free of circular imports with arithmeticDefaults
      const model = String(modelName || '').trim();
      const dev = String(device || '').trim().toLowerCase();
      let label = 'ONLINE';
      if (model && dev) label = `ONLINE (${model} · ${dev})`;
      else if (model) label = `ONLINE (${model})`;
      else if (dev) label = `ONLINE (${dev})`;
      this.statusText.textContent = label;
      this.statusDot.title = label;
      this.statusText.title = label;
    } else {
      this.statusDot.className = 'status-dot offline';
      this.statusText.textContent = 'OFFLINE';
      this.statusDot.title = 'OFFLINE';
      this.statusText.title = 'OFFLINE';
    }
  }
}
