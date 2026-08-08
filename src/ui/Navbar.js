/**
 * Top Navbar: MODE | VIEW (ANALYSIS | NAVIGATION | GALAXY) | RENDER.
 * Galaxy: method chips (UMAP active; PCA/t-SNE disabled) + MODE/RENDER lock.
 * Mobile: overflow tab strip gets ◀ ▶ scroll arrows.
 */
import { getTabsScrollState, nextTabsScrollLeft } from './navbarTabsScroll.js';
import {
  DEFAULT_RENDER_MODE,
  DEFAULT_VIEW_MODE,
  DEFAULT_WORKSPACE_MODE,
} from './appViewDefaults.js';
import {
  DEFAULT_GALAXY_METHOD,
  GALAXY_METHODS,
  GALAXY_VIEW,
  isGalaxyView,
} from './galaxyChrome.js';

export class Navbar {
  constructor(
    containerElement,
    onRenderModeChangeCallback,
    onViewModeChangeCallback,
    onWorkspaceModeChangeCallback,
    onGalaxyMethodChangeCallback,
  ) {
    this.container = containerElement || document.body;
    this.onRenderModeChange = onRenderModeChangeCallback;
    this.onViewModeChange = onViewModeChangeCallback;
    this.onWorkspaceModeChange = onWorkspaceModeChangeCallback;
    this.onGalaxyMethodChange = onGalaxyMethodChangeCallback;
    this._modeRenderLocked = false;
    this._galaxyMethod = DEFAULT_GALAXY_METHOD;

    const workspaceActive = (mode) => (mode === DEFAULT_WORKSPACE_MODE ? ' active' : '');
    const viewActive = (mode) => (mode === DEFAULT_VIEW_MODE ? ' active' : '');
    const renderActive = (mode) => (mode === DEFAULT_RENDER_MODE ? ' active' : '');

    const methodChipsHtml = Object.values(GALAXY_METHODS)
      .map((m) => {
        const disabled = m.enabled ? '' : ' disabled';
        const title = m.title ? ` title="${m.title}"` : '';
        const active = m.id === DEFAULT_GALAXY_METHOD ? ' active' : '';
        return `<button type="button" data-galaxy-method="${m.id}" class="galaxy-method-chip${active}"${disabled}${title}>${m.label}</button>`;
      })
      .join('');

    this.element = document.createElement('header');
    this.element.id = 'top-navbar';
    this.element.className = 'glass-navbar';
    this.element.innerHTML = `
      <div class="navbar-brand">
        <div class="logo-icon">🌐</div>
        <div class="title-group">
          <h1>VHectorLab <span class="accent-3d">3D</span></h1>
          <span class="version-tag">v2.4.2</span>
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
            <div class="galaxy-view-cluster">
              <button data-view="${GALAXY_VIEW}" class="view-tab${viewActive(GALAXY_VIEW)}">GALAXY</button>
              <div class="galaxy-method-chips" hidden aria-label="Galaxy projection method">
                ${methodChipsHtml}
              </div>
            </div>
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
    this.galaxyMethodChips = this.element.querySelector('.galaxy-method-chips');
    this.galaxyMethodButtons = this.element.querySelectorAll('[data-galaxy-method]');
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
    this.workspaceTabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        if (this._modeRenderLocked || tab.disabled) return;
        const mode = e.currentTarget.getAttribute('data-workspace');
        this.setWorkspaceMode(mode);
        if (this.onWorkspaceModeChange) {
          this.onWorkspaceModeChange(mode);
        }
      });
    });

    this.renderTabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        if (this._modeRenderLocked || tab.disabled) return;
        const mode = e.currentTarget.getAttribute('data-mode');
        this.setRenderMode(mode);
        if (this.onRenderModeChange) {
          this.onRenderModeChange(mode);
        }
      });
    });

    this.viewTabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const view = e.currentTarget.getAttribute('data-view');
        this.setViewMode(view);
        if (this.onViewModeChange) {
          this.onViewModeChange(view);
        }
      });
    });

    this.galaxyMethodButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        if (btn.disabled) return;
        const method = e.currentTarget.getAttribute('data-galaxy-method');
        this.setGalaxyMethod(method);
        if (this.onGalaxyMethodChange) {
          this.onGalaxyMethodChange(method);
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
    this.viewTabs.forEach((t) => {
      if (t.getAttribute('data-view') === viewMode) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });
    this.setGalaxyMethodChipsVisible(isGalaxyView(viewMode));
  }

  setWorkspaceMode(workspaceMode) {
    this.workspaceTabs.forEach((t) => {
      if (t.getAttribute('data-workspace') === workspaceMode) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });
  }

  setRenderMode(renderMode) {
    this.renderTabs.forEach((t) => {
      if (t.getAttribute('data-mode') === renderMode) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });
  }

  /**
   * Lock MODE + RENDER while in Galaxy (COMPARE + POINTS forced).
   * @param {boolean} locked
   */
  setModeRenderLocked(locked) {
    this._modeRenderLocked = !!locked;
    this.workspaceTabs.forEach((t) => {
      t.disabled = this._modeRenderLocked;
      t.classList.toggle('tab-locked', this._modeRenderLocked);
      t.setAttribute('aria-disabled', this._modeRenderLocked ? 'true' : 'false');
    });
    this.renderTabs.forEach((t) => {
      t.disabled = this._modeRenderLocked;
      t.classList.toggle('tab-locked', this._modeRenderLocked);
      t.setAttribute('aria-disabled', this._modeRenderLocked ? 'true' : 'false');
    });
  }

  setGalaxyMethodChipsVisible(visible) {
    if (!this.galaxyMethodChips) return;
    if (visible) {
      this.galaxyMethodChips.removeAttribute('hidden');
    } else {
      this.galaxyMethodChips.setAttribute('hidden', '');
    }
  }

  setGalaxyMethod(method) {
    this._galaxyMethod = method || DEFAULT_GALAXY_METHOD;
    this.galaxyMethodButtons.forEach((btn) => {
      const id = btn.getAttribute('data-galaxy-method');
      btn.classList.toggle('active', id === this._galaxyMethod);
    });
  }

  setStatus(online, modelName = '', device = '') {
    if (online) {
      this.statusDot.className = 'status-dot online';
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
