import * as THREE from 'three';
import { createDivergentMaterial, getDivergentColor, calculateZScoreNormalized } from './DivergentShading.js';
import { anchorsFromSettings, resolveVisualizationSettings } from '../ui/visualizationControlsDefaults.js';
import { lineSegmentIndices, wideRibbonQuadIndices } from './activationFilter.js';

/**
 * Resolve optional vizConfig from MeshFactory options into filter mode + RGB anchors.
 * @param {object} [options]
 */
function resolveVizOptions(options = {}) {
  const viz = options.vizConfig
    ? resolveVisualizationSettings(options.vizConfig)
    : resolveVisualizationSettings(null);
  return {
    filterMode: viz.vizFilterMode,
    anchors: anchorsFromSettings(viz),
    zeroCoverage: viz.zeroCoverage,
    viz,
  };
}

/**
 * Factory for creating 3D Vector Point Cloud Geometries and Ribbon Lines using Divergent Activation Shading.
 */
export class MeshFactory {
  /**
   * Creates a Points Cloud Mesh with GPU Divergent Activation GLSL Shader.
   * Sign filter is applied in the fragment shader (keeps full buffers for compare reorder).
   * Enforces frustumCulled = false.
   */
  static createPointsMesh(pointsData, options = {}) {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const rawActivations = [];
    const { filterMode, anchors, zeroCoverage } = resolveVizOptions(options);

    pointsData.forEach((item) => {
      const pos = item.position;
      positions.push(pos.x, pos.y, pos.z);
      rawActivations.push(item.activation !== undefined ? item.activation : 0.0);
    });

    const normIntensities = calculateZScoreNormalized(rawActivations, 0.85);

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('intensity', new THREE.Float32BufferAttribute(normIntensities, 1));

    const pointSize = options.pointSize || 14.0;
    const material = createDivergentMaterial(pointSize, 1.0, {
      anchors,
      filterMode,
      zeroCoverage,
    });

    const pointsMesh = new THREE.Points(geometry, material);

    // CRITICAL INVARIANT: frustumCulled = false prevents GPU occlusion popping
    pointsMesh.frustumCulled = false;

    return pointsMesh;
  }

  /**
   * Continuity line for POINTS mode.
   * Uses LineSegments + index pairs so filtered signs break continuity (F4).
   * Full vertex buffer retained for in-situ compare reorder position updates.
   */
  static createRibbonMesh(points, activations = null, options = {}) {
    const { filterMode, anchors, zeroCoverage } = resolveVizOptions(options);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    let normActivations = null;
    if (activations && activations.length === points.length) {
      normActivations = calculateZScoreNormalized(activations, 0.85);
      const colors = new Float32Array(points.length * 3);
      for (let idx = 0; idx < normActivations.length; idx++) {
        const col = getDivergentColor(normActivations[idx], 1.0, anchors, zeroCoverage);
        colors[idx * 3 + 0] = col.r;
        colors[idx * 3 + 1] = col.g;
        colors[idx * 3 + 2] = col.b;
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }

    if (normActivations) {
      const indices = lineSegmentIndices(normActivations, filterMode);
      if (indices.length) {
        geometry.setIndex(indices);
      } else {
        // No visible segments — empty draw (keep vertices for reorder).
        geometry.setIndex([]);
      }
    }

    const material = new THREE.LineBasicMaterial({
      vertexColors: !!activations,
      color: activations ? 0xffffff : 0x00ffaa,
      linewidth: 2,
      transparent: true,
      opacity: 0.85
    });

    const lineMesh = new THREE.LineSegments(geometry, material);
    lineMesh.frustumCulled = false;
    lineMesh.userData = {
      kind: 'continuityLine',
      pointCount: points.length,
    };

    return lineMesh;
  }

  /**
   * Creates a vertical reference baseline line connecting thread origins in Analysis Mode.
   * @param {Array<THREE.Vector3>} originPoints - List of thread origin points (X = startX)
   * @param {number} [color=0x00e5ff] - Baseline line color
   * @returns {THREE.Line|null}
   */
  static createBaselineMesh(originPoints, color = 0x00e5ff) {
    if (!originPoints || originPoints.length < 2) return null;

    const sortedPoints = [...originPoints].sort((a, b) => b.y - a.y);
    const geometry = new THREE.BufferGeometry().setFromPoints(sortedPoints);

    const material = new THREE.LineBasicMaterial({
      color: color,
      linewidth: 2,
      transparent: true,
      opacity: 0.6
    });

    const lineMesh = new THREE.Line(geometry, material);
    lineMesh.frustumCulled = false;

    return lineMesh;
  }

  /**
   * Wide ribbon strip mesh (RIBBONS) — real width via quads, not Line linewidth.
   * Quad indices omit strips whose endpoints fail the sign filter (F4).
   * @param {THREE.Vector3[]} points
   * @param {number[]|null} activations
   * @param {{ width?: number, vizConfig?: object }} [options]
   * @returns {THREE.Mesh|null}
   */
  static createWideRibbonMesh(points, activations = null, options = {}) {
    if (!points || points.length < 2) return null;
    const { filterMode, anchors, zeroCoverage } = resolveVizOptions(options);
    const width = options.width ?? 3.0;
    const half = width * 0.5;
    const n = points.length;
    const acts = activations && activations.length === n
      ? activations
      : points.map(() => 0);
    const norm = calculateZScoreNormalized(acts, 0.85);

    const positions = new Float32Array(n * 2 * 3);
    const colors = new Float32Array(n * 2 * 3);
    const up = new THREE.Vector3(0, 1, 0);
    const tangent = new THREE.Vector3();
    const side = new THREE.Vector3();

    for (let i = 0; i < n; i++) {
      const p = points[i];
      if (i === 0) tangent.subVectors(points[1], points[0]);
      else if (i === n - 1) tangent.subVectors(points[n - 1], points[n - 2]);
      else tangent.subVectors(points[i + 1], points[i - 1]);
      if (tangent.lengthSq() < 1e-10) tangent.set(1, 0, 0);
      else tangent.normalize();

      side.crossVectors(up, tangent);
      if (side.lengthSq() < 1e-10) side.set(0, 0, 1);
      else side.normalize().multiplyScalar(half);

      const iL = i * 2;
      const iR = i * 2 + 1;
      positions[iL * 3] = p.x - side.x;
      positions[iL * 3 + 1] = p.y - side.y;
      positions[iL * 3 + 2] = p.z - side.z;
      positions[iR * 3] = p.x + side.x;
      positions[iR * 3 + 1] = p.y + side.y;
      positions[iR * 3 + 2] = p.z + side.z;

      const col = getDivergentColor(norm[i], 1.0, anchors, zeroCoverage);
      for (const vi of [iL, iR]) {
        colors[vi * 3] = col.r;
        colors[vi * 3 + 1] = col.g;
        colors[vi * 3 + 2] = col.b;
      }
    }

    const indices = wideRibbonQuadIndices(norm, filterMode);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.userData = { kind: 'wideRibbon', pointCount: n, width };
    return mesh;
  }

  /**
   * Update wide-ribbon centerline positions in-situ (compare reorder).
   * @param {THREE.Mesh} mesh
   * @param {THREE.Vector3[]} points
   */
  static updateWideRibbonMeshPositions(mesh, points) {
    if (!mesh?.geometry || !points?.length) return;
    const n = mesh.userData?.pointCount;
    const width = mesh.userData?.width ?? 3.0;
    if (!n || points.length < n) return;
    const half = width * 0.5;
    const pos = mesh.geometry.attributes.position;
    const up = new THREE.Vector3(0, 1, 0);
    const tangent = new THREE.Vector3();
    const side = new THREE.Vector3();

    for (let i = 0; i < n; i++) {
      const p = points[i];
      if (i === 0) tangent.subVectors(points[1], points[0]);
      else if (i === n - 1) tangent.subVectors(points[n - 1], points[n - 2]);
      else tangent.subVectors(points[i + 1], points[i - 1]);
      if (tangent.lengthSq() < 1e-10) tangent.set(1, 0, 0);
      else tangent.normalize();
      side.crossVectors(up, tangent);
      if (side.lengthSq() < 1e-10) side.set(0, 0, 1);
      else side.normalize().multiplyScalar(half);

      const iL = i * 2;
      const iR = i * 2 + 1;
      pos.setXYZ(iL, p.x - side.x, p.y - side.y, p.z - side.z);
      pos.setXYZ(iR, p.x + side.x, p.y + side.y, p.z + side.z);
    }
    pos.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingSphere();
  }

  /**
   * Semi-transparent ground plane under ribbons (legacy helper; Instancer does not mount it).
   * @param {{ width?: number, depth?: number, y?: number, color?: number, opacity?: number }} [options]
   * @returns {THREE.Mesh}
   */
  static createBasePlane(options = {}) {
    const width = options.width ?? 400;
    const depth = options.depth ?? 200;
    const y = options.y ?? -40;
    const geometry = new THREE.PlaneGeometry(width, depth);
    const material = new THREE.MeshBasicMaterial({
      color: options.color ?? 0x0a1220,
      transparent: true,
      opacity: options.opacity ?? 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    mesh.frustumCulled = false;
    mesh.userData = { kind: 'basePlane' };
    return mesh;
  }

  /**
   * Compute a base plane that loosely fits a set of thread rows.
   * @param {Array<{ points: THREE.Vector3[] }>} threadRows
   * @returns {THREE.Mesh|null}
   */
  static createBasePlaneForThreads(threadRows) {
    if (!threadRows?.length) return MeshFactory.createBasePlane();
    const box = new THREE.Box3();
    threadRows.forEach((row) => {
      (row.points || []).forEach((p) => box.expandByPoint(p));
    });
    if (box.isEmpty()) return MeshFactory.createBasePlane();
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const plane = MeshFactory.createBasePlane({
      width: Math.max(80, size.x * 1.35),
      depth: Math.max(60, size.z * 1.8 + 40),
      y: box.min.y - Math.max(8, size.y * 0.15),
    });
    plane.position.x = center.x;
    plane.position.z = center.z;
    return plane;
  }
}
