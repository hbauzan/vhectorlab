import * as THREE from 'three';

/**
 * Pure math transformation helpers for thread layout calculations.
 */
export const executeLayoutMath = {
  calculateX(threadIndex, spacingX) {
    return threadIndex * spacingX;
  },
  calculateZ(pointIndex, baseSpacing, zWidth) {
    return pointIndex * baseSpacing * zWidth;
  }
};

/**
 * Updates 3D spatial layout position buffers in-situ for a list of thread objects.
 * Modifies Float32Array positions without re-creating geometries (zero memory leaks).
 *
 * @param {Array<Object>} threads - Array of synthetic thread objects
 * @param {Object} config - { threadSpacing, threadWidth, threadThickness }
 * @param {number} pointSpacing - Base Z spacing between consecutive vector points (default 0.1)
 */
export function updateAllThreadPositions(threads, config, pointSpacing = 0.1) {
  if (!threads || !Array.isArray(threads)) return;

  const spacingX = config.threadSpacing ?? 2.0;
  const zWidth = config.threadWidth ?? 1.0;
  const thickness = config.threadThickness ?? 2.0;

  threads.forEach((thread, threadIndex) => {
    const offsetX = executeLayoutMath.calculateX(threadIndex, spacingX);

    if (thread.lineMesh) {
      thread.lineMesh.position.x = offsetX;
    }
    if (thread.pointsMesh) {
      thread.pointsMesh.position.x = offsetX;
      if (thread.pointsMesh.material) {
        thread.pointsMesh.material.size = thickness * 0.05;
        thread.pointsMesh.material.needsUpdate = true;
      }
    }

    const lineGeom = thread.lineMesh?.geometry;
    const pointsGeom = thread.pointsMesh?.geometry;

    // Mutate position buffer attributes for both line and points geometry
    const geometries = [lineGeom, pointsGeom].filter(Boolean);
    geometries.forEach((geom) => {
      const posAttr = geom.attributes.position;
      if (!posAttr) return;

      const rawValues = thread.rawValues || [];
      for (let p = 0; p < rawValues.length; p++) {
        const valY = rawValues[p];
        const posZ = executeLayoutMath.calculateZ(p, pointSpacing, zWidth);

        posAttr.setXYZ(p, 0, valY, posZ);
      }
      posAttr.needsUpdate = true;
      geom.computeBoundingSphere();
    });
  });
}

/**
 * Legacy/Standard LayoutEngine class for general vector mapping.
 */
export class LayoutEngine {
  constructor(options = {}) {
    this.scaleX = options.scaleX || 0.8;
    this.scaleY = options.scaleY || 120.0;
    this.scaleZ = options.scaleZ || 25.0;
  }

  mapVectorTo3DPoints(vector, sequenceIndex = 0) {
    if (!vector || !vector.length) return [];
    const count = vector.length;
    const offsetCenter = (count * this.scaleX) / 2.0;

    return vector.map((val, dimIndex) => {
      const x = dimIndex * this.scaleX - offsetCenter;
      const y = val * this.scaleY;
      const z = sequenceIndex * this.scaleZ;
      return new THREE.Vector3(x, y, z);
    });
  }

  getBoundingBox(points) {
    const box = new THREE.Box3();
    points.forEach((p) => box.expandByPoint(p));
    return box;
  }
}
