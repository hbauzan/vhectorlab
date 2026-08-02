import * as THREE from 'three';
import { MeshFactory } from './MeshFactory.js';
import { LayoutEngine } from './LayoutEngine.js';
import { arithmeticThreadLabel } from '../ui/threadLabelFormat.js';

/**
 * Instancer Manager for rendering vector points, ribbons, and highlights in the Three.js scene.
 */
export class Instancer {
  constructor(scene) {
    this.scene = scene;
    this.layoutEngine = new LayoutEngine();

    this.activeGroup = new THREE.Group();
    this.activeGroup.name = "VectorPointsGroup";
    this.scene.add(this.activeGroup);

    this.renderMode = "POINTS"; // "POINTS" | "MESH" | "RIBBONS"
    this.currentData = null;

    /** @type {null|{ viewMode: string, totalThreads: number, spacingY: number, amplitudeY: number, pointsMesh: THREE.Points|null, baselineMesh: THREE.Line|null, threads: Array }} */
    this.compareRuntime = null;
    this._reorderRaf = null;
    this._reorderBusy = false;
  }

  clear() {
    if (this._reorderRaf != null) {
      if (typeof this._cancelReorderFrame === "function") {
        this._cancelReorderFrame(this._reorderRaf);
      } else if (typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(this._reorderRaf);
      } else {
        clearTimeout(this._reorderRaf);
      }
      this._reorderRaf = null;
    }
    this._reorderBusy = false;
    this.compareRuntime = null;

    while (this.activeGroup.children.length > 0) {
      const child = this.activeGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
      this.activeGroup.remove(child);
    }
  }

  /**
   * Renders the arithmetic vectors data: inputs A, B, C and result V_res.
   * @param {Object} arithmeticResponse - API response from /arithmetic
   * @param {string} renderMode - "POINTS" | "MESH" | "RIBBONS"
   * @param {Object} [spatialConfig] - Real-time spatial slider configuration { threadSpacing, threadWidth, threadThickness }
   * @param {string} [viewMode="NAVIGATION"] - "NAVIGATION" | "ANALYSIS"
   * @returns {Array<{ id: string, text: string, type: string, origin3D: THREE.Vector3 }>} Label metadata for origins
   */
  renderArithmeticData(arithmeticResponse, renderMode = "POINTS", spatialConfig = null, viewMode = "NAVIGATION") {
    this.clear();
    this.renderMode = renderMode;
    this.currentData = arithmeticResponse;

    if (spatialConfig) {
      if (spatialConfig.threadSpacing !== undefined) {
        this.layoutEngine.scaleX = spatialConfig.threadSpacing;
      }
      if (spatialConfig.threadWidth !== undefined) {
        this.layoutEngine.scaleZ = spatialConfig.threadWidth * 25.0;
      }
    }

    if (!arithmeticResponse || !arithmeticResponse.vector_res) return [];

    const thicknessFactor = (spatialConfig && spatialConfig.threadThickness !== undefined)
      ? spatialConfig.threadThickness
      : 0.3;

    const spacingY = (spatialConfig && (spatialConfig.threadVectorDistance !== undefined || spatialConfig.threadSpacingY !== undefined))
      ? (spatialConfig.threadVectorDistance ?? spatialConfig.threadSpacingY)
      : 46.0;

    const amplitudeY = (spatialConfig && spatialConfig.threadAmplitudeY !== undefined)
      ? spatialConfig.threadAmplitudeY
      : 16.0;

    const pointsData = [];
    const threadLabelItems = [];
    /** @type {Array<{ points: THREE.Vector3[], activations: number[] }>} */
    const surfaceRows = [];

    const pushThread = (id, text, type, vec, sequenceIdx) => {
      if (!vec || !vec.length) return;
      const pts = this.layoutEngine.mapVectorTo3DPoints(vec, sequenceIdx, viewMode, 5, spacingY, amplitudeY);
      const activations = [];
      pts.forEach((p, idx) => {
        const val = vec[idx];
        pointsData.push({
          position: p,
          activation: val,
          size: 10.0 * thicknessFactor,
          meta: { type: id, dim: idx, val },
        });
        activations.push(val);
      });
      surfaceRows.push({ points: pts, activations });
      if (pts.length > 0) {
        threadLabelItems.push({ id, text, type, origin3D: pts[0] });
      }
    };

    const compKeys = ["vec_a", "vec_b", "vec_c"];
    const compLabels = [
      arithmeticThreadLabel('A'),
      arithmeticThreadLabel('B'),
      arithmeticThreadLabel('C'),
    ];

    if (arithmeticResponse.components) {
      compKeys.forEach((key, kIdx) => {
        const compVec = arithmeticResponse.components[key];
        if (compVec && compVec.length) {
          const sequenceIdx = viewMode === "ANALYSIS" ? kIdx : (kIdx + 1) * 2;
          pushThread(key, compLabels[kIdx], `word_${String.fromCharCode(97 + kIdx)}`, compVec, sequenceIdx);
        }
      });
    }

    const vecRes = arithmeticResponse.vector_res;
    const resSequenceIdx = viewMode === "ANALYSIS" ? 3 : 0;
    pushThread("res", arithmeticThreadLabel('RES'), "res", vecRes, resSequenceIdx);

    const top1Vec = (arithmeticResponse.components && arithmeticResponse.components.vec_top1)
      ? arithmeticResponse.components.vec_top1
      : vecRes;
    const top1SequenceIdx = viewMode === "ANALYSIS" ? 4 : 8;
    pushThread("top1", arithmeticThreadLabel('TOP1'), "top_1", top1Vec, top1SequenceIdx);

    if (viewMode === "ANALYSIS" && threadLabelItems.length >= 2) {
      const baselineMesh = MeshFactory.createBaselineMesh(
        threadLabelItems.map((item) => item.origin3D),
        0x00e5ff
      );
      if (baselineMesh) this.activeGroup.add(baselineMesh);
    }

    this._mountRenderModeGeometry(renderMode, surfaceRows, pointsData, thicknessFactor);
    return threadLabelItems;
  }

  /**
   * Mount POINTS | MESH | RIBBONS geometry (mutually exclusive).
   * @private
   */
  _mountRenderModeGeometry(renderMode, surfaceRows, pointsData, thicknessFactor) {
    if (renderMode === "MESH") {
      const surface = MeshFactory.createSurfaceMesh(surfaceRows, {
        singleThreadWidth: Math.max(1.5, 8.0 * (thicknessFactor || 0.3)),
      });
      if (surface) this.activeGroup.add(surface);
      return;
    }

    if (renderMode === "RIBBONS") {
      // No base plane: translucent dark quad showed through ribbons as a hard dark rectangle.
      const ribbonWidth = Math.max(2.0, 14.0 * (thicknessFactor || 0.3));
      surfaceRows.forEach((row) => {
        const wide = MeshFactory.createWideRibbonMesh(row.points, row.activations, { width: ribbonWidth });
        if (wide) this.activeGroup.add(wide);
      });
      return;
    }

    // POINTS: thin continuity lines + point cloud
    surfaceRows.forEach((row) => {
      const ribbon = MeshFactory.createRibbonMesh(row.points, row.activations);
      this.activeGroup.add(ribbon);
    });
    if (pointsData.length) {
      const pointsMesh = MeshFactory.createPointsMesh(pointsData, { pointSize: 15.0 * thicknessFactor });
      pointsMesh.userData = { pointsData };
      this.activeGroup.add(pointsMesh);
    }
  }

  /**
   * Renders token/text sequence comparison data (1 to 1024 tokens).
   * @param {Object} compareResponse - API response from /compare
   * @param {string} renderMode - "POINTS" | "MESH" | "RIBBONS"
   * @param {Object} [spatialConfig] - Real-time spatial slider configuration
   * @param {string} [viewMode="NAVIGATION"] - "NAVIGATION" | "ANALYSIS"
   * @returns {Array<{ id: string, text: string, type: string, origin3D: THREE.Vector3 }>} Label metadata
   */
  renderCompareData(compareResponse, renderMode = "POINTS", spatialConfig = null, viewMode = "NAVIGATION") {
    this.clear();
    this.renderMode = renderMode;
    this.currentData = compareResponse;

    if (spatialConfig) {
      if (spatialConfig.threadSpacing !== undefined) {
        this.layoutEngine.scaleX = spatialConfig.threadSpacing;
      }
      if (spatialConfig.threadWidth !== undefined) {
        this.layoutEngine.scaleZ = spatialConfig.threadWidth * 25.0;
      }
    }

    if (!compareResponse || !compareResponse.items || compareResponse.items.length === 0) return [];

    const totalThreads = compareResponse.items.length;
    const thicknessFactor = (spatialConfig && spatialConfig.threadThickness !== undefined)
      ? spatialConfig.threadThickness
      : 0.3;

    const spacingY = (spatialConfig && (spatialConfig.threadVectorDistance !== undefined || spatialConfig.threadSpacingY !== undefined))
      ? (spatialConfig.threadVectorDistance ?? spatialConfig.threadSpacingY)
      : 46.0;

    const amplitudeY = (spatialConfig && spatialConfig.threadAmplitudeY !== undefined)
      ? spatialConfig.threadAmplitudeY
      : 16.0;

    const pointsData = [];
    const threadLabelItems = [];
    const threads = [];
    /** @type {Array<{ points: THREE.Vector3[], activations: number[] }>} */
    const surfaceRows = [];
    let pointOffset = 0;

    compareResponse.items.forEach((item, idx) => {
      const vec = item.embedding;
      if (!vec || !vec.length) return;

      const threadId = item.id || `tok_${idx}`;
      const vec3D = this.layoutEngine.mapVectorTo3DPoints(vec, idx, viewMode, totalThreads, spacingY, amplitudeY);
      const activations = [];

      vec3D.forEach((p, dimIdx) => {
        const val = vec[dimIdx];
        pointsData.push({
          position: p,
          activation: val,
          size: 10.0 * thicknessFactor,
          meta: { type: "compare", token: item.text, dim: dimIdx, val }
        });
        activations.push(val);
      });

      surfaceRows.push({ points: vec3D, activations });

      let ribbonMesh = null;
      if (renderMode === "RIBBONS") {
        const ribbonWidth = Math.max(2.0, 14.0 * thicknessFactor);
        ribbonMesh = MeshFactory.createWideRibbonMesh(vec3D, activations, { width: ribbonWidth });
      } else if (renderMode !== "MESH") {
        ribbonMesh = MeshFactory.createRibbonMesh(vec3D, activations);
      }
      if (ribbonMesh) {
        ribbonMesh.userData.threadId = threadId;
        this.activeGroup.add(ribbonMesh);
      }

      threads.push({
        id: threadId,
        text: item.text,
        embedding: vec,
        ribbonMesh,
        pointOffset,
        dimCount: vec.length,
        sequenceIndex: idx,
        _layoutPoints: vec3D,
      });
      pointOffset += vec.length;

      if (vec3D.length > 0) {
        threadLabelItems.push({
          id: threadId,
          text: item.text,
          type: "compare",
          origin3D: vec3D[0]
        });
      }
    });

    let baselineMesh = null;
    if (viewMode === "ANALYSIS" && threadLabelItems.length >= 2) {
      baselineMesh = MeshFactory.createBaselineMesh(
        threadLabelItems.map((item) => item.origin3D),
        0x00e5ff
      );
      if (baselineMesh) this.activeGroup.add(baselineMesh);
    }

    let pointsMesh = null;
    let surfaceMesh = null;
    if (renderMode === "MESH") {
      surfaceMesh = MeshFactory.createSurfaceMesh(surfaceRows, {
        singleThreadWidth: Math.max(1.5, 8.0 * thicknessFactor),
      });
      if (surfaceMesh) this.activeGroup.add(surfaceMesh);
    } else if (renderMode === "POINTS" && pointsData.length) {
      // RIBBONS must not mount the POINTS cloud (square Chebyshev dots on top of strips).
      pointsMesh = MeshFactory.createPointsMesh(pointsData, { pointSize: 15.0 * thicknessFactor });
      pointsMesh.userData = { pointsData };
      this.activeGroup.add(pointsMesh);
    }

    this.compareRuntime = {
      viewMode,
      totalThreads,
      spacingY,
      amplitudeY,
      pointsMesh,
      surfaceMesh,
      baselineMesh,
      threads,
      renderMode,
    };

    return threadLabelItems;
  }

  /**
   * Apply layout slot (supports fractional sequenceIndex for tweening) to one compare thread in-situ.
   * @returns {THREE.Vector3|null} origin for floating labels
   */
  _applyCompareThreadLayout(thread, sequenceIndex, runtime, { updateBounds = false } = {}) {
    const vec3D = this.layoutEngine.mapVectorTo3DPoints(
      thread.embedding,
      sequenceIndex,
      runtime.viewMode,
      runtime.totalThreads,
      runtime.spacingY,
      runtime.amplitudeY
    );
    if (!vec3D.length) return null;

    if (thread.ribbonMesh?.userData?.kind === "wideRibbon") {
      MeshFactory.updateWideRibbonMeshPositions(thread.ribbonMesh, vec3D);
    } else {
      const ribbonPos = thread.ribbonMesh?.geometry?.attributes?.position;
      if (ribbonPos) {
        for (let i = 0; i < vec3D.length; i++) {
          ribbonPos.setXYZ(i, vec3D[i].x, vec3D[i].y, vec3D[i].z);
        }
        ribbonPos.needsUpdate = true;
        if (updateBounds) thread.ribbonMesh.geometry.computeBoundingSphere();
      }
    }

    const pointsPos = runtime.pointsMesh?.geometry?.attributes?.position;
    if (pointsPos) {
      for (let i = 0; i < vec3D.length; i++) {
        pointsPos.setXYZ(thread.pointOffset + i, vec3D[i].x, vec3D[i].y, vec3D[i].z);
      }
      pointsPos.needsUpdate = true;
      if (updateBounds) runtime.pointsMesh.geometry.computeBoundingSphere();
    }

    thread._layoutPoints = vec3D;
    return vec3D[0];
  }

  _syncCompareBaseline(origins) {
    const runtime = this.compareRuntime;
    if (!runtime || runtime.viewMode !== "ANALYSIS" || !origins || origins.length < 2) return;

    if (runtime.baselineMesh) {
      this.activeGroup.remove(runtime.baselineMesh);
      runtime.baselineMesh.geometry?.dispose();
      runtime.baselineMesh.material?.dispose();
      runtime.baselineMesh = null;
    }

    const baselineMesh = MeshFactory.createBaselineMesh(origins, 0x00e5ff);
    if (baselineMesh) {
      this.activeGroup.add(baselineMesh);
      runtime.baselineMesh = baselineMesh;
    }
  }

  /**
   * Smoothly re-slot compare threads to match list order (reuse meshes; lerp layout ~200–400ms).
   * @param {string[]} orderedIds - Thread ids in the new list order
   * @param {{ duration?: number, onFrame?: Function }} [options]
   * @returns {Promise<Array>} Final label metadata
   */
  animateCompareReorder(orderedIds, options = {}) {
    const duration = options.duration ?? 320;
    const onFrame = options.onFrame;

    if (this._reorderBusy) {
      return Promise.reject(new Error("Compare reorder animation already in progress"));
    }

    const runtime = this.compareRuntime;
    if (!runtime || !runtime.threads.length) {
      return Promise.resolve([]);
    }

    const idToTarget = new Map(orderedIds.map((id, i) => [id, i]));
    const fromIdx = runtime.threads.map((t) => t.sequenceIndex);
    const toIdx = runtime.threads.map((t) => (
      idToTarget.has(t.id) ? idToTarget.get(t.id) : t.sequenceIndex
    ));

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    this._reorderBusy = true;
    const safeDuration = Math.max(0, Number(duration) || 0);
    const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    const scheduleFrame = (cb) => {
      if (typeof requestAnimationFrame === "function") {
        return requestAnimationFrame(cb);
      }
      return setTimeout(() => cb(nowMs()), 0);
    };
    const cancelFrame = (id) => {
      if (typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(id);
      } else {
        clearTimeout(id);
      }
    };

    return new Promise((resolve, reject) => {
      const start = nowMs();

      const tick = (now) => {
        try {
          const elapsed = now - start;
          const t = safeDuration <= 0 ? 1 : Math.min(1, elapsed / safeDuration);
          const eased = safeDuration <= 0 ? 1 : easeOutCubic(t);
          const labels = [];
          const origins = [];

          runtime.threads.forEach((thread, i) => {
            const seq = fromIdx[i] + (toIdx[i] - fromIdx[i]) * eased;
            const origin = this._applyCompareThreadLayout(thread, seq, runtime, {
              updateBounds: t >= 1,
            });
            if (origin) {
              origins.push(origin);
              labels.push({
                id: thread.id,
                text: thread.text,
                type: "compare",
                origin3D: origin,
              });
            }
            if (t >= 1) {
              thread.sequenceIndex = toIdx[i];
            }
          });

          this._syncCompareBaseline(origins);

          if (runtime.surfaceMesh) {
            const rows = runtime.threads.map((thread) => ({
              points: thread._layoutPoints || [],
            }));
            MeshFactory.updateSurfaceMeshPositions(runtime.surfaceMesh, rows);
          }

          if (onFrame) onFrame(labels);

          if (t < 1) {
            this._reorderRaf = scheduleFrame(tick);
          } else {
            this._reorderRaf = null;
            this._reorderBusy = false;
            if (this.currentData && Array.isArray(orderedIds)) {
              const byId = new Map((this.currentData.items || []).map((item) => [item.id, item]));
              this.currentData = {
                ...this.currentData,
                items: orderedIds.map((id, index) => {
                  const item = byId.get(id);
                  return item ? { ...item, index } : item;
                }).filter(Boolean),
              };
            }
            resolve(labels);
          }
        } catch (err) {
          this._reorderRaf = null;
          this._reorderBusy = false;
          reject(err);
        }
      };

      this._cancelReorderFrame = cancelFrame;
      this._reorderRaf = scheduleFrame(tick);
    });
  }

  getInteractiveObjects() {
    return this.activeGroup.children;
  }

  get isReorderBusy() {
    return this._reorderBusy;
  }
}
