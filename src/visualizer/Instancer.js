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
   */
  renderArithmeticData(arithmeticResponse, renderMode = "POINTS") {
    this.clear();
    this.renderMode = renderMode;
    this.currentData = arithmeticResponse;

    if (!arithmeticResponse || !arithmeticResponse.vector_res) return;

    const pointsData = [];
    const ribbonPoints = [];

    // 1. Result Vector V_res (Primary focus point cloud)
    const vecRes = arithmeticResponse.vector_res;
    const res3DPoints = this.layoutEngine.mapVectorTo3DPoints(vecRes, 0);

    res3DPoints.forEach((p, idx) => {
      const val = vecRes[idx];
      pointsData.push({
        position: p,
        activation: val,
        size: 16.0,
        color: new THREE.Color(0xffe600), // Incandescent Gold/Yellow
        meta: { type: "res", dim: idx, val: val }
      });
      ribbonPoints.push(p);
    });

    // 2. Input Component Vectors (A, B, C) if available
    if (arithmeticResponse.components) {
      const compKeys = ["vec_a", "vec_b", "vec_c"];
      const compColors = [
        new THREE.Color(0x00ff88), // Green for A (+)
        new THREE.Color(0xff3366), // Red for B (-)
        new THREE.Color(0x00ccff)  // Cyan for C (+)
      ];

      compKeys.forEach((key, kIdx) => {
        const compVec = arithmeticResponse.components[key];
        if (compVec && compVec.length) {
          const comp3D = this.layoutEngine.mapVectorTo3DPoints(compVec, (kIdx + 1) * 2);
          comp3D.forEach((p, idx) => {
            const val = compVec[idx];
            pointsData.push({
              position: p,
              activation: val,
              size: 10.0,
              color: compColors[kIdx],
              meta: { type: key, dim: idx, val: val }
            });
          });
        }
      });
    }

    // Create GPU Points Mesh
    const pointsMesh = MeshFactory.createPointsMesh(pointsData);
    pointsMesh.userData = { pointsData };
    this.activeGroup.add(pointsMesh);

    // Create Ribbon Line Mesh if RIBBONS or MESH mode selected
    if (renderMode === "RIBBONS" || renderMode === "MESH") {
      const ribbonMesh = MeshFactory.createRibbonMesh(ribbonPoints, 0x00ffaa);
      this.activeGroup.add(ribbonMesh);
    }
  }

  getInteractiveObjects() {
    return this.activeGroup.children;
  }
}
