/**
 * VHectorLab-3D v25 canvas host — mounts existing Three.js engine into the
 * center zone. Startup triad: ARITHMETIC | ANALYSIS | POINTS.
 * No math/shader fork — imports from src/engine + src/visualizer.
 */
import * as THREE from 'three';
import { Interaction } from '../engine/Interaction.js';
import { Navigation } from '../engine/Navigation.js';
import { SceneSetup } from '../engine/SceneSetup.js';
import {
  DEFAULT_RENDER_MODE,
  DEFAULT_VIEW_MODE,
  DEFAULT_WORKSPACE_MODE,
} from '../ui/appViewDefaults.js';
import {
  formatActivationValue,
  resolveHoverTelemetry,
} from '../ui/hoverTelemetry.js';
import { resolveSpatialDefaults } from '../ui/spatialSliderDefaults.js';
import { ThreadLabels } from '../ui/ThreadLabels.js';
import { DEFAULT_VISUALIZATION_SETTINGS } from '../ui/visualizationControlsDefaults.js';
import { Instancer } from '../visualizer/Instancer.js';

/**
 * Fixed startup context for Fase 8 (header tabs remain UI-only).
 * @returns {{ workspaceMode: string, viewMode: string, renderMode: string }}
 */
export function canvasStartupContext() {
  return {
    workspaceMode: DEFAULT_WORKSPACE_MODE,
    viewMode: DEFAULT_VIEW_MODE,
    renderMode: DEFAULT_RENDER_MODE,
  };
}

/**
 * @param {{ clientWidth?: number, clientHeight?: number } | null | undefined} el
 * @returns {{ width: number, height: number }}
 */
export function resolveCanvasSize(el) {
  const width = Math.max(1, Math.floor(Number(el?.clientWidth) || 0));
  const height = Math.max(1, Math.floor(Number(el?.clientHeight) || 0));
  return { width, height };
}

/**
 * Map Interaction hover payload → footer HUD strings (minimal telemetry).
 * @param {object|null|undefined} hoverData
 * @returns {{ coords: string, segment: string, activation: string, token: string }}
 */
export function formatHoverForFooter(hoverData) {
  const t = resolveHoverTelemetry(hoverData);
  if (!t) {
    return {
      coords: 'X: -- | Y: -- | Z: --',
      segment: 'NEUTRAL SPACE',
      activation: 'ACTIVATION: --',
      token: 'NONE',
    };
  }
  const pos = t.point || { x: 0, y: 0, z: 0 };
  return {
    coords: `X: ${Math.round(pos.x)} | Y: ${Math.round(pos.y)} | Z: ${Math.round(pos.z)}`,
    segment: t.type,
    activation: `ACTIVATION: ${formatActivationValue(t.activation, { maxChars: 16 })}`,
    token: t.token,
  };
}

/**
 * @param {HTMLElement} container  `[data-zone="canvas"]`
 * @param {{ onHover?: (payload: ReturnType<typeof formatHoverForFooter>) => void }} [options]
 */
export function mountCanvasHost(container, options = {}) {
  if (!container) throw new Error('mountCanvasHost requires a container');

  container.innerHTML = '';
  container.classList.add('lab-canvas-host');

  const ctx = canvasStartupContext();
  const spatialConfig = resolveSpatialDefaults(ctx);
  const vizConfig = { ...DEFAULT_VISUALIZATION_SETTINGS };

  const sceneSetup = new SceneSetup(container);
  sceneSetup.setFogForRenderMode(ctx.renderMode);

  const resizeToHost = () => {
    const { width, height } = resolveCanvasSize(container);
    sceneSetup.camera.aspect = width / height;
    sceneSetup.camera.updateProjectionMatrix();
    sceneSetup.renderer.setSize(width, height, false);
  };
  // Override legacy window-sized resize so the MPA host stays the sizing source.
  sceneSetup.onWindowResize = resizeToHost;
  resizeToHost();

  const navigation = new Navigation(
    sceneSetup.camera,
    sceneSetup.renderer.domElement,
  );
  navigation.setContextView(ctx);

  const instancer = new Instancer(sceneSetup.scene);
  const interaction = new Interaction(
    sceneSetup.camera,
    sceneSetup.scene,
    sceneSetup.renderer.domElement,
  );
  const threadLabels = new ThreadLabels(container);
  threadLabels.setVisible(vizConfig.labelsVisible);

  const onHover =
    typeof options.onHover === 'function' ? options.onHover : null;
  interaction.onHoverCallback = (hoverData) => {
    if (!onHover) return;
    onHover(formatHoverForFooter(hoverData));
  };

  const clock = new THREE.Clock();
  let rafId = 0;
  let disposed = false;

  const animate = () => {
    if (disposed) return;
    rafId = requestAnimationFrame(animate);
    const delta = clock.getDelta();
    navigation.update(delta);
    interaction.update(instancer.getInteractiveObjects());
    const { width, height } = resolveCanvasSize(container);
    threadLabels.update(sceneSetup.camera, width, height);
    sceneSetup.render();
  };

  let resizeObserver = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => resizeToHost());
    resizeObserver.observe(container);
  }

  animate();

  return {
    context: ctx,
    /**
     * @param {object} arithmeticPayload  full `/api/arithmetic` body (needs vector_res)
     */
    renderArithmetic(arithmeticPayload) {
      if (!arithmeticPayload?.vector_res) return null;
      const payload = {
        ...arithmeticPayload,
        featureSpace: arithmeticPayload.featureSpace || 'RAW',
      };
      const labels = instancer.renderArithmeticData(
        payload,
        ctx.renderMode,
        spatialConfig,
        ctx.viewMode,
        vizConfig,
      );
      threadLabels.setLabels(labels);
      return labels;
    },
    resize: resizeToHost,
    dispose() {
      disposed = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (resizeObserver) resizeObserver.disconnect();
      instancer.clear();
      threadLabels.clear();
      const canvas = sceneSetup.renderer?.domElement;
      if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
      sceneSetup.renderer?.dispose();
    },
  };
}
