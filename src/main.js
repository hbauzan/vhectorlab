import * as THREE from 'three';
import { SceneSetup } from './engine/SceneSetup.js';
import { Navigation } from './engine/Navigation.js';
import { Interaction } from './engine/Interaction.js';
import { Instancer } from './visualizer/Instancer.js';
import { AxisGizmo } from './visualizer/AxisGizmo.js';
import { RemoteProvider } from './core/RemoteProvider.js';
import { state } from './core/State.js';
import { Navbar } from './ui/Navbar.js';
import { Sidebar } from './ui/Sidebar.js';
import { HUD } from './ui/HUD.js';
import { CustomModal } from './ui/CustomModal.js';
import { ThreadLabels } from './ui/ThreadLabels.js';
import { threadSlidersMarkup, wireThreadSliders, syncThreadSlidersFromConfig } from './ui/ThreadSliders.js';
import { resolveSpatialDefaults } from './ui/spatialSliderDefaults.js';
import {
  visualizationControlsMarkup,
  wireVisualizationControls,
} from './ui/VisualizationControls.js';
import { loadVisualizationSettings } from './ui/visualizationControlsDefaults.js';

import { ComparePanel, COMPARE_AUTO_PRESETS } from './ui/ComparePanel.js';
import { CollapsibleDock } from './ui/CollapsibleDock.js';
import { LandscapeGate } from './ui/LandscapeGate.js';
import { TouchControls } from './ui/TouchControls.js';
import {
  attachCompareGroupMeta,
  mergeCompareOverlayLabels,
} from './ui/parseCompareGroups.js';

class VectorLabApp {
  constructor() {
    this.appContainer = document.getElementById('app');

    // 1. Core 3D Scene Engine
    this.sceneSetup = new SceneSetup(this.appContainer);
    this.navigation = new Navigation(this.sceneSetup.camera, this.sceneSetup.renderer.domElement);
    this.instancer = new Instancer(this.sceneSetup.scene);
    this.interaction = new Interaction(
      this.sceneSetup.camera,
      this.sceneSetup.scene,
      this.sceneSetup.renderer.domElement
    );

    // 2. HTTP Remote Provider Client
    this.provider = new RemoteProvider();

    // 3. View Mode State ("NAVIGATION" by default | "ANALYSIS")
    this.viewMode = 'NAVIGATION';

    // 4. UI Components (Modal, HUD, Navbar, Sidebar, ComparePanel, ThreadLabels)
    // Bottom HUD is always visible (roadmap D3) — not hosted in a collapsible dock.
    this.modal = new CustomModal();
    this.hud = new HUD(this.appContainer, {
      showCamPose: import.meta.env.VITE_SHOW_CAM_POSE === 'true'
    });
    this.threadLabels = new ThreadLabels(this.appContainer);

    // Soft portrait overlay (Etapa B / D13) — never pauses the render loop.
    this.landscapeGate = new LandscapeGate({ parent: this.appContainer });

    // Mobile joystick + look + Q/E (Etapa C). Hidden on desktop/tablet layout.
    this.touchControls = new TouchControls({
      parent: this.appContainer,
      navigation: this.navigation,
      canvas: this.sceneSetup.renderer.domElement,
    });

    this.navbar = new Navbar(
      this.appContainer,
      (renderMode) => {
        state.setRenderMode(renderMode);
        this.applyContextViewDefaults();
        this.refreshRender();
      },
      (viewMode) => {
        this.viewMode = viewMode;
        this.applyContextViewDefaults();
        this.refreshRender();
      },
      (workspaceMode) => {
        this.handleWorkspaceModeChange(workspaceMode);
      }
    );

    // Left dock hosts Arithmetic OR Compare (shared collapsed state across MODE).
    this.leftDock = new CollapsibleDock({
      parent: this.appContainer,
      side: 'left',
      id: 'left-dock',
      storageKey: 'vl3d.dock.left.collapsed',
      defaultCollapsed: false,
    });

    this.sidebar = new Sidebar(
      this.leftDock.body,
      async (wordA, wordB, wordC, topK) => this.handleCalculateArithmetic(wordA, wordB, wordC, topK)
    );

    this.comparePanel = new ComparePanel(
      this.leftDock.body,
      async (tokens, tokenMeta) => this.handleCalculateCompare(tokens, tokenMeta),
      async (payload) => this.handleCompareReorder(payload)
    );

    // Right dock: spatial sliders + AxisGizmo (roadmap D1).
    this.rightDock = new CollapsibleDock({
      parent: this.appContainer,
      side: 'right',
      id: 'right-dock',
      storageKey: 'vl3d.dock.right.collapsed',
      defaultCollapsed: false,
    });

    this.axisGizmo = new AxisGizmo(this.sceneSetup.camera, this.rightDock.body);

    // 5. Spatial Control Sliders 3D Setup (defaults from resolveSpatialDefaults)
    this.sliderConfig = resolveSpatialDefaults({
      workspaceMode: state.workspaceMode,
      viewMode: this.viewMode,
      renderMode: state.renderMode,
    });

    this.mountThreadSlidersUI();
    this.mountVisualizationControlsUI();

    // 6. Interaction Callbacks
    this.interaction.onHoverCallback = (hoverData) => {
      this.hud.updateTelemetry(hoverData);
    };

    // 7. Clock for animation loop
    this.clock = new THREE.Clock();

    // Initialize Connection & Default Calculation
    this.init();
  }

  mountThreadSlidersUI() {
    const sliderWrapper = document.createElement('div');
    sliderWrapper.innerHTML = threadSlidersMarkup(this.sliderConfig);
    const slidersEl = sliderWrapper.firstElementChild;
    this.slidersEl = slidersEl;
    // Insert sliders above the gizmo inside the right dock body.
    this.rightDock.body.insertBefore(slidersEl, this.axisGizmo.container);

    wireThreadSliders(slidersEl, null, this.sliderConfig, () => {
      this.refreshRender();
    }, {
      getContext: () => ({
        workspaceMode: state.workspaceMode,
        viewMode: this.viewMode,
        renderMode: state.renderMode,
      }),
    });
  }

  /**
   * Visualization panel (sign filter + color anchors) below Spatial Controls.
   */
  mountVisualizationControlsUI() {
    this.vizConfig = loadVisualizationSettings();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = visualizationControlsMarkup(this.vizConfig);
    const vizEl = wrapper.firstElementChild;
    this.vizEl = vizEl;
    // Below sliders, above AxisGizmo (V1).
    this.rightDock.body.insertBefore(vizEl, this.axisGizmo.container);

    wireVisualizationControls(vizEl, this.vizConfig, () => {
      this.refreshRender();
    });
  }

  /**
   * Apply camera + spatial defaults for current MODE/VIEW/RENDER and sync slider UI.
   * Called when context changes so each combo can keep its own sweet spot.
   */
  applyContextViewDefaults() {
    const ctx = {
      workspaceMode: state.workspaceMode,
      viewMode: this.viewMode,
      renderMode: state.renderMode,
    };
    this.sceneSetup.setFogForRenderMode(state.renderMode);
    this.navigation.setContextView(ctx);
    this.applyContextSpatialDefaults();
  }

  /**
   * Apply resolved spatial defaults for current MODE/VIEW/RENDER and sync slider UI.
   */
  applyContextSpatialDefaults() {
    const defaults = resolveSpatialDefaults({
      workspaceMode: state.workspaceMode,
      viewMode: this.viewMode,
      renderMode: state.renderMode,
    });
    Object.assign(this.sliderConfig, defaults);
    if (this.slidersEl) {
      syncThreadSlidersFromConfig(this.slidersEl, this.sliderConfig);
    }
  }

  handleWorkspaceModeChange(mode) {
    state.setWorkspaceMode(mode);
    this.applyContextViewDefaults();
    if (mode === 'COMPARE') {
      this.sidebar.element.classList.add('hidden');
      this.comparePanel.show();
      if (!state.compareData) {
        // Full EN auto-manual lexicon (matches textarea + COMPARE|NAVIGATION|POINTS framing)
        this.handleCalculateCompare(COMPARE_AUTO_PRESETS.default);
      } else {
        this.comparePanel.updateCompareResults(state.compareData);
        this.refreshRender();
      }
    } else {
      this.comparePanel.hide();
      this.sidebar.element.classList.remove('hidden');
      this.refreshRender();
    }
  }

  refreshRender() {
    if (state.workspaceMode === 'COMPARE') {
      if (state.compareData) {
        const labels = this.instancer.renderCompareData(
          state.compareData,
          state.renderMode,
          this.sliderConfig,
          this.viewMode,
          this.vizConfig
        );
        this.setCompareOverlayLabels(labels);
      }
    } else {
      if (state.arithmeticData) {
        const labels = this.instancer.renderArithmeticData(
          state.arithmeticData,
          state.renderMode,
          this.sliderConfig,
          this.viewMode,
          this.vizConfig
        );
        this.threadLabels.setLabels(labels);
      }
    }
  }

  /**
   * Token labels + optional GROUP_* floating badges (centroid, screen-offset left).
   * @param {Array} tokenLabels
   */
  setCompareOverlayLabels(tokenLabels) {
    this.threadLabels.setLabels(mergeCompareOverlayLabels(tokenLabels));
  }

  /**
   * During reorder tween: refresh token origins and recompute group centroids.
   * @param {Array} tokenLabels
   */
  updateCompareOverlayOrigins(tokenLabels) {
    this.threadLabels.updateOrigins(mergeCompareOverlayLabels(tokenLabels));
  }

  async init() {
    // Initial camera for startup ARITHMETIC|NAVIGATION|POINTS (corridor fallback)
    this.navigation.setContextView({
      workspaceMode: state.workspaceMode,
      viewMode: this.viewMode,
      renderMode: state.renderMode,
    });

    // Check backend health status
    const health = await this.provider.checkHealth();
    if (health.ok) {
      state.setBackendConnected(true);
      this.navbar.setStatus(true, health.data.model);
      // Run initial default vector calculation (king - man + woman)
      await this.handleCalculateArithmetic("king", "man", "woman", 10);
    } else {
      state.setBackendConnected(false);
      this.navbar.setStatus(false);
      this.modal.show(
        "BACKEND OFFLINE",
        "FastAPI backend is not running at http://127.0.0.1:8000. Please start the backend with `cd backend && uv run python -m server`."
      );
    }

    // Start render animation loop
    this.animate();
  }

  async handleCalculateArithmetic(wordA, wordB, wordC, topK) {
    try {
      const data = await this.provider.computeArithmetic(wordA, wordB, wordC, topK);
      state.setArithmeticData(data);

      // Render 3D Vector Points & Ribbons and update Thread Labels
      const labels = this.instancer.renderArithmeticData(
        data,
        state.renderMode,
        this.sliderConfig,
        this.viewMode,
        this.vizConfig
      );
      this.threadLabels.setLabels(labels);

      // Update Sidebar results list
      this.sidebar.updateResults(data.results);
    } catch (e) {
      this.modal.show("ARITHMETIC ERROR", e.message || "Could not compute vector arithmetic.");
    }
  }

  async handleCalculateCompare(tokens, tokenMeta = null) {
    try {
      const data = await this.provider.computeCompare(tokens);
      const withMeta = attachCompareGroupMeta(data, tokenMeta);
      state.setCompareData(withMeta);

      const labels = this.instancer.renderCompareData(
        withMeta,
        state.renderMode,
        this.sliderConfig,
        this.viewMode,
        this.vizConfig
      );
      this.setCompareOverlayLabels(labels);
      this.comparePanel.updateCompareResults(withMeta);
    } catch (e) {
      this.modal.show("COMPARE ERROR", e.message || "Could not compute token sequence comparison.");
    }
  }

  /**
   * In-memory COMPARE reorder: refresh list scores already done by panel;
   * animate 3D thread slots to the new sequence order (no backend re-call).
   * Global sort/reorder may break group contiguity (D2a) — group badges follow centroids.
   */
  async handleCompareReorder(payload) {
    if (!payload || !payload.items) return;

    state.setCompareData({
      ...(state.compareData || {}),
      count: payload.count,
      anchor: payload.anchor,
      items: payload.items,
    });

    const orderedIds = payload.items.map((item) => item.id);
    try {
      const labels = await this.instancer.animateCompareReorder(orderedIds, {
        duration: 320,
        onFrame: (frameLabels) => this.updateCompareOverlayOrigins(frameLabels),
      });
      if (labels && labels.length) {
        this.updateCompareOverlayOrigins(labels);
      }
    } catch (_) {
      // Fallback: hard re-layout without flicker-prone double clear if tween busy/unavailable
      this.refreshRender();
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const deltaTime = this.clock.getDelta();

    // Update navigation velocity
    this.navigation.update(deltaTime);

    if (this.hud.showCamPose) {
      this.navigation.euler.setFromQuaternion(this.sceneSetup.camera.quaternion);
      this.hud.updateCameraPose(this.sceneSetup.camera, this.navigation.euler);
    }

    // Raycast hover check
    const interactiveObjects = this.instancer.getInteractiveObjects();
    this.interaction.update(interactiveObjects);

    // Update corner axis gizmo
    this.axisGizmo.update();

    // Update floating Glassmorphic thread labels position
    this.threadLabels.update(this.sceneSetup.camera, window.innerWidth, window.innerHeight);

    // Render 3D Scene
    this.sceneSetup.render();
  }
}

// Instantiate App when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  new VectorLabApp();
});
