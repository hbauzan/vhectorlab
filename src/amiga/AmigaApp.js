/**
 * Amiga Workbench lab app — product wire reused from legacy `src/main.js`
 * (engine / ui / core / visualizer). Chrome host = `/amiga/` MagicWB shell.
 * Do not import from `src/v25/**`.
 */
import {
  applyAmigaCssVars,
  resolveAmigaColors,
} from './amigaEnvColors.js';
import { mountShell, resolveCanvasSize } from './shell.js';
import { PRODUCT_VERSION } from './version.js';

import * as THREE from 'three';
import { SceneSetup } from '../engine/SceneSetup.js';
import { Navigation } from '../engine/Navigation.js';
import { Interaction } from '../engine/Interaction.js';
import { Instancer } from '../visualizer/Instancer.js';
import { AxisGizmo } from '../visualizer/AxisGizmo.js';
import { RemoteProvider } from '../core/RemoteProvider.js';
import { state } from '../core/State.js';
import {
  applySaeToCompare,
  cloneCompareRaw,
  collectCompareEmbeddings,
} from '../core/saeReplace.js';
import {
  computeDimSpanScale,
  inferRawDim,
  inferSaeDim,
} from '../core/saeFraming.js';
import { resolveCameraPose } from '../engine/cameraViewDefaults.js';
import { Navbar } from '../ui/Navbar.js';
import { Sidebar } from '../ui/Sidebar.js';
import { HUD } from '../ui/HUD.js';
import { CustomModal } from '../ui/CustomModal.js';
import { ThreadLabels } from '../ui/ThreadLabels.js';
import { threadSlidersMarkup, wireThreadSliders, syncThreadSlidersFromConfig } from '../ui/ThreadSliders.js';
import { resolveSpatialDefaults } from '../ui/spatialSliderDefaults.js';
import {
  visualizationControlsMarkup,
  wireVisualizationControls,
  syncVisualizationControlsFromConfig,
  readVisualizationPanelCollapsed,
  vizPanelLayoutForViewport,
  resolveVisualizationMountParent,
  setVisualizationPanelLayout,
  setGroupContrastControlsEnabled,
} from '../ui/VisualizationControls.js';
import {
  loadVisualizationSettings,
  saveVisualizationSettings,
} from '../ui/visualizationControlsDefaults.js';
import { hasGroupsForDimContrast } from '../visualizer/groupDimContrast.js';
import {
  snapshotFilterForSae,
  filterModeForSaeOn,
  restoreFilterAfterSae,
} from '../ui/saeFilterBridge.js';
import {
  loadSaeSettings,
  saveSaeSettings,
  computeActivationMetrics,
  formatSaeTrainProgress,
} from '../ui/saeControlsDefaults.js';
import { wireFieldInfo } from '../ui/fieldInfo.js';
import {
  DEFAULT_VIEW_MODE,
} from '../ui/appViewDefaults.js';
import {
  enterGalaxyChrome,
  isGalaxyView,
  leaveGalaxyChrome,
} from '../ui/galaxyChrome.js';
import { runGalaxyPipeline, compareTextsFingerprint } from '../ui/galaxyPipeline.js';
import { galaxyCameraTarget } from '../visualizer/galaxyLayout.js';
import {
  loadArithmeticSettings,
  saveArithmeticSettings,
} from '../ui/arithmeticDefaults.js';
import { ComparePanel, getCompareBootstrap } from '../ui/ComparePanel.js';
import { CollapsibleDock, isMobileViewport, MOBILE_MQ } from '../ui/CollapsibleDock.js';
import { LandscapeGate } from '../ui/LandscapeGate.js';
import { TouchControls } from '../ui/TouchControls.js';
import {
  attachCompareGroupMeta,
  enrichLabelsWithGroupMeta,
  mergeCompareOverlayLabels,
} from '../ui/parseCompareGroups.js';

class AmigaApp {
  constructor() {
    const colors = resolveAmigaColors(import.meta.env);
    applyAmigaCssVars(document.documentElement, colors);
    document.body.classList.add('amiga-workbench');

    this.appContainer = document.getElementById('app');
    this.zones = mountShell(this.appContainer);
    this.canvasHost = this.zones.canvas;

    // 1. Core 3D Scene Engine — sized to canvas zone (not window)
    this.sceneSetup = new SceneSetup(this.canvasHost);
    this.sceneSetup.onWindowResize = () => {
      const { width, height } = resolveCanvasSize(this.canvasHost);
      this.sceneSetup.camera.aspect = width / height;
      this.sceneSetup.camera.updateProjectionMatrix();
      this.sceneSetup.renderer.setSize(width, height, false);
    };
    this.sceneSetup.onWindowResize();
    if (typeof ResizeObserver !== 'undefined') {
      this._canvasRo = new ResizeObserver(() => this.sceneSetup.onWindowResize());
      this._canvasRo.observe(this.canvasHost);
    }

    this.navigation = new Navigation(this.sceneSetup.camera, this.sceneSetup.renderer.domElement);
    this.instancer = new Instancer(this.sceneSetup.scene);
    this.interaction = new Interaction(
      this.sceneSetup.camera,
      this.sceneSetup.scene,
      this.sceneSetup.renderer.domElement
    );

    // 2. HTTP Remote Provider Client
    this.provider = new RemoteProvider();

    // 3. View Mode State — startup ARITHMETIC | ANALYSIS | POINTS
    this.viewMode = DEFAULT_VIEW_MODE;
    /** @type {{ workspaceMode: string, viewMode: string, renderMode: string }|null} */
    this._preGalaxyTriad = null;
    this.galaxyMethod = 'umap';
    /** @type {number[][]|null} UMAP positions aligned with compare items */
    this.galaxyPositions = null;
    this._galaxyProjectBusy = false;
    this._galaxyFramePending = false;
    /** @type {{ fingerprint: string, itemCount: number, rawData: object }|null} */
    this._galaxyCompareCache = null;

    // 4. UI Components — zones: header / left / right / footer / canvas
    this.modal = new CustomModal();
    this.hud = new HUD(this.zones.footer, {
      showCamPose: import.meta.env.VITE_SHOW_CAM_POSE === 'true'
    });
    this.threadLabels = new ThreadLabels(this.canvasHost);

    this.landscapeGate = new LandscapeGate({ parent: this.appContainer });

    this.touchControls = new TouchControls({
      parent: this.canvasHost,
      navigation: this.navigation,
      canvas: this.sceneSetup.renderer.domElement,
    });

    this.navbar = new Navbar(
      this.zones.header,
      (renderMode) => {
        if (isGalaxyView(this.viewMode)) return;
        state.setRenderMode(renderMode);
        this.applyContextViewDefaults();
        this.refreshRender();
      },
      (viewMode) => {
        this.handleViewModeChange(viewMode);
      },
      (workspaceMode) => {
        if (isGalaxyView(this.viewMode)) return;
        this.handleWorkspaceModeChange(workspaceMode);
      },
      (method) => {
        this.galaxyMethod = method;
        // Projection pipeline wires in later Galaxy slices.
      },
    );

    const brandH1 = this.navbar.element.querySelector('.title-group h1');
    if (brandH1) {
      brandH1.innerHTML = 'VHectorLab <span class="accent-3d">Amiga</span>';
    }
    const ver = this.navbar.element.querySelector('.version-tag');
    if (ver) ver.textContent = `v${PRODUCT_VERSION}`;

    // Tap/click "i" tips on editable fields (mobile-friendly; one tip at a time).
    wireFieldInfo(document);

    // Left dock hosts Arithmetic OR Compare (shared collapsed state across MODE).
    this.leftDock = new CollapsibleDock({
      parent: this.zones.left,
      side: 'left',
      id: 'amiga-left-dock',
      storageKey: 'vl3d.amiga.dock.left.collapsed',
      defaultCollapsed: false,
    });

    this.saeSettings = loadSaeSettings();
    this.saeStatus = null;
    this.rawCompareData = null;
    this._saeTrainPollTimer = null;
    this._saeTrainBusy = false;
    this._saeTrainStartedAt = 0;
    this._saeTrainElapsedTimer = null;
    this._saeTrainPollInFlight = false;
    this._saeTrainSeenRunning = false;
    this._saeTrainPostDone = false;
    /** @type {{ previousMode: string }|null} */
    this._saeFilterSnapshot = null;
    /** Session-only dim contrast sort (Compare groups). */
    this.dimSortByContrast = false;

    const saeHooks = {
      onSaeToggle: (enabled) => this.handleSaeToggle(enabled),
      onSaeTrain: (settings) => this.handleSaeTrain(settings),
      getSaeSettings: () => this.saeSettings,
      setSaeSettings: (s) => {
        this.saeSettings = s;
        saveSaeSettings(s);
      },
      onDimSortChange: (enabled) => {
        this.dimSortByContrast = !!enabled;
        this.refreshRender();
      },
    };

    this.sidebar = new Sidebar(
      this.leftDock.body,
      async (wordA, wordB, wordC, topK) => this.handleCalculateArithmetic(wordA, wordB, wordC, topK)
    );

    this.comparePanel = new ComparePanel(
      this.leftDock.body,
      async (tokens, tokenMeta) => this.handleCalculateCompare(tokens, tokenMeta),
      async (payload) => this.handleCompareReorder(payload),
      saeHooks
    );

    // Right dock: spatial sliders + AxisGizmo (roadmap D1).
    this.rightDock = new CollapsibleDock({
      parent: this.zones.right,
      side: 'right',
      id: 'amiga-right-dock',
      storageKey: 'vl3d.amiga.dock.right.collapsed',
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
   * Visualization panel glued to the bottom HUD (app root).
   * Short left dock-tab collapses the sheet down onto the HUD baseline.
   */
  mountVisualizationControlsUI() {
    this.vizConfig = loadVisualizationSettings();
    const storage = typeof localStorage !== 'undefined' ? localStorage : null;
    const mobile = isMobileViewport();
    const layout = vizPanelLayoutForViewport(mobile);
    const collapsed = readVisualizationPanelCollapsed(storage, {
      isMobile: mobile,
    });
    const wrapper = document.createElement('div');
    wrapper.innerHTML = visualizationControlsMarkup(this.vizConfig, { collapsed, layout });
    const vizEl = wrapper.firstElementChild;
    this.vizEl = vizEl;
    this.placeVisualizationControls(vizEl);

    wireVisualizationControls(vizEl, this.vizConfig, () => {
      this.threadLabels.setVisible(this.vizConfig.labelsVisible);
      this.refreshRender();
    });
    this.threadLabels.setVisible(this.vizConfig.labelsVisible);
    this.syncGroupContrastGate();

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this._vizLayoutMq = window.matchMedia(MOBILE_MQ);
      this._onVizLayoutMq = () => this.syncVisualizationPanelHost();
      if (typeof this._vizLayoutMq.addEventListener === 'function') {
        this._vizLayoutMq.addEventListener('change', this._onVizLayoutMq);
      } else if (typeof this._vizLayoutMq.addListener === 'function') {
        this._vizLayoutMq.addListener(this._onVizLayoutMq);
      }
    }
  }

  /**
   * @param {HTMLElement} vizEl
   */
  placeVisualizationControls(vizEl) {
    const parent = resolveVisualizationMountParent({
      isMobile: isMobileViewport(),
      dockBody: this.rightDock.body,
      appRoot: this.appContainer,
    });
    if (vizEl.parentElement !== parent) {
      parent.appendChild(vizEl);
    }
  }

  /** Retarget layout attribute when crossing the phone breakpoint. */
  syncVisualizationPanelHost() {
    if (!this.vizEl) return;
    const mobile = isMobileViewport();
    const layout = vizPanelLayoutForViewport(mobile);
    setVisualizationPanelLayout(this.vizEl, layout);
    this.placeVisualizationControls(this.vizEl);
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
        // Same grouped demo as textarea — pass tokenMeta or GROUP_* badges never appear
        const boot = getCompareBootstrap();
        this.handleCalculateCompare(boot.tokens, boot.tokenMeta);
      } else {
        this.comparePanel.updateCompareResults(state.compareData);
        this.refreshRender();
      }
    } else {
      // SAE is Compare-only — leave Clean/Denoise when switching to Arithmetic
      if (this.saeSettings.enabled) {
        this.saeSettings = { ...this.saeSettings, enabled: false };
        saveSaeSettings(this.saeSettings);
        this.comparePanel.saeUi.setToggleEnabled(false);
        this.restoreRawWorkspace({ reframe: false });
      }
      this.comparePanel.hide();
      this.sidebar.element.classList.remove('hidden');
      this.refreshRender();
    }
  }

  /**
   * VIEW triad: Galaxy locks MODE=COMPARE + RENDER=POINTS; leaving restores snapshot.
   * @param {string} nextView
   */
  handleViewModeChange(nextView) {
    const wasGalaxy = isGalaxyView(this.viewMode);
    const entering = isGalaxyView(nextView);

    if (entering && !wasGalaxy) {
      const entered = enterGalaxyChrome({
        workspaceMode: state.workspaceMode,
        viewMode: this.viewMode,
        renderMode: state.renderMode,
      });
      this._preGalaxyTriad = entered.restore;
      this.viewMode = entered.viewMode;
      this.galaxyMethod = entered.method;
      this.navbar.setModeRenderLocked(true);
      this.navbar.setGalaxyMethod(entered.method);
      this.navbar.setViewMode(entered.viewMode);

      if (state.renderMode !== entered.renderMode) {
        state.setRenderMode(entered.renderMode);
      }
      this.navbar.setRenderMode(entered.renderMode);

      if (state.workspaceMode !== entered.workspaceMode) {
        this.navbar.setWorkspaceMode(entered.workspaceMode);
        this.handleWorkspaceModeChange(entered.workspaceMode);
      } else {
        this.navbar.setWorkspaceMode(entered.workspaceMode);
        this.applyContextViewDefaults();
        this.refreshRender();
      }
      return;
    }

    if (!entering && wasGalaxy) {
      const left = leaveGalaxyChrome(this._preGalaxyTriad, nextView);
      this._preGalaxyTriad = null;
      this.galaxyPositions = null;
      this._galaxyFramePending = false;
      this.comparePanel?.clearGalaxyProgress?.();
      this.viewMode = left.viewMode;
      this.navbar.setModeRenderLocked(false);
      this.navbar.setViewMode(left.viewMode);

      if (state.renderMode !== left.renderMode) {
        state.setRenderMode(left.renderMode);
      }
      this.navbar.setRenderMode(left.renderMode);

      if (state.workspaceMode !== left.workspaceMode) {
        this.navbar.setWorkspaceMode(left.workspaceMode);
        this.handleWorkspaceModeChange(left.workspaceMode);
      } else {
        this.navbar.setWorkspaceMode(left.workspaceMode);
        this.applyContextViewDefaults();
        this.refreshRender();
      }
      return;
    }

    this.viewMode = nextView;
    this.navbar.setViewMode(nextView);
    this.applyContextViewDefaults();
    this.refreshRender();
  }

  refreshRender() {
    if (state.workspaceMode === 'COMPARE') {
      if (state.compareData) {
        // Ensure Instancer threads carry group meta (RAW cache is source of truth)
        let data = state.compareData;
        if (this.rawCompareData?.items?.length) {
          const byId = new Map(this.rawCompareData.items.map((it) => [it.id, it]));
          data = {
            ...data,
            items: (data.items || []).map((item, i) => {
              const raw = byId.get(item.id) || this.rawCompareData.items[i];
              if (!raw?.groupId) return item;
              return {
                ...item,
                groupId: raw.groupId,
                groupLabel: raw.groupLabel || raw.groupId,
              };
            }),
          };
        }

        if (isGalaxyView(this.viewMode)) {
          const n = data.items?.length || 0;
          const ready = Array.isArray(this.galaxyPositions)
            && this.galaxyPositions.length === n
            && n > 0;
          if (ready) {
            const labels = this.instancer.renderGalaxyData(
              data,
              this.galaxyPositions,
              this.sliderConfig,
              this.vizConfig,
            );
            this.setCompareOverlayLabels(labels);
            this.comparePanel.updateGroupLegend(data.items);
            if (this._galaxyFramePending) {
              this._galaxyFramePending = false;
              this.frameGalaxyCamera(labels);
            }
          } else {
            // Keep prior mesh; kick client-driven pipeline with k/n progress.
            void this.runGalaxyPipelineFromApp({ preferCache: true });
          }
          this.syncGroupContrastGate();
          return;
        }

        const labels = this.instancer.renderCompareData(
          data,
          state.renderMode,
          this.sliderConfig,
          this.viewMode,
          this.vizConfig,
          { dimSortByContrast: this.dimSortByContrast }
        );
        this.setCompareOverlayLabels(labels);
        this.comparePanel.updateGroupLegend(data.items);
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
    this.syncGroupContrastGate();
  }

  /**
   * Client-driven Galaxy pipeline: encode → SAE? → UMAP → build, with k/n progress.
   * @param {{
   *   texts?: string[]|null,
   *   tokenMeta?: unknown,
   *   preferCache?: boolean,
   * }} [opts]
   */
  async runGalaxyPipelineFromApp({
    texts = null,
    tokenMeta = null,
    preferCache = true,
  } = {}) {
    if (!isGalaxyView(this.viewMode)) return;
    if (this._galaxyProjectBusy) return;

    const resolvedTexts = texts
      || this.rawCompareData?.items?.map((it) => it.text)
      || state.compareData?.items?.map((it) => it.text);
    if (!resolvedTexts?.length) return;

    this._galaxyProjectBusy = true;
    this.galaxyPositions = null;
    this.comparePanel?.setLoading?.(true);

    try {
      const saeEnabled = !!(this.saeSettings.enabled && this.saeStatus?.is_trained);
      let compareCache = preferCache ? this._galaxyCompareCache : null;
      if (preferCache && !compareCache && this.rawCompareData?.items?.length) {
        const rawFp = compareTextsFingerprint(
          this.rawCompareData.items.map((it) => it.text),
        );
        const wantFp = compareTextsFingerprint(resolvedTexts);
        if (rawFp === wantFp) {
          compareCache = {
            fingerprint: rawFp,
            itemCount: this.rawCompareData.items.length,
            rawData: this.rawCompareData,
          };
        }
      }

      const result = await runGalaxyPipeline({
        texts: resolvedTexts,
        tokenMeta,
        saeEnabled,
        compareCache,
        fetchCompare: (toks) => this.provider.computeCompare(toks),
        attachMeta: (data, meta) => {
          const withMeta = attachCompareGroupMeta(data, meta);
          withMeta.featureSpace = 'RAW';
          return withMeta;
        },
        encodeSae: async (rawData) => {
          const embeddings = collectCompareEmbeddings(rawData);
          const encoded = await this.provider.saeEncode(embeddings);
          const saeData = applySaeToCompare(rawData, encoded.activations);
          if (rawData?.items) {
            saeData.items = saeData.items.map((item, i) => {
              const raw = rawData.items[i];
              if (!raw) return item;
              return {
                ...item,
                groupId: raw.groupId,
                groupLabel: raw.groupLabel,
              };
            });
          }
          saeData.featureSpace = 'SAE';
          const batch = encoded.batch_metrics || computeActivationMetrics(encoded.activations);
          const trainMetrics = this.saeStatus?.metrics || {};
          this.comparePanel.saeUi.setMetrics({
            l0: batch.l0,
            sparsity: batch.sparsity,
            activeFeatures: batch.active_features ?? batch.activeFeatures,
            trainMse: trainMetrics.mse,
            deadFeaturesPct: trainMetrics.dead_features_pct,
          });
          this.applySaeOnFilterOverride();
          return saeData;
        },
        project: async (vectors) => {
          const res = await this.provider.projectEmbeddings(vectors, {
            method: this.galaxyMethod || 'umap',
            n_components: 3,
            seed: 42,
          });
          return res.positions;
        },
        onProgress: (p) => this.comparePanel.setGalaxyProgress(p),
      });

      this._galaxyCompareCache = result.compareCache;
      this.rawCompareData = cloneCompareRaw(result.rawData);
      state.setCompareData(result.displayData);
      this.comparePanel.updateCompareResults(result.displayData);
      this.galaxyPositions = result.positions;
      this._galaxyFramePending = true;
      if (isGalaxyView(this.viewMode)) {
        this.refreshRender();
      }
    } catch (err) {
      console.error('Galaxy pipeline failed:', err);
      this.modal?.show?.('Galaxy projection failed', String(err?.message || err));
    } finally {
      this._galaxyProjectBusy = false;
      this.comparePanel?.clearGalaxyProgress?.();
      this.comparePanel?.setLoading?.(false);
    }
  }

  /**
   * Frame camera on GROUP_it_core centroid (fallback: all-points bbox).
   * @param {Array} labels from renderGalaxyData
   */
  frameGalaxyCamera(labels) {
    const target = galaxyCameraTarget(labels);
    if (!target) return;
    // Prefer fit-box so sparse cores stay readable; look-at is IT centroid when present.
    const box = target.box.clone();
    // Inflate slightly so focus isn't clipped
    box.expandByScalar(8);
    void this.navigation.animateToFitBox(box, {
      viewMode: 'NAVIGATION',
      durationMs: 550,
    }).then(() => {
      // Nudge look-at toward IT core centroid after fit
      if (target.source !== 'all') {
        this.navigation.focusPosition(target.lookAt, 0.45);
      }
    });
  }

  /**
   * Enable Group contrast viz controls only for compare ≥2 groups.
   */
  syncGroupContrastGate() {
    if (!this.vizEl || !this.vizConfig) return;
    const items = state.workspaceMode === 'COMPARE'
      ? (this.rawCompareData?.items || state.compareData?.items || [])
      : [];
    setGroupContrastControlsEnabled(this.vizEl, hasGroupsForDimContrast(items), this.vizConfig);
  }

  /**
   * Token labels + optional GROUP_* floating badges (centroid, screen-offset left).
   * Enriches from compare/raw items so meta survives SAE + reorder.
   * @param {Array} tokenLabels
   */
  setCompareOverlayLabels(tokenLabels) {
    const items = this.rawCompareData?.items || state.compareData?.items;
    const enriched = enrichLabelsWithGroupMeta(tokenLabels, items);
    this.threadLabels.setLabels(mergeCompareOverlayLabels(enriched));
  }

  /**
   * During reorder tween: refresh token origins and recompute group centroids.
   * @param {Array} tokenLabels
   */
  updateCompareOverlayOrigins(tokenLabels) {
    const items = this.rawCompareData?.items || state.compareData?.items;
    const enriched = enrichLabelsWithGroupMeta(tokenLabels, items);
    this.threadLabels.updateOrigins(mergeCompareOverlayLabels(enriched));
  }

  async init() {
    // Initial camera for startup ARITHMETIC|ANALYSIS|POINTS
    this.navigation.setContextView({
      workspaceMode: state.workspaceMode,
      viewMode: this.viewMode,
      renderMode: state.renderMode,
    });

    const arithmeticPrefs = loadArithmeticSettings();
    this.sidebar.setInputs(
      arithmeticPrefs.wordA,
      arithmeticPrefs.wordB,
      arithmeticPrefs.wordC,
    );

    // Check backend health status
    const health = await this.provider.checkHealth();
    if (health.ok) {
      state.setBackendConnected(true);
      this.navbar.setStatus(true, health.data.model, health.data.device);
      await this.refreshSaeStatusUi();

      if (arithmeticPrefs.lastResult) {
        this.applyArithmeticResult(arithmeticPrefs.lastResult);
      } else {
        await this.handleCalculateArithmetic(
          arithmeticPrefs.wordA,
          arithmeticPrefs.wordB,
          arithmeticPrefs.wordC,
          arithmeticPrefs.topK,
        );
      }
    } else {
      state.setBackendConnected(false);
      this.navbar.setStatus(false);
      this.modal.show(
        "BACKEND OFFLINE",
        "The FastAPI backend is not reachable. Start the stack with `./setup.sh` (option 1), or open this app from a running Hugging Face Space."
      );
    }

    // Start render animation loop
    this.animate();
  }

  /**
   * Apply an arithmetic API payload to state + 3D + results list (no network).
   * @param {object} data
   */
  applyArithmeticResult(data) {
    if (!data || !data.vector_res) return;
    const payload = { ...data, featureSpace: data.featureSpace || 'RAW' };
    state.setArithmeticData(payload);
    const labels = this.instancer.renderArithmeticData(
      payload,
      state.renderMode,
      this.sliderConfig,
      this.viewMode,
      this.vizConfig
    );
    this.threadLabels.setLabels(labels);
    this.sidebar.updateResults(payload.results || []);
  }

  /** Sync SAE status/metrics strip on Compare panel only. */
  async refreshSaeStatusUi() {
    try {
      const next = await this.provider.saeStatus();
      // Keep last-known status on transient failures (nulling made the UI look stuck
      // at "Starting SAE training…" while _saeTrainBusy stayed true).
      if (next) this.saeStatus = next;
    } catch {
      /* keep this.saeStatus */
    }
    this.applySaeStatusToPanels();
  }

  applySaeStatusToPanels() {
    const status = this.saeStatus;
    const trained = !!(status && status.is_trained);
    const training = status?.training || {};
    const trainState = training.status;
    const progress = formatSaeTrainProgress(training);
    const busy = !!this._saeTrainBusy || progress.busy;
    const elapsedSec = (busy && this._saeTrainStartedAt)
      ? Math.max(0, Math.floor((Date.now() - this._saeTrainStartedAt) / 1000))
      : 0;

    let line = 'SAE not trained — train on current scope';
    if (busy) {
      line = progress.label;
    } else if (trainState === 'failed') {
      line = `Train failed: ${training.error_message || 'unknown error'}`;
    } else if (trained) {
      const cfg = status.config || {};
      const n = status.metrics?.total_vectors ?? training.n_vectors;
      const saved = status.persisted ? 'saved' : 'in memory';
      line = `SAE ready (${saved}) — ${cfg.hidden_dim || '?'}D · k=${cfg.k ?? '?'}`
        + (n != null ? ` · n=${n}` : '');
    }

    const metrics = trained && !busy
      ? {
          trainMse: status.metrics?.mse,
          deadFeaturesPct: status.metrics?.dead_features_pct,
        }
      : null;

    const ui = this.comparePanel.saeUi;
    ui.setStatus(line);
    ui.setTrainBusy(busy, { trained });
    if (!busy) {
      ui.setTrainLabel(trained);
    }
    if (busy) {
      const elapsedBit = ` · working ${elapsedSec}s`;
      ui.setProgress({
        visible: true,
        label: progress.label,
        meta: `${progress.meta}${elapsedBit}`,
        current: progress.current,
        total: progress.total,
        percent: progress.percent,
        indeterminate: progress.indeterminate || progress.percent < 2,
      });
    } else {
      ui.setProgress({ visible: false });
    }
    ui.setMetrics(metrics);
    if (!busy) {
      ui.syncFromSettings();
    }
  }

  /**
   * Compare-scope embeddings for Train SAE (RAW cache preferred).
   * @returns {number[][]|null}
   */
  getCurrentScopeEmbeddings() {
    const raw = this.rawCompareData || state.compareData;
    if (!raw?.items?.length) return null;
    return collectCompareEmbeddings(raw);
  }

  /**
   * Compare Visualize changed data — keep saved SAE; optionally re-encode if toggle ON.
   */
  async onCompareDataRefreshed() {
    if (!this.saeSettings.enabled) return;
    if (!this.saeStatus?.is_trained) await this.refreshSaeStatusUi();
    if (this.saeStatus?.is_trained && this.rawCompareData) {
      await this.encodeCompareWithSae({ reframe: false });
    }
  }

  async handleSaeTrain(settings) {
    if (state.workspaceMode !== 'COMPARE') {
      this.modal.show('COMPARE ONLY', 'Train SAE is available in Token Comparison mode.');
      return;
    }
    if (this._saeTrainBusy) return;

    if (!this.saeStatus) await this.refreshSaeStatusUi();
    const alreadyTrained = !!(this.saeStatus && this.saeStatus.is_trained);
    if (alreadyTrained) {
      const ok = await this.modal.confirm(
        'RETRAIN SAE',
        'Delete the saved SAE checkpoint and train again on the current Compare scope?',
        { confirmLabel: 'Delete & Retrain', cancelLabel: 'Cancel' }
      );
      if (!ok) return;
      try {
        await this.provider.saeClear();
      } catch (e) {
        this.modal.show('SAE CLEAR ERROR', e.message || 'Could not delete saved SAE.');
        return;
      }
      this.saeStatus = {
        ...(this.saeStatus || {}),
        is_trained: false,
        persisted: false,
        config: null,
        metrics: null,
      };
      if (this.saeSettings.enabled) {
        this.saeSettings = { ...this.saeSettings, enabled: false };
        saveSaeSettings(this.saeSettings);
        this.comparePanel.saeUi.setToggleEnabled(false);
        this.restoreRawWorkspace({ reframe: false });
      }
      this.applySaeStatusToPanels();
    }

    const embeddings = this.getCurrentScopeEmbeddings();
    if (!embeddings || embeddings.length < 2) {
      this.modal.show(
        'NO SCOPE DATA',
        'Visualize first, then Train SAE on those tokens.'
      );
      return;
    }

    const epochs = settings.epochs;
    this._saeTrainBusy = true;
    this._saeTrainStartedAt = Date.now();
    this._startSaeTrainElapsedTicker();
    this.saeStatus = {
      ...(this.saeStatus || {}),
      is_trained: false,
      training: {
        status: 'training',
        phase_key: 'preparing',
        message: `Starting train — ${embeddings.length} vectors · up to ${epochs} epochs…`,
        current_epoch: 0,
        total_epochs: epochs,
        remaining_epochs: epochs,
        percent: 0,
        n_vectors: embeddings.length,
      },
    };
    this.applySaeStatusToPanels();
    // Poll ASAP — do not wait for POST /train to return (large JSON body can stall;
    // if the job already started on the server we still need live %).
    this._saeTrainSeenRunning = false;
    this._saeTrainPostDone = false;
    this._startSaeTrainPolling();

    try {
      const started = await this.provider.saeTrain({
        embeddings,
        hidden_dim: settings.hiddenDim,
        k: settings.k,
        epochs,
        lr: settings.lr,
        batch_size: settings.batchSize,
        auto_scale: true,
      });
      this._saeTrainPostDone = true;
      const resolvedHidden = started.resolved_hidden ?? settings.hiddenDim;
      const resolvedK = started.resolved_k ?? settings.k;
      const resolvedEpochs = started.resolved_epochs ?? epochs;
      const device = started.device || 'auto';
      // Only overwrite if poll has not already moved past preparing/success.
      const live = this.saeStatus?.training?.status;
      if (live !== 'success' && live !== 'failed') {
        this.saeStatus = {
          ...(this.saeStatus || {}),
          training: {
            ...(this.saeStatus?.training || {}),
            status: 'training',
            phase_key: 'preparing',
            message: started.auto_scaled
              ? `Auto-scaled ${resolvedHidden}D·k=${resolvedK}·${resolvedEpochs}ep on ${device} — n=${started.n_vectors}…`
              : `Preparing train — n=${started.n_vectors} · ${resolvedHidden}D · k=${resolvedK} · ${resolvedEpochs}ep on ${device}…`,
            current_epoch: 0,
            total_epochs: resolvedEpochs,
            remaining_epochs: resolvedEpochs,
            percent: 0,
            n_vectors: started.n_vectors,
            resolved_hidden: resolvedHidden,
            resolved_k: resolvedK,
          },
        };
        this.applySaeStatusToPanels();
      }
    } catch (e) {
      // If a job is already running, keep polling instead of hard-failing the UI.
      const msg = e.message || '';
      if (/already in progress/i.test(msg)) {
        this._saeTrainPostDone = true;
        this._startSaeTrainPolling();
        return;
      }
      this._stopSaeTrainBusy();
      this.comparePanel.saeUi.setProgress({ visible: false });
      this.modal.show('SAE TRAIN ERROR', msg || 'Could not start SAE training.');
      await this.refreshSaeStatusUi();
    }
  }

  _startSaeTrainElapsedTicker() {
    if (this._saeTrainElapsedTimer) clearInterval(this._saeTrainElapsedTimer);
    this._saeTrainElapsedTimer = setInterval(() => {
      if (!this._saeTrainBusy) {
        this._stopSaeTrainElapsedTicker();
        return;
      }
      this.applySaeStatusToPanels();
    }, 500);
  }

  _stopSaeTrainElapsedTicker() {
    if (this._saeTrainElapsedTimer) {
      clearInterval(this._saeTrainElapsedTimer);
      this._saeTrainElapsedTimer = null;
    }
  }

  _stopSaeTrainBusy() {
    this._saeTrainBusy = false;
    this._saeTrainStartedAt = 0;
    this._stopSaeTrainElapsedTicker();
    if (this._saeTrainPollTimer) {
      clearInterval(this._saeTrainPollTimer);
      this._saeTrainPollTimer = null;
    }
    this._saeTrainPollInFlight = false;
    this._saeTrainSeenRunning = false;
    this._saeTrainPostDone = false;
    const trained = !!(this.saeStatus && this.saeStatus.is_trained);
    this.comparePanel.saeUi.setTrainBusy(false, { trained });
  }

  _startSaeTrainPolling() {
    if (this._saeTrainPollTimer) clearInterval(this._saeTrainPollTimer);
    this._saeTrainPollInFlight = false;
    const tick = async () => {
      if (this._saeTrainPollInFlight) return;
      this._saeTrainPollInFlight = true;
      try {
        await this.refreshSaeStatusUi();
        const st = this.saeStatus?.training?.status;
        if (st === 'training') this._saeTrainSeenRunning = true;
        // Do not treat pre-POST "idle" (after clear) as completion.
        const terminal = st === 'success' || st === 'failed';
        const readyToFinish = terminal && (this._saeTrainSeenRunning || this._saeTrainPostDone);
        if (readyToFinish) {
          if (this._saeTrainPollTimer) {
            clearInterval(this._saeTrainPollTimer);
            this._saeTrainPollTimer = null;
          }
          const wasBusy = this._saeTrainBusy;
          this._stopSaeTrainBusy();
          this.applySaeStatusToPanels();
          if (wasBusy && st === 'success' && this.saeSettings.enabled) {
            await this.encodeCompareWithSae({ reframe: true });
          }
        }
      } finally {
        this._saeTrainPollInFlight = false;
      }
    };
    // Immediate tick so we don't wait 250ms stuck on "Starting…"
    tick();
    this._saeTrainPollTimer = setInterval(tick, 250);
  }

  async handleSaeToggle(enabled) {
    this.saeSettings = { ...this.saeSettings, enabled };
    saveSaeSettings(this.saeSettings);
    this.comparePanel.saeUi.syncFromSettings();

    if (!enabled) {
      if (isGalaxyView(this.viewMode)) {
        this.clearSaeFraming();
        this.restoreSaeFilterOverride();
        if (this.rawCompareData) {
          state.setCompareData(cloneCompareRaw(this.rawCompareData));
          this.comparePanel.updateCompareResults(state.compareData);
        }
        this.applySaeStatusToPanels();
        await this.runGalaxyPipelineFromApp({ preferCache: true });
        return;
      }
      this.restoreRawWorkspace({ reframe: true });
      return;
    }

    if (state.workspaceMode !== 'COMPARE') {
      this.modal.show('COMPARE ONLY', 'Clean/Denoise (SAE) is available in Token Comparison mode.');
      this.saeSettings = { ...this.saeSettings, enabled: false };
      saveSaeSettings(this.saeSettings);
      this.comparePanel.saeUi.setToggleEnabled(false);
      return;
    }

    const trained = this.saeStatus?.is_trained;
    if (!trained) {
      await this.refreshSaeStatusUi();
    }
    if (!this.saeStatus?.is_trained) {
      this.modal.show('SAE NOT TRAINED', 'Train SAE first');
      this.saeSettings = { ...this.saeSettings, enabled: false };
      saveSaeSettings(this.saeSettings);
      this.comparePanel.saeUi.setToggleEnabled(false);
      return;
    }

    if (!this.rawCompareData) {
      this.modal.show('NO DATA', 'Visualize first');
      this.saeSettings = { ...this.saeSettings, enabled: false };
      saveSaeSettings(this.saeSettings);
      this.comparePanel.saeUi.setToggleEnabled(false);
      return;
    }

    if (isGalaxyView(this.viewMode)) {
      await this.runGalaxyPipelineFromApp({ preferCache: true });
      return;
    }

    await this.encodeCompareWithSae({ reframe: true });
  }

  /**
   * Stretch dim-axis pitch so SAE feature count ≈ RAW wall width.
   * @param {object} saeData
   * @param {object} rawData
   */
  applySaeDimSpan(saeData, rawData) {
    const rawDim = inferRawDim(rawData);
    const saeDim = inferSaeDim(saeData);
    const span = computeDimSpanScale(rawDim, saeDim);
    this.instancer.setDimSpanScale(span);
    if (!this._preSaeThreadWidth) {
      this._preSaeThreadWidth = this.sliderConfig.threadWidth;
    }
    // Length (Z): gentle boost so NAVIGATION depth stays readable (cap within slider max)
    const boostedWidth = Math.min(0.2, (this._preSaeThreadWidth || 0.1) * Math.min(span, 4));
    this.sliderConfig.threadWidth = boostedWidth;
    if (this.slidersEl) {
      syncThreadSlidersFromConfig(this.slidersEl, this.sliderConfig);
    }
  }

  /**
   * Dim-span scale + soft camera frame after SAE toggle ON.
   * @param {object} saeData
   * @param {object} rawData
   */
  async frameAfterSaeEncode(saeData, rawData) {
    this.applySaeDimSpan(saeData, rawData);
    this.refreshRender();

    const box = this.instancer.getContentBoundingBox();
    if (!box.isEmpty()) {
      await this.navigation.animateToFitBox(box, {
        viewMode: this.viewMode,
        durationMs: 480,
      });
    }
  }

  /**
   * Apply Visualization filter mode and sync right-dock radios + localStorage.
   * @param {string} mode
   */
  applyVizFilterMode(mode) {
    if (!this.vizConfig) return;
    this.vizConfig.vizFilterMode = mode;
    saveVisualizationSettings(this.vizConfig);
    if (this.vizEl) {
      syncVisualizationControlsFromConfig(this.vizEl, this.vizConfig);
    }
  }

  /**
   * D3: on SAE encode success, force + Only (snapshot once per SAE ON session).
   */
  applySaeOnFilterOverride() {
    if (!this._saeFilterSnapshot) {
      this._saeFilterSnapshot = snapshotFilterForSae(this.vizConfig?.vizFilterMode);
    }
    this.applyVizFilterMode(filterModeForSaeOn());
  }

  /**
   * D4: restore pre-SAE filter when leaving SAE.
   */
  restoreSaeFilterOverride() {
    const restored = restoreFilterAfterSae(this._saeFilterSnapshot);
    this._saeFilterSnapshot = null;
    if (restored != null) {
      this.applyVizFilterMode(restored);
    }
  }

  clearSaeFraming() {
    this.instancer.setDimSpanScale(1);
    if (this._preSaeThreadWidth != null) {
      this.sliderConfig.threadWidth = this._preSaeThreadWidth;
      this._preSaeThreadWidth = null;
      if (this.slidersEl) {
        syncThreadSlidersFromConfig(this.slidersEl, this.sliderConfig);
      }
    }
  }

  restoreRawWorkspace({ reframe = false } = {}) {
    this.clearSaeFraming();
    this.restoreSaeFilterOverride();
    if (this.rawCompareData) {
      state.setCompareData(cloneCompareRaw(this.rawCompareData));
      this.comparePanel.updateCompareResults(state.compareData);
    }
    this.refreshRender();
    this.applySaeStatusToPanels();
    if (reframe) {
      const pose = resolveCameraPose({
        workspaceMode: state.workspaceMode,
        viewMode: this.viewMode,
        renderMode: state.renderMode,
      });
      this.navigation.animateToPose(pose, 480);
    }
  }

  _setSaeProgress(opts) {
    this.comparePanel.saeUi.setProgress(opts);
  }

  async encodeCompareWithSae({ reframe = false } = {}) {
    if (!this.rawCompareData) return;
    if (isGalaxyView(this.viewMode)) {
      await this.runGalaxyPipelineFromApp({ preferCache: true });
      return;
    }
    try {
      const embeddings = collectCompareEmbeddings(this.rawCompareData);
      const n = embeddings.length;
      this._setSaeProgress({ visible: true, label: 'Loading SAE…', current: 0, total: n || 1 });
      this._setSaeProgress({
        visible: true,
        label: `Encoding (0/${n})…`,
        current: 0,
        total: n || 1,
      });
      const encoded = await this.provider.saeEncode(embeddings);
      this._setSaeProgress({
        visible: true,
        label: 'Updating 3D + metrics…',
        current: n,
        total: n || 1,
      });
      const saeData = applySaeToCompare(this.rawCompareData, encoded.activations);
      // Re-assert group meta from RAW cache (survives any stale state.compareData keys)
      if (this.rawCompareData?.items) {
        saeData.items = saeData.items.map((item, i) => {
          const raw = this.rawCompareData.items[i];
          if (!raw) return item;
          return {
            ...item,
            groupId: raw.groupId,
            groupLabel: raw.groupLabel,
          };
        });
      }
      state.setCompareData(saeData);
      this.comparePanel.updateCompareResults(saeData);
      this.applySaeOnFilterOverride();

      if (reframe) {
        await this.frameAfterSaeEncode(saeData, this.rawCompareData);
      } else {
        this.applySaeDimSpan(saeData, this.rawCompareData);
        this.refreshRender();
      }

      const batch = encoded.batch_metrics || computeActivationMetrics(encoded.activations);
      const trainMetrics = this.saeStatus?.metrics || {};
      this.comparePanel.saeUi.setMetrics({
        l0: batch.l0,
        sparsity: batch.sparsity,
        activeFeatures: batch.active_features ?? batch.activeFeatures,
        trainMse: trainMetrics.mse,
        deadFeaturesPct: trainMetrics.dead_features_pct,
      });
    } catch (e) {
      this.modal.show('SAE ENCODE ERROR', e.message || 'Could not encode with SAE.');
      this.saeSettings = { ...this.saeSettings, enabled: false };
      saveSaeSettings(this.saeSettings);
      this.comparePanel.saeUi.setToggleEnabled(false);
      this.restoreRawWorkspace();
    } finally {
      this._setSaeProgress({ visible: false });
    }
  }

  async handleCalculateArithmetic(wordA, wordB, wordC, topK) {
    try {
      const data = await this.provider.computeArithmetic(wordA, wordB, wordC, topK);
      data.featureSpace = 'RAW';
      this.applyArithmeticResult(data);
      saveArithmeticSettings({
        wordA,
        wordB,
        wordC,
        topK: topK ?? 10,
        lastResult: data,
      });
    } catch (e) {
      this.modal.show("ARITHMETIC ERROR", e.message || "Could not compute vector arithmetic.");
    }
  }

  async handleCalculateCompare(tokens, tokenMeta = null) {
    if (isGalaxyView(this.viewMode)) {
      try {
        await this.runGalaxyPipelineFromApp({
          texts: tokens,
          tokenMeta,
          preferCache: true,
        });
      } catch (e) {
        this.modal.show("COMPARE ERROR", e.message || "Could not compute token sequence comparison.");
      }
      return;
    }

    try {
      const data = await this.provider.computeCompare(tokens);
      const withMeta = attachCompareGroupMeta(data, tokenMeta);
      this.rawCompareData = cloneCompareRaw(withMeta);
      withMeta.featureSpace = 'RAW';
      this.galaxyPositions = null;
      this._galaxyCompareCache = {
        fingerprint: compareTextsFingerprint(tokens),
        itemCount: tokens.length,
        rawData: this.rawCompareData,
      };
      state.setCompareData(withMeta);
      this.comparePanel.updateCompareResults(withMeta);

      const labels = this.instancer.renderCompareData(
        withMeta,
        state.renderMode,
        this.sliderConfig,
        this.viewMode,
        this.vizConfig,
        { dimSortByContrast: this.dimSortByContrast }
      );
      this.setCompareOverlayLabels(labels);
      await this.onCompareDataRefreshed();
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

    if (isGalaxyView(this.viewMode) && Array.isArray(this.galaxyPositions)) {
      const oldItems = state.compareData?.items || [];
      const posById = new Map();
      oldItems.forEach((it, i) => {
        if (this.galaxyPositions[i]) posById.set(it.id, this.galaxyPositions[i]);
      });
      const nextPos = payload.items.map((it) => posById.get(it.id)).filter(Boolean);
      this.galaxyPositions = nextPos.length === payload.items.length
        ? nextPos
        : null;
    }

    state.setCompareData({
      ...(state.compareData || {}),
      count: payload.count,
      anchor: payload.anchor,
      items: payload.items,
    });

    // Keep raw cache order in sync so SAE OFF / re-encode match list order
    if (this.rawCompareData?.items) {
      const byId = new Map(this.rawCompareData.items.map((it) => [it.id, it]));
      const reorderedRaw = payload.items
        .map((it) => byId.get(it.id))
        .filter(Boolean);
      if (reorderedRaw.length === this.rawCompareData.items.length) {
        this.rawCompareData = {
          ...this.rawCompareData,
          count: reorderedRaw.length,
          anchor: {
            index: 0,
            text: reorderedRaw[0]?.text,
          },
          items: reorderedRaw.map((it, index) => {
            const emb = it.embedding;
            const anchorEmb = reorderedRaw[0].embedding;
            let cosine = 1;
            if (index > 0 && emb && anchorEmb) {
              let dot = 0;
              let na = 0;
              let nb = 0;
              for (let i = 0; i < emb.length; i++) {
                dot += emb[i] * anchorEmb[i];
                na += emb[i] * emb[i];
                nb += anchorEmb[i] * anchorEmb[i];
              }
              const denom = Math.sqrt(na) * Math.sqrt(nb);
              cosine = denom < 1e-12 ? 0 : dot / denom;
            }
            return { ...it, index, cosine_vs_first: cosine };
          }),
        };
      }
    }

    if (isGalaxyView(this.viewMode)) {
      this.refreshRender();
      return;
    }

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

    // Thread labels projected against canvas host (not full window)
    const { width, height } = resolveCanvasSize(this.canvasHost);
    this.threadLabels.update(this.sceneSetup.camera, width, height);

    // Render 3D Scene
    this.sceneSetup.render();
  }
}

export { AmigaApp };
