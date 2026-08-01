import * as THREE from 'three';
import { createDivergentMaterial, getDivergentColor, calculateZScoreNormalized } from './DivergentShading.js';

/**
 * Factory for creating 3D Vector Point Cloud Geometries and Ribbon Lines using Divergent Activation Shading.
 */
export class MeshFactory {
  /**
   * Creates a Points Cloud Mesh with GPU Divergent Activation GLSL Shader.
   * Enforces frustumCulled = false.
   */
  static createPointsMesh(pointsData, options = {}) {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const rawActivations = [];

    pointsData.forEach((item) => {
      const pos = item.position;
      positions.push(pos.x, pos.y, pos.z);
      rawActivations.push(item.activation !== undefined ? item.activation : 0.0);
    });

    const normIntensities = calculateZScoreNormalized(rawActivations, 0.85);

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('intensity', new THREE.Float32BufferAttribute(normIntensities, 1));

    const pointSize = options.pointSize || 14.0;
    const material = createDivergentMaterial(pointSize, 1.0);

    const pointsMesh = new THREE.Points(geometry, material);

    // CRITICAL INVARIANT: frustumCulled = false prevents GPU occlusion popping
    pointsMesh.frustumCulled = false;

    return pointsMesh;
  }

  /**
   * Creates a Ribbon Line connecting a sequence of 3D vector points with vertex activation colors.
   */
  static createRibbonMesh(points, activations = null) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    if (activations && activations.length === points.length) {
      const normActivations = calculateZScoreNormalized(activations, 0.85);
      const colors = new Float32Array(points.length * 3);
      normActivations.forEach((val, idx) => {
        const col = getDivergentColor(val, 1.0);
        colors[idx * 3 + 0] = col.r;
        colors[idx * 3 + 1] = col.g;
        colors[idx * 3 + 2] = col.b;
      });
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }

    const material = new THREE.LineBasicMaterial({
      vertexColors: !!activations,
      color: activations ? 0xffffff : 0x00ffaa,
      linewidth: 2,
      transparent: true,
      opacity: 0.85
    });

    const lineMesh = new THREE.Line(geometry, material);

    // CRITICAL INVARIANT: frustumCulled = false
    lineMesh.frustumCulled = false;

    return lineMesh;
  }
}


