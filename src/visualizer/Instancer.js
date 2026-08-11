import * as THREE from 'three';
import { MeshFactory } from './MeshFactory.js';
import { LayoutEngine } from './LayoutEngine.js';
import { arithmeticSequenceIndex, arithmeticThreadLabel } from '../ui/threadLabelFormat.js';
import { normalizeRenderMode } from '../core/State.js';
import { computeGroupAwareYSlots } from './groupStackLayout.js';
import {
  applyDimPermutation,
  computeDimContrastPermutation,
  hasEnoughGroupsForDimSort,
} from './dimContrastSort.js';
import {
  computeDimRelationMetrics,
  hasGroupsForDimContrast,
} from './groupDimContrast.js';
import { layoutGalaxyPoints, resolveGalaxyPointSize, resolveGalaxyWorldScale } from './galaxyLayout.js';
import {
  buildDimRulerSegments,
} from './dimRuler.js';
import { resolveVisualizationSettings } from '../ui/visualizationControlsDefaults.js';

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

    this.renderMode = "POINTS"; // "POINTS" | "RIBBONS"
    this.currentData = null;
    /** Multiplier on dim-axis pitch (scaleX) so SAE sparse dims keep RAW visual span. */
    this.dimSpanScale = 1.0;

    /** @type {null|{ viewMode: string, totalThreads: number, spacingY: number, amplitudeY: number, pointsMesh: THREE.Points|null, baselineMesh: THREE.Line|null, threads: Array, renderMode: string }} */
    this.compareRuntime = null;
    this._reorderRaf = null;
    this._reorderBusy = false;
  }

  /**
   * @param {number} scale  rawDim/saeDim when SAE ON; 1 when RAW
   */
  setDimSpanScale(scale) {
    const n = Number(scale);
    this.dimSpanScale = Number.isFinite(n) && n > 0 ? n : 1.0;
  }

  /**
   * World-space AABB of currently mounted vector geometry (empty box if none).
   * @returns {THREE.Box3}
   */
  getContentBoundingBox() {
    const box = new THREE.Box3();
    if (!this.activeGroup || this.activeGroup.children.length === 0) {
      return box;
    }
    box.setFromObject(this.activeGroup);
    return box;
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
   * @param {string} renderMode - "POINTS" | "RIBBONS" (unknown/retired modes → POINTS)
   * @param {Object} [spatialConfig] - Real-time spatial slider configuration { threadSpacing, threadWidth, threadThickness }
   * @param {string} [viewMode="NAVIGATION"] - "NAVIGATION" | "ANALYSIS"
   * @param {Object} [vizConfig] - Global sign filter + color anchors
   * @returns {Array<{ id: string, text: string, type: string, origin3D: THREE.Vector3 }>} Label metadata for origins
   */
  renderArithmeticData(arithmeticResponse, renderMode = "POINTS", spatialConfig = null, viewMode = "NAVIGATION", vizConfig = null) {
    this.clear();
    renderMode = normalizeRenderMode(renderMode);
    this.renderMode = renderMode;
    this.currentData = arithmeticResponse;

    if (spatialConfig) {
      if (spatialConfig.threadSpacing !== undefined) {
        // Dim axis pitch (ANALYSIS wall width + NAVIGATION thread length along X)
        this.layoutEngine.scaleX = spatialConfig.threadSpacing * (this.dimSpanScale || 1);
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
    const compSlots = /** @type {const} */ (['A', 'B', 'C']);
    const compLabels = [
      arithmeticThreadLabel('A'),
      arithmeticThreadLabel('B'),
      arithmeticThreadLabel('C'),
    ];

    // Order: WORD_A → WORD_B → WORD_C → RES → TOP1 (both ANALYSIS + NAVIGATION)
    if (arithmeticResponse.components) {
      compKeys.forEach((key, kIdx) => {
        const compVec = arithmeticResponse.components[key];
        if (compVec && compVec.length) {
          pushThread(
            key,
            compLabels[kIdx],
            `word_${String.fromCharCode(97 + kIdx)}`,
            compVec,
            arithmeticSequenceIndex(compSlots[kIdx])
          );
        }
      });
    }

    const vecRes = arithmeticResponse.vector_res;
    pushThread("res", arithmeticThreadLabel('RES'), "res", vecRes, arithmeticSequenceIndex('RES'));

    const top1Vec = (arithmeticResponse.components && arithmeticResponse.components.vec_top1)
      ? arithmeticResponse.components.vec_top1
      : vecRes;
    pushThread("top1", arithmeticThreadLabel('TOP1'), "top_1", top1Vec, arithmeticSequenceIndex('TOP1'));

    if (viewMode === "ANALYSIS" && threadLabelItems.length >= 2) {
      const baselineMesh = MeshFactory.createBaselineMesh(
        threadLabelItems.map((item) => item.origin3D),
        0x00e5ff
      );
      if (baselineMesh) this.activeGroup.add(baselineMesh);
    }

    this._mountRenderModeGeometry(renderMode, surfaceRows, pointsData, thicknessFactor, vizConfig);
    this._mountDimRulerFromRows(surfaceRows, vizConfig);
    return threadLabelItems;
  }

  /**
   * Mount POINTS | RIBBONS geometry (mutually exclusive).
   * @private
   */
  _mountRenderModeGeometry(renderMode, surfaceRows, pointsData, thicknessFactor, vizConfig = null) {
    const vizOpts = vizConfig ? { vizConfig } : {};
    if (renderMode === "RIBBONS") {
      // No base plane: translucent dark quad showed through ribbons as a hard dark rectangle.
      const ribbonWidth = Math.max(2.0, 14.0 * (thicknessFactor || 0.3));
      surfaceRows.forEach((row) => {
        const wide = MeshFactory.createWideRibbonMesh(row.points, row.activations, {
          width: ribbonWidth,
          ...vizOpts,
        });
        if (wide) this.activeGroup.add(wide);
      });
      return;
    }

    // POINTS: thin continuity lines + point cloud
    surfaceRows.forEach((row) => {
      const ribbon = MeshFactory.createRibbonMesh(row.points, row.activations, vizOpts);
      this.activeGroup.add(ribbon);
    });
    if (pointsData.length) {
      const pointsMesh = MeshFactory.createPointsMesh(pointsData, {
        pointSize: 15.0 * thicknessFactor,
        ...vizOpts,
      });
      pointsMesh.userData = { pointsData };
      this.activeGroup.add(pointsMesh);
    }
  }

  /**
   * Renders token/text sequence comparison data (1 to 1024 tokens).
   * @param {Object} compareResponse - API response from /compare
   * @param {string} renderMode - "POINTS" | "RIBBONS" (unknown/retired modes → POINTS)
   * @param {Object} [spatialConfig] - Real-time spatial slider configuration
   * @param {string} [viewMode="NAVIGATION"] - "NAVIGATION" | "ANALYSIS"
   * @param {Object} [vizConfig] - Global sign filter + color anchors
   * @param {{ dimSortByContrast?: boolean }} [options]
   * @returns {Array<{ id: string, text: string, type: string, origin3D: THREE.Vector3 }>} Label metadata
   */
  renderCompareData(
    compareResponse,
    renderMode = "POINTS",
    spatialConfig = null,
    viewMode = "NAVIGATION",
    vizConfig = null,
    options = {}
  ) {
    this.clear();
    renderMode = normalizeRenderMode(renderMode);
    this.renderMode = renderMode;
    this.currentData = compareResponse;

    if (spatialConfig) {
      if (spatialConfig.threadSpacing !== undefined) {
        // Dim axis pitch (ANALYSIS wall width + NAVIGATION thread length along X)
        this.layoutEngine.scaleX = spatialConfig.threadSpacing * (this.dimSpanScale || 1);
      }
      if (spatialConfig.threadWidth !== undefined) {
        this.layoutEngine.scaleZ = spatialConfig.threadWidth * 25.0;
      }
    }

    if (!compareResponse || !compareResponse.items || compareResponse.items.length === 0) return [];

    const items = compareResponse.items;
    const totalThreads = items.length;
    const thicknessFactor = (spatialConfig && spatialConfig.threadThickness !== undefined)
      ? spatialConfig.threadThickness
      : 0.3;

    const spacingY = (spatialConfig && (spatialConfig.threadVectorDistance !== undefined || spatialConfig.threadSpacingY !== undefined))
      ? (spatialConfig.threadVectorDistance ?? spatialConfig.threadSpacingY)
      : 46.0;

    const amplitudeY = (spatialConfig && spatialConfig.threadAmplitudeY !== undefined)
      ? spatialConfig.threadAmplitudeY
      : 16.0;

    const { slots: ySlots, span: ySlotSpan } = computeGroupAwareYSlots(items, { gapSlots: 1 });
    const dimSortOn = options.dimSortByContrast === true && hasEnoughGroupsForDimSort(items);
    const dimPerm = dimSortOn ? computeDimContrastPermutation(items) : null;
    const groupDimMetrics = hasGroupsForDimContrast(items)
      ? computeDimRelationMetrics(items)
      : null;
    const sourceDimsForVec = (len) => {
      if (dimPerm && dimPerm.length === len) return dimPerm.slice();
      return Array.from({ length: len }, (_, i) => i);
    };

    const pointsData = [];
    const threadLabelItems = [];
    const threads = [];
    /** @type {Array<{ points: THREE.Vector3[], activations: number[] }>} */
    const surfaceRows = [];
    let pointOffset = 0;

    items.forEach((item, idx) => {
      const rawVec = item.embedding;
      if (!rawVec || !rawVec.length) return;

      const vec = dimPerm ? applyDimPermutation(rawVec, dimPerm) : rawVec;
      const sourceDims = sourceDimsForVec(vec.length);
      const threadId = item.id || `tok_${idx}`;
      const layoutOpts = { ySlot: ySlots[idx] ?? idx, ySlotSpan };
      const vec3D = this.layoutEngine.mapVectorTo3DPoints(
        vec,
        idx,
        viewMode,
        totalThreads,
        spacingY,
        amplitudeY,
        layoutOpts
      );
      const activations = [];

      vec3D.forEach((p, dimIdx) => {
        const val = vec[dimIdx];
        const sourceDim = sourceDims[dimIdx];
        pointsData.push({
          position: p,
          activation: val,
          size: 10.0 * thicknessFactor,
          groupId: item.groupId,
          groupLabel: item.groupLabel,
          meta: {
            type: "compare",
            token: item.text,
            dim: sourceDim,
            val,
            groupId: item.groupId,
            groupLabel: item.groupLabel,
          },
        });
        activations.push(val);
      });

      surfaceRows.push({ points: vec3D, activations });

      const vizOpts = {
        ...(vizConfig ? { vizConfig } : {}),
        ...(groupDimMetrics?.length ? { groupDimMetrics, sourceDims } : {}),
        ...(item.groupId ? { groupId: item.groupId } : {}),
      };
      let ribbonMesh = null;
      if (renderMode === "RIBBONS") {
        const ribbonWidth = Math.max(2.0, 14.0 * thicknessFactor);
        ribbonMesh = MeshFactory.createWideRibbonMesh(vec3D, activations, {
          width: ribbonWidth,
          ...vizOpts,
        });
      } else {
        ribbonMesh = MeshFactory.createRibbonMesh(vec3D, activations, vizOpts);
      }
      if (ribbonMesh) {
        ribbonMesh.userData.threadId = threadId;
        ribbonMesh.userData.token = item.text;
        ribbonMesh.userData.type = 'compare';
        ribbonMesh.userData.sourceDims = sourceDims;
        if (item.groupId) ribbonMesh.userData.groupId = item.groupId;
        if (item.groupLabel) ribbonMesh.userData.groupLabel = item.groupLabel;
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
        ySlot: layoutOpts.ySlot,
        ySlotSpan,
        _layoutPoints: vec3D,
        groupId: item.groupId,
        groupLabel: item.groupLabel,
      });
      pointOffset += vec.length;

      if (vec3D.length > 0) {
        threadLabelItems.push({
          id: threadId,
          text: item.text,
          type: "compare",
          origin3D: vec3D[0],
          groupId: item.groupId,
          groupLabel: item.groupLabel,
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
    if (renderMode === "POINTS" && pointsData.length) {
      // RIBBONS must not mount the POINTS cloud (square Chebyshev dots on top of strips).
      pointsMesh = MeshFactory.createPointsMesh(pointsData, {
        pointSize: 15.0 * thicknessFactor,
        ...(vizConfig ? { vizConfig } : {}),
        ...(groupDimMetrics?.length ? { groupDimMetrics } : {}),
      });
      pointsMesh.userData = { pointsData };
      this.activeGroup.add(pointsMesh);
    }

    this.compareRuntime = {
      viewMode,
      totalThreads,
      spacingY,
      amplitudeY,
      ySlotSpan,
      pointsMesh,
      baselineMesh,
      rulerMesh: null,
      vizConfig,
      threads,
      renderMode,
    };

    this._syncCompareRuler();

    return threadLabelItems;
  }

  /**
   * Galaxy VIEW: one point per token from projected positions (no dim-threads / ribbons).
   * @param {Object} compareResponse
   * @param {number[][]} positions
   * @param {Object} [spatialConfig]
   * @param {Object} [vizConfig]
   * @returns {Array<{ id: string, text: string, type: string, origin3D: THREE.Vector3, groupId?: string, groupLabel?: string }>}
   */
  renderGalaxyData(compareResponse, positions, spatialConfig = null, vizConfig = null) {
    this.clear();
    this.renderMode = 'POINTS';
    this.currentData = compareResponse;
    this.compareRuntime = null;

    if (!compareResponse?.items?.length || !positions?.length) return [];

    const thicknessFactor = (spatialConfig && spatialConfig.threadThickness !== undefined)
      ? spatialConfig.threadThickness
      : 0.3;
    const scale = resolveGalaxyWorldScale(spatialConfig);
    const pointSize = resolveGalaxyPointSize(thicknessFactor);

    const { pointsData, labels } = layoutGalaxyPoints(
      compareResponse.items,
      positions,
      { scale },
    );
    if (!pointsData.length) return [];

    const sized = pointsData.map((p) => ({
      ...p,
      size: pointSize * 0.75,
    }));

    const pointsMesh = MeshFactory.createPointsMesh(sized, {
      pointSize,
      galaxy: true,
      ...(vizConfig ? { vizConfig } : {}),
    });
    pointsMesh.userData = { pointsData: sized, galaxy: true };
    this.activeGroup.add(pointsMesh);

    return labels;
  }

  /**
   * Apply layout slot (supports fractional sequenceIndex for tweening) to one compare thread in-situ.
   * @returns {THREE.Vector3|null} origin for floating labels
   */
  _applyCompareThreadLayout(thread, sequenceIndex, runtime, { updateBounds = false } = {}) {
    // Settled layout uses stored group-gap slots; fractional tween uses sequenceIndex as Y.
    const settled = Number.isInteger(sequenceIndex)
      && sequenceIndex === thread.sequenceIndex
      && thread.ySlot !== undefined;
    const layoutOpts = settled
      ? {
          ySlot: thread.ySlot,
          ySlotSpan: thread.ySlotSpan !== undefined
            ? thread.ySlotSpan
            : (runtime.ySlotSpan !== undefined
              ? runtime.ySlotSpan
              : Math.max(0, runtime.totalThreads - 1)),
        }
      : {
          ySlot: sequenceIndex,
          ySlotSpan: Math.max(0, runtime.totalThreads - 1),
        };
    const vec3D = this.layoutEngine.mapVectorTo3DPoints(
      thread.embedding,
      sequenceIndex,
      runtime.viewMode,
      runtime.totalThreads,
      runtime.spacingY,
      runtime.amplitudeY,
      layoutOpts
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
   * Build / refresh dim-axis ruler from thread layout points (not Galaxy).
   * @param {Array<{ points?: Array<{ x: number, y: number, z?: number }> }>} surfaceRows
   * @param {object|null} vizConfig
   * @returns {THREE.Group|null}
   */
  _mountDimRulerFromRows(surfaceRows, vizConfig) {
    const rows = Array.isArray(surfaceRows) ? surfaceRows : [];
    const pointArrays = rows.map((r) => r?.points || []).filter((pts) => pts.length);
    const mesh = this._buildDimRulerMesh(pointArrays, vizConfig);
    if (mesh) this.activeGroup.add(mesh);
    return mesh;
  }

  /**
   * @param {Array<Array<{ x: number, y: number, z?: number }>>} pointArrays
   * @param {object|null|undefined} vizConfig
   * @returns {THREE.Group|null}
   */
  _buildDimRulerMesh(pointArrays, vizConfig) {
    const viz = resolveVisualizationSettings(vizConfig);
    const lineCount = viz.rulerLineCount || 0;
    if (lineCount <= 0 || !pointArrays?.length || pointArrays.length < 2) return null;

    const lengths = pointArrays
      .map((pts) => (Array.isArray(pts) ? pts.length : 0))
      .filter((n) => n > 0);
    if (!lengths.length) return null;
    const dimCap = Math.min(lineCount, ...lengths);
    const segs = buildDimRulerSegments(pointArrays, dimCap, viz.rulerLinkMode);
    if (!segs.length) return null;
    return MeshFactory.createDimRulerMesh(segs, {
      color: viz.rulerColor,
      thickness: viz.rulerThickness,
    });
  }

  _syncCompareRuler() {
    const runtime = this.compareRuntime;
    if (!runtime) return;

    if (runtime.rulerMesh) {
      this.activeGroup.remove(runtime.rulerMesh);
      MeshFactory.disposeDimRulerMesh(runtime.rulerMesh);
      runtime.rulerMesh = null;
    }

    const pointArrays = (runtime.threads || [])
      .map((t) => t._layoutPoints || [])
      .filter((pts) => pts.length);
    const mesh = this._buildDimRulerMesh(pointArrays, runtime.vizConfig);
    if (mesh) {
      this.activeGroup.add(mesh);
      runtime.rulerMesh = mesh;
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
                groupId: thread.groupId,
                groupLabel: thread.groupLabel,
              });
            }
            if (t >= 1) {
              thread.sequenceIndex = toIdx[i];
            }
          });

          if (t >= 1) {
            const ordered = [...runtime.threads].sort((a, b) => a.sequenceIndex - b.sequenceIndex);
            const { slots, span } = computeGroupAwareYSlots(ordered, { gapSlots: 1 });
            runtime.ySlotSpan = span;
            ordered.forEach((th, i) => {
              th.ySlot = slots[i];
              th.ySlotSpan = span;
            });
            origins.length = 0;
            labels.length = 0;
            runtime.threads.forEach((thread) => {
              const origin = this._applyCompareThreadLayout(thread, thread.sequenceIndex, runtime, {
                updateBounds: true,
              });
              if (origin) {
                origins.push(origin);
                labels.push({
                  id: thread.id,
                  text: thread.text,
                  type: "compare",
                  origin3D: origin,
                  groupId: thread.groupId,
                  groupLabel: thread.groupLabel,
                });
              }
            });
          }

          this._syncCompareBaseline(origins);
          this._syncCompareRuler();

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
