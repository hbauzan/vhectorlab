import * as THREE from 'three';

/**
 * Pure math transformation helpers for thread layout calculations.
 */
export const executeLayoutMath = {
  calculateX(threadIndex, spacingX, scale = 1.0) {
    return threadIndex * spacingX * scale;
  },
  calculateZ(pointIndex, baseSpacing, zWidth, scale = 1.0) {
    return pointIndex * baseSpacing * zWidth * scale;
  }
};

/**
 * Updates 3D spatial layout position buffers in-situ for a list of thread objects.
 * Modifies Float32Array positions without re-creating geometries (zero memory leaks).
 * Scaled for VectorLab 3D camera distance (camera: Z=400, Y=150).
 *
 * @param {Array<Object>} threads - Array of synthetic thread objects
 * @param {Object} config - { threadSpacing, threadWidth, threadThickness }
 * @param {number} pointSpacing - Base Z spacing between consecutive vector points
 */
export function updateAllThreadPositions(threads, config, pointSpacing = 0.1) {
  if (!threads || !Array.isArray(threads)) return;

  const spacingX = config.threadSpacing ?? 2.0;
  const zWidth = config.threadWidth ?? 1.0;
  const thickness = config.threadThickness ?? 2.0;

  const threadCount = threads.length;
  const scaleXFactor = 25.0; // Scaled X separation for scene camera
  const scaleZFactor = 30.0; // Scaled Z extent for scene camera
  const scaleYFactor = 35.0; // Scaled Y amplitude

  threads.forEach((thread, threadIndex) => {
    // Center threads along X axis
    const centeredIndex = threadIndex - (threadCount - 1) / 2.0;
    const offsetX = executeLayoutMath.calculateX(centeredIndex, spacingX, scaleXFactor);

    if (thread.lineMesh) {
      thread.lineMesh.position.x = offsetX;
    }
    if (thread.pointsMesh) {
      thread.pointsMesh.position.x = offsetX;
      if (thread.pointsMesh.material) {
        // Scaled point size (8.0 to 50.0 pixels) for crisp visibility
        thread.pointsMesh.material.size = thickness * 5.0;
        thread.pointsMesh.material.needsUpdate = true;
      }
    }

    const lineGeom = thread.lineMesh?.geometry;
    const pointsGeom = thread.pointsMesh?.geometry;

    const geometries = [lineGeom, pointsGeom].filter(Boolean);
    geometries.forEach((geom) => {
      const posAttr = geom.attributes.position;
      if (!posAttr) return;

      const rawValues = thread.rawValues || [];
      const pointCount = rawValues.length;

      for (let p = 0; p < pointCount; p++) {
        const valY = rawValues[p] * scaleYFactor;
        const centeredZIndex = p - pointCount / 2.0;
        const posZ = executeLayoutMath.calculateZ(centeredZIndex, pointSpacing, zWidth, scaleZFactor);

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
