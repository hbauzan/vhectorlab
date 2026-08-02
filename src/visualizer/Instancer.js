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
   */
  renderArithmeticData(arithmeticResponse, renderMode = "POINTS", spatialConfig = null) {
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

    if (!arithmeticResponse || !arithmeticResponse.vector_res) return;

    const thicknessFactor = (spatialConfig && spatialConfig.threadThickness !== undefined)
      ? spatialConfig.threadThickness
      : 0.3;

    const pointsData = [];
    const resRibbonPoints = [];
    const resActivations = [];

    // 1. Result Vector V_res (Primary focus point cloud)
    const vecRes = arithmeticResponse.vector_res;
    const res3DPoints = this.layoutEngine.mapVectorTo3DPoints(vecRes, 0);

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

    // 2. Input Component Vectors (A, B, C) if available
    if (arithmeticResponse.components) {
      const compKeys = ["vec_a", "vec_b", "vec_c"];

      compKeys.forEach((key, kIdx) => {
        const compVec = arithmeticResponse.components[key];
        if (compVec && compVec.length) {
          const comp3D = this.layoutEngine.mapVectorTo3DPoints(compVec, (kIdx + 1) * 2);
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
        }
      });
    }

    // Create GPU Points Mesh using Divergent Activation Shading
    const pointsMesh = MeshFactory.createPointsMesh(pointsData, { pointSize: 15.0 * thicknessFactor });
    pointsMesh.userData = { pointsData };
    this.activeGroup.add(pointsMesh);

    // Create connecting line ribbon for result thread V_res
    const ribbonMesh = MeshFactory.createRibbonMesh(resRibbonPoints, resActivations);
    this.activeGroup.add(ribbonMesh);
  }

  getInteractiveObjects() {
    return this.activeGroup.children;
  }
}
