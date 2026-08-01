import * as THREE from 'three';
import { createDivergentMaterial, getDivergentColor } from './DivergentShading.js';

/**
 * Creates synthetic 3D vector thread data and WebGL buffer geometries using Divergent Activation Shading.
 *
 * @param {number} count - Number of synthetic threads to generate (default 5)
 * @param {number} pointsPerThread - Number of vector points per thread (default 100)
 * @returns {Array<Object>} List of synthetic thread objects
 */
export function createSyntheticThreads(count = 5, pointsPerThread = 100) {
  const threads = [];

  for (let i = 0; i < count; i++) {
    const rawValues = new Float32Array(pointsPerThread);
    const intensities = new Float32Array(pointsPerThread);
    const lineColors = new Float32Array(pointsPerThread * 3);

    const freq = 0.08 + i * 0.03;
    const phase = i * 0.8;

    for (let p = 0; p < pointsPerThread; p++) {
      // Normalized activation values v in [-1.0, 1.0]
      const v = Math.max(-1.0, Math.min(1.0, Math.sin(p * freq + phase) * 0.8 + Math.cos(p * 0.12) * 0.4));
      rawValues[p] = v;
      intensities[p] = v;

      const col = getDivergentColor(v);
      lineColors[p * 3 + 0] = col.r;
      lineColors[p * 3 + 1] = col.g;
      lineColors[p * 3 + 2] = col.b;
    }

    const positions = new Float32Array(pointsPerThread * 3);
    for (let p = 0; p < pointsPerThread; p++) {
      positions[p * 3 + 0] = 0;
      positions[p * 3 + 1] = rawValues[p] * 35.0;
      positions[p * 3 + 2] = (p - pointsPerThread / 2) * 3.0;
    }

    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3));
    lineGeom.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));

    const pointsGeom = new THREE.BufferGeometry();
    pointsGeom.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3));
    pointsGeom.setAttribute('intensity', new THREE.BufferAttribute(intensities, 1));

    const lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });

    const pointsMat = createDivergentMaterial(10.0, 1.0);

    const lineMesh = new THREE.Line(lineGeom, lineMat);
    const pointsMesh = new THREE.Points(pointsGeom, pointsMat);

    // CRITICAL INVARIANT: frustumCulled = false prevents objects disappearing on stretch/move
    lineMesh.frustumCulled = false;
    pointsMesh.frustumCulled = false;

    threads.push({
      id: i,
      label: `Vector ${i}`,
      rawValues,
      lineMesh,
      pointsMesh
    });
  }

  return threads;
}

