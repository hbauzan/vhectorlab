import * as THREE from 'three';
import { PointShader } from '../engine/Shaders.js';

/**
 * Factory for creating 3D Vector Point Cloud Geometries, Ribbon Lines, and Glowing Nodes.
 */
export class MeshFactory {
  /**
   * Creates a Points Cloud Mesh with custom GLSL Glowing Shader.
   * Enforces frustumCulled = false (Invariant 3).
   */
  static createPointsMesh(pointsData, options = {}) {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const activations = [];
    const sizes = [];
    const colors = [];

    pointsData.forEach((item) => {
      const pos = item.position;
      positions.push(pos.x, pos.y, pos.z);
      activations.push(item.activation !== undefined ? item.activation : 0.5);
      sizes.push(item.size || 14.0);

      if (item.color) {
        colors.push(item.color.r, item.color.g, item.color.b);
      } else {
        colors.push(0, 0, 0); // Default GLSL gradient
      }
    });

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aActivation', new THREE.Float32BufferAttribute(activations, 1));
    geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.ShaderMaterial({
      vertexShader: PointShader.vertexShader,
      fragmentShader: PointShader.fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const pointsMesh = new THREE.Points(geometry, material);

    // INVARIANTE 3: MUST explicitly set frustumCulled = false to prevent GPU occlusion popping
    pointsMesh.frustumCulled = false;

    return pointsMesh;
  }

  /**
   * Creates a Ribbon Line connecting a sequence of 3D vector points.
   */
  static createRibbonMesh(points, color = 0x00ffaa) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: color,
      linewidth: 2,
      transparent: true,
      opacity: 0.8
    });

    const lineMesh = new THREE.Line(geometry, material);

    // INVARIANTE 3: frustumCulled = false
    lineMesh.frustumCulled = false;

    return lineMesh;
  }
}
