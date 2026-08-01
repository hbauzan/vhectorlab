import * as THREE from 'three';

/**
 * Calculates 3D Spatial Layout for vector embedding dimensions and points.
 * X: Dimension/Offset index
 * Y: Activation magnitude / value
 * Z: Sequence/Result index
 */
export class LayoutEngine {
  constructor(options = {}) {
    this.scaleX = options.scaleX || 0.8;
    this.scaleY = options.scaleY || 120.0;
    this.scaleZ = options.scaleZ || 25.0;
  }

  /**
   * Transforms a raw 1D embedding vector into a array of 3D Vector3 points.
   * @param {Array<number>} vector - Float array of vector values
   * @param {number} sequenceIndex - Z offset for grouping multiple vectors
   * @returns {Array<THREE.Vector3>}
   */
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

  /**
   * Calculates bounding box for layout points.
   */
  getBoundingBox(points) {
    const box = new THREE.Box3();
    points.forEach((p) => box.expandByPoint(p));
    return box;
  }
}
