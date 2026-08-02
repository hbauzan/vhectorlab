import * as THREE from 'three';
import { SceneSetup } from './engine/SceneSetup.js';
import { Navigation } from './engine/Navigation.js';
import { Interaction } from './engine/Interaction.js';
import { Instancer } from './visualizer/Instancer.js';
import { AxisGizmo } from './visualizer/AxisGizmo.js';
import { RemoteProvider } from './core/RemoteProvider.js';
import { state } from './core/State.js';
import {
  applySaeToCompare,
  cloneCompareRaw,
  collectCompareEmbeddings,
} from './core/saeReplace.js';
import {
  computeDimSpanScale,
  inferRawDim,
  inferSaeDim,
} from './core/saeFraming.js';
import { resolveCameraPose } from './engine/cameraViewDefaults.js';
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
  readVisualizationPanelCollapsed,
} from './ui/VisualizationControls.js';
import { loadVisualizationSettings } from './ui/visualizationControlsDefaults.js';
import {
  loadSaeSettings,
  saveSaeSettings,
  computeActivationMetrics,
  formatSaeTrainProgress,
} from './ui/saeControlsDefaults.js';
import { ComparePanel, COMPARE_AUTO_PRESETS } from './ui/ComparePanel.js';
import { CollapsibleDock, isMobileViewport } from './ui/CollapsibleDock.js';
import { LandscapeGate } from './ui/LandscapeGate.js';
import { TouchControls } from './ui/TouchControls.js';
import {
  attachCompareGroupMeta,
  enrichLabelsWithGroupMeta,
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

    const saeHooks = {
      onSaeToggle: (enabled) => this.handleSaeToggle(enabled),
      onSaeTrain: (settings) => this.handleSaeTrain(settings),
      getSaeSettings: () => this.saeSettings,
      setSaeSettings: (s) => {
        this.saeSettings = s;
        saveSaeSettings(s);
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
    const storage = typeof localStorage !== 'undefined' ? localStorage : null;
    const collapsed = readVisualizationPanelCollapsed(storage, {
      isMobile: isMobileViewport(),
    });
    const wrapper = document.createElement('div');
    wrapper.innerHTML = visualizationControlsMarkup(this.vizConfig, { collapsed });
    const vizEl = wrapper.firstElementChild;
    this.vizEl = vizEl;
    // Below sliders, above AxisGizmo (V1).
    this.rightDock.body.insertBefore(vizEl, this.axisGizmo.container);

    wireVisualizationControls(vizEl, this.vizConfig, () => {
      this.threadLabels.setVisible(this.vizConfig.labelsVisible);
      this.refreshRender();
    });
    this.threadLabels.setVisible(this.vizConfig.labelsVisible);
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
        const labels = this.instancer.renderCompareData(
          data,
          state.renderMode,
          this.sliderConfig,
          this.viewMode,
          this.vizConfig
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
      await this.refreshSaeStatusUi();
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
      state.setArithmeticData(data);

      const labels = this.instancer.renderArithmeticData(
        data,
        state.renderMode,
        this.sliderConfig,
        this.viewMode,
        this.vizConfig
      );
      this.threadLabels.setLabels(labels);
      this.sidebar.updateResults(data.results);
    } catch (e) {
      this.modal.show("ARITHMETIC ERROR", e.message || "Could not compute vector arithmetic.");
    }
  }

  async handleCalculateCompare(tokens, tokenMeta = null) {
    try {
      const data = await this.provider.computeCompare(tokens);
      const withMeta = attachCompareGroupMeta(data, tokenMeta);
      this.rawCompareData = cloneCompareRaw(withMeta);
      withMeta.featureSpace = 'RAW';
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
