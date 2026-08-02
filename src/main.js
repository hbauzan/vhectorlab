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
import { threadSlidersMarkup, wireThreadSliders } from './ui/ThreadSliders.js';

class VectorLabApp {
  constructor() {
    this.appContainer = document.getElementById('app');

    // 1. Core 3D Scene Engine
    this.sceneSetup = new SceneSetup(this.appContainer);
    this.navigation = new Navigation(this.sceneSetup.camera, this.sceneSetup.renderer.domElement);
    this.instancer = new Instancer(this.sceneSetup.scene);
    this.axisGizmo = new AxisGizmo(this.sceneSetup.camera);
    this.interaction = new Interaction(
      this.sceneSetup.camera,
      this.sceneSetup.scene,
      this.sceneSetup.renderer.domElement
    );

    // 2. HTTP Remote Provider Client
    this.provider = new RemoteProvider();

    // 3. UI Components (Modal, HUD, Navbar, Sidebar)
    this.modal = new CustomModal();
    this.hud = new HUD(this.appContainer);

    this.navbar = new Navbar(this.appContainer, (mode) => {
      state.setRenderMode(mode);
      if (state.arithmeticData) {
        this.instancer.renderArithmeticData(state.arithmeticData, mode, this.sliderConfig);
      }
    });

    this.sidebar = new Sidebar(
      this.appContainer,
      async (wordA, wordB, wordC, topK) => this.handleCalculateArithmetic(wordA, wordB, wordC, topK),
      (resultItem, index) => this.handleResultClick(resultItem, index)
    );

    // 4. Spatial Control Sliders 3D Setup
    this.sliderConfig = {
      threadSpacing: 0.8,
      threadWidth: 1.0,
      threadThickness: 0.3
    };

    this.mountThreadSlidersUI();

    // 5. Interaction Callbacks
    this.interaction.onHoverCallback = (hoverData) => {
      this.hud.updateTelemetry(hoverData);
    };

    // 6. Clock for animation loop
    this.clock = new THREE.Clock();

    // Initialize Connection & Default Calculation
    this.init();
  }

  mountThreadSlidersUI() {
    const sliderWrapper = document.createElement('div');
    sliderWrapper.innerHTML = threadSlidersMarkup(this.sliderConfig);
    this.appContainer.appendChild(sliderWrapper.firstElementChild);

    const slidersContainer = document.getElementById('thread-sliders-container');
    wireThreadSliders(slidersContainer, null, this.sliderConfig, (cfg) => {
      // Re-render active 3D vector arithmetic in real time with updated spatial configuration
      if (state.arithmeticData) {
        this.instancer.renderArithmeticData(state.arithmeticData, state.renderMode, cfg);
      }
    });
  }

  async init() {
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

      // Render 3D Vector Points & Ribbons with current spatial layout configuration
      this.instancer.renderArithmeticData(data, state.renderMode, this.sliderConfig);

      // Update Sidebar results list
      this.sidebar.updateResults(data.results);
    } catch (e) {
      this.modal.show("ARITHMETIC ERROR", e.message || "Could not compute vector arithmetic.");
    }
  }

  handleResultClick(resultItem, index) {
    // Move 3D camera to focus on result vector
    const resVec = state.arithmeticData?.vector_res;
    if (resVec && resVec.length) {
      const targetPoint = this.instancer.layoutEngine.mapVectorTo3DPoints(resVec, 0)[0];
      if (targetPoint) {
        this.navigation.focusPosition(targetPoint);
      }
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const deltaTime = this.clock.getDelta();

    // Update navigation velocity
    this.navigation.update(deltaTime);

    // Raycast hover check
    const interactiveObjects = this.instancer.getInteractiveObjects();
    this.interaction.update(interactiveObjects);

    // Update corner axis gizmo
    this.axisGizmo.update();

    // Render 3D Scene
    this.sceneSetup.render();
  }
}

// Instantiate App when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  new VectorLabApp();
});
