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
        if (thread.pointsMesh.material.uniforms && thread.pointsMesh.material.uniforms.pointSize) {
          thread.pointsMesh.material.uniforms.pointSize.value = thickness * 15.0;
        } else {
          thread.pointsMesh.material.size = thickness * 15.0;
          thread.pointsMesh.material.needsUpdate = true;
        }
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
 * LayoutEngine class for 3D vector point mapping supporting NAVIGATION and ANALYSIS view modes.
 */
export class LayoutEngine {
  constructor(options = {}) {
    this.scaleX = options.scaleX || 0.8;
    this.scaleY = options.scaleY || 120.0;
    this.scaleZ = options.scaleZ || 25.0;
  }

  /**
   * Maps 1D vector activations to 3D positions in space.
   * @param {Array<number>} vector - Activation values
   * @param {number} sequenceIndex - Thread sequence/slot index
   * @param {string} [viewMode='NAVIGATION'] - 'NAVIGATION' | 'ANALYSIS'
   * @param {number} [totalThreads=5] - Total number of threads for centering in ANALYSIS mode
   * @param {number} [spacingY=46.0] - Vertical Y separation between threads
   * @param {number} [amplitudeY=16.0] - Height scale factor for activation points (+1 / -1)
   * @param {{ ySlot?: number, ySlotSpan?: number }} [layoutOpts] - Optional ANALYSIS slot override (group gaps)
   */
  mapVectorTo3DPoints(
    vector,
    sequenceIndex = 0,
    viewMode = 'NAVIGATION',
    totalThreads = 5,
    spacingY = 46.0,
    amplitudeY = 16.0,
    layoutOpts = {}
  ) {
    if (!vector || !vector.length) return [];
    const count = vector.length;
    const offsetCenterX = (count * this.scaleX) / 2.0;

    if (viewMode === 'ANALYSIS') {
      // Stack threads vertically along Y axis with customizable separation (spacingY)
      const verticalSpacing = spacingY ?? 46.0;
      const ySlot = layoutOpts.ySlot !== undefined ? layoutOpts.ySlot : sequenceIndex;
      const ySlotSpan = layoutOpts.ySlotSpan !== undefined
        ? layoutOpts.ySlotSpan
        : Math.max(0, totalThreads - 1);
      const centeredYSlot = ySlotSpan / 2.0 - ySlot;
      const offsetY = centeredYSlot * verticalSpacing;
      const ampY = amplitudeY ?? 16.0; // Scaled activation amplitude for point Y peaks (+1 / -1)

      // Shift X start position slightly to the right (+45) so start labels clear the left sidebar
      return vector.map((val, dimIndex) => {
        const x = dimIndex * this.scaleX - offsetCenterX + 45.0;
        const y = offsetY + val * ampY;
        const z = 0;
        return new THREE.Vector3(x, y, z);
      });
    }

    // Default NAVIGATION mode
    const scaleYMultiplier = (amplitudeY !== undefined) ? (amplitudeY / 16.0) : 1.0;
    return vector.map((val, dimIndex) => {
      const x = dimIndex * this.scaleX - offsetCenterX;
      const y = val * this.scaleY * scaleYMultiplier;
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
