import * as THREE from 'three';
import { MeshFactory } from './MeshFactory.js';
import { LayoutEngine } from './LayoutEngine.js';

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
  }

  clear() {
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

    // Component vector keys and sequence slots
    const compKeys = ["vec_a", "vec_b", "vec_c"];
    const compLabels = [
      arithmeticResponse.word_a || "VECTOR A",
      arithmeticResponse.word_b || "VECTOR B",
      arithmeticResponse.word_c || "VECTOR C"
    ];

    // 1. Input Component Vectors (A, B, C) if available
    if (arithmeticResponse.components) {
      compKeys.forEach((key, kIdx) => {
        const compVec = arithmeticResponse.components[key];
        if (compVec && compVec.length) {
          const sequenceIdx = viewMode === "ANALYSIS" ? kIdx : (kIdx + 1) * 2;
          const comp3D = this.layoutEngine.mapVectorTo3DPoints(compVec, sequenceIdx, viewMode, 5, spacingY, amplitudeY);
          const compActivations = [];

          comp3D.forEach((p, idx) => {
            const val = compVec[idx];
            pointsData.push({
              position: p,
              activation: val,
              size: 10.0 * thicknessFactor,
              meta: { type: key, dim: idx, val: val }
            });
            compActivations.push(val);
          });

          // Create connecting line ribbon for component thread
          const compRibbon = MeshFactory.createRibbonMesh(comp3D, compActivations);
          this.activeGroup.add(compRibbon);

          // Save start origin (X=0) for thread label
          if (comp3D.length > 0) {
            threadLabelItems.push({
              id: key,
              text: compLabels[kIdx],
              type: `word_${String.fromCharCode(97 + kIdx)}`,
              origin3D: comp3D[0]
            });
          }
        }
      });
    }

    // 2. Result Vector V_res
    const vecRes = arithmeticResponse.vector_res;
    const resSequenceIdx = viewMode === "ANALYSIS" ? 3 : 0;
    const res3DPoints = this.layoutEngine.mapVectorTo3DPoints(vecRes, resSequenceIdx, viewMode, 5, spacingY, amplitudeY);
    const resRibbonPoints = [];
    const resActivations = [];

    res3DPoints.forEach((p, idx) => {
      const val = vecRes[idx];
      pointsData.push({
        position: p,
        activation: val,
        size: 10.0 * thicknessFactor,
        meta: { type: "res", dim: idx, val: val }
      });
      resRibbonPoints.push(p);
      resActivations.push(val);
    });

    // Create connecting line ribbon for result thread V_res
    const ribbonMesh = MeshFactory.createRibbonMesh(resRibbonPoints, resActivations);
    this.activeGroup.add(ribbonMesh);

    // Save result thread start origin for thread label
    if (res3DPoints.length > 0) {
      threadLabelItems.push({
        id: "res",
        text: "RESULT VECTOR",
        type: "res",
        origin3D: res3DPoints[0]
      });
    }

    // 3. Top-1 Cosine Vector (#1 COS VECTOR) below RESULT VECTOR
    const top1Word = arithmeticResponse.top1_word || (arithmeticResponse.results && arithmeticResponse.results[0] ? arithmeticResponse.results[0].word : "queen");
    const top1Vec = (arithmeticResponse.components && arithmeticResponse.components.vec_top1) ? arithmeticResponse.components.vec_top1 : vecRes;
    const top1SequenceIdx = viewMode === "ANALYSIS" ? 4 : 8;
    const top13DPoints = this.layoutEngine.mapVectorTo3DPoints(top1Vec, top1SequenceIdx, viewMode, 5, spacingY, amplitudeY);
    const top1Activations = [];

    top13DPoints.forEach((p, idx) => {
      const val = top1Vec[idx];
      pointsData.push({
        position: p,
        activation: val,
        size: 10.0 * thicknessFactor,
        meta: { type: "top1", dim: idx, val: val }
      });
      top1Activations.push(val);
    });

    // Create connecting line ribbon for Top-1 Cosine thread
    const top1Ribbon = MeshFactory.createRibbonMesh(top13DPoints, top1Activations);
    this.activeGroup.add(top1Ribbon);

    // Save Top-1 thread start origin for thread label
    if (top13DPoints.length > 0) {
      threadLabelItems.push({
        id: "top1",
        text: `#1 COS VECTOR (${top1Word})`,
        type: "top_1",
        origin3D: top13DPoints[0]
      });
    }

    // Render vertical baseline reference line connecting thread origins in ANALYSIS mode
    if (viewMode === "ANALYSIS" && threadLabelItems.length >= 2) {
      const originPoints = threadLabelItems.map(item => item.origin3D);
      const baselineMesh = MeshFactory.createBaselineMesh(originPoints, 0x00e5ff);
      if (baselineMesh) {
        this.activeGroup.add(baselineMesh);
      }
    }

    // Create GPU Points Mesh using Divergent Activation Shading
    const pointsMesh = MeshFactory.createPointsMesh(pointsData, { pointSize: 15.0 * thicknessFactor });
    pointsMesh.userData = { pointsData };
    this.activeGroup.add(pointsMesh);

    return threadLabelItems;
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

    compareResponse.items.forEach((item, idx) => {
      const vec = item.embedding;
      if (!vec || !vec.length) return;

      const vec3D = this.layoutEngine.mapVectorTo3DPoints(vec, idx, viewMode, totalThreads, spacingY, amplitudeY);
      const activations = [];

      vec3D.forEach((p, dimIdx) => {
        const val = vec[dimIdx];
        pointsData.push({
          position: p,
          activation: val,
          size: 10.0 * thicknessFactor,
          meta: { type: "compare", token: item.text, dim: dimIdx, val: val }
        });
        activations.push(val);
      });

      const ribbonMesh = MeshFactory.createRibbonMesh(vec3D, activations);
      this.activeGroup.add(ribbonMesh);

      if (vec3D.length > 0) {
        threadLabelItems.push({
          id: item.id || `tok_${idx}`,
          text: item.text,
          type: "compare",
          origin3D: vec3D[0]
        });
      }
    });

    if (viewMode === "ANALYSIS" && threadLabelItems.length >= 2) {
      const originPoints = threadLabelItems.map(item => item.origin3D);
      const baselineMesh = MeshFactory.createBaselineMesh(originPoints, 0x00e5ff);
      if (baselineMesh) {
        this.activeGroup.add(baselineMesh);
      }
    }

    const pointsMesh = MeshFactory.createPointsMesh(pointsData, { pointSize: 15.0 * thicknessFactor });
    pointsMesh.userData = { pointsData };
    this.activeGroup.add(pointsMesh);

    return threadLabelItems;
  }

  getInteractiveObjects() {
    return this.activeGroup.children;
  }
}
