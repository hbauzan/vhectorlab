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
import { threadSlidersMarkup, wireThreadSliders } from './ui/ThreadSliders.js';

import { ComparePanel, COMPARE_AUTO_PRESETS } from './ui/ComparePanel.js';
import { CollapsibleDock } from './ui/CollapsibleDock.js';
import { LandscapeGate } from './ui/LandscapeGate.js';
import { TouchControls } from './ui/TouchControls.js';

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
        this.refreshRender();
      },
      (viewMode) => {
        this.viewMode = viewMode;
        if (viewMode === 'ANALYSIS') {
          this.navigation.setAnalysisView();
        } else {
          this.navigation.setNavigationView();
        }
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
      async (tokens) => this.handleCalculateCompare(tokens),
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

    // 5. Spatial Control Sliders 3D Setup
    this.sliderConfig = {
      threadSpacing: 0.4,
      threadVectorDistance: 10.0,
      threadAmplitudeY: 7.0,
      threadWidth: 0.2,
      threadThickness: 0.10
    };

    this.mountThreadSlidersUI();

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
    // Insert sliders above the gizmo inside the right dock body.
    this.rightDock.body.insertBefore(slidersEl, this.axisGizmo.container);

    wireThreadSliders(slidersEl, null, this.sliderConfig, () => {
      this.refreshRender();
    });
  }

  handleWorkspaceModeChange(mode) {
    state.setWorkspaceMode(mode);
    if (mode === 'COMPARE') {
      this.sidebar.element.classList.add('hidden');
      this.comparePanel.show();
      if (!state.compareData) {
        // Run initial default comparison sequence
        this.handleCalculateCompare(COMPARE_AUTO_PRESETS.sample5);
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
          this.viewMode
        );
        this.threadLabels.setLabels(labels);
      }
    } else {
      if (state.arithmeticData) {
        const labels = this.instancer.renderArithmeticData(
          state.arithmeticData,
          state.renderMode,
          this.sliderConfig,
          this.viewMode
        );
        this.threadLabels.setLabels(labels);
      }
    }
  }

  async init() {
    // Set initial camera view for NAVIGATION mode
    this.navigation.setNavigationView();

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
        this.viewMode
      );
      this.threadLabels.setLabels(labels);

      // Update Sidebar results list
      this.sidebar.updateResults(data.results);
    } catch (e) {
      this.modal.show("ARITHMETIC ERROR", e.message || "Could not compute vector arithmetic.");
    }
  }

  async handleCalculateCompare(tokens) {
    try {
      const data = await this.provider.computeCompare(tokens);
      state.setCompareData(data);

      const labels = this.instancer.renderCompareData(
        data,
        state.renderMode,
        this.sliderConfig,
        this.viewMode
      );
      this.threadLabels.setLabels(labels);
      this.comparePanel.updateCompareResults(data);
    } catch (e) {
      this.modal.show("COMPARE ERROR", e.message || "Could not compute token sequence comparison.");
    }
  }

  /**
   * In-memory COMPARE reorder: refresh list scores already done by panel;
   * animate 3D thread slots to the new sequence order (no backend re-call).
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
        onFrame: (frameLabels) => this.threadLabels.updateOrigins(frameLabels),
      });
      if (labels && labels.length) {
        this.threadLabels.updateOrigins(labels);
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
