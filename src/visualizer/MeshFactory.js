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
   * Continuous quad heightfield from thread rows × embedding dims (Etapa D / MESH).
   * Colormap: VectorLab divergent ramp (roadmap §1.6 option a — brand consistency).
   *
   * @param {Array<{ points: THREE.Vector3[], activations: number[] }>} threadRows
   * @param {{ singleThreadWidth?: number }} [options]
   * @returns {THREE.Mesh|null}
   */
  static createSurfaceMesh(threadRows, options = {}) {
    if (!threadRows || !threadRows.length) return null;

    let rows = threadRows
      .filter((t) => t && t.points && t.points.length >= 2)
      .map((t) => ({
        points: t.points,
        activations: t.activations || t.points.map(() => 0),
      }));
    if (!rows.length) return null;

    const cols = Math.min(...rows.map((t) => t.points.length));
    if (cols < 2) return null;

    // Single thread → thin strip so a surface is still visible
    if (rows.length === 1) {
      const halfW = options.singleThreadWidth ?? 2.5;
      const src = rows[0];
      const rowA = {
        points: src.points.slice(0, cols).map((p) => p.clone().add(new THREE.Vector3(0, 0, -halfW))),
        activations: src.activations.slice(0, cols),
      };
      const rowB = {
        points: src.points.slice(0, cols).map((p) => p.clone().add(new THREE.Vector3(0, 0, halfW))),
        activations: src.activations.slice(0, cols),
      };
      rows = [rowA, rowB];
    } else {
      rows = rows.map((t) => ({
        points: t.points.slice(0, cols),
        activations: t.activations.slice(0, cols),
      }));
    }

    const rowCount = rows.length;
    const positions = new Float32Array(rowCount * cols * 3);
    const colors = new Float32Array(rowCount * cols * 3);
    const allActs = [];
    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < cols; c++) allActs.push(rows[r].activations[c] ?? 0);
    }
    const norm = calculateZScoreNormalized(allActs, 0.85);

    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const p = rows[r].points[c];
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
        const col = getDivergentColor(norm[i], 1.0);
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
      }
    }

    const indices = [];
    for (let r = 0; r < rowCount - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c;
        const b = a + 1;
        const d = (r + 1) * cols + c;
        const e = d + 1;
        indices.push(a, d, b);
        indices.push(b, d, e);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.userData = {
      kind: 'surface',
      rowCount,
      cols,
      singleThreadStrip: threadRows.length === 1,
    };
    return mesh;
  }

  /**
   * In-situ update of surface vertex positions (compare reorder / slider refresh).
   * @param {THREE.Mesh} surfaceMesh
   * @param {Array<{ points: THREE.Vector3[] }>} threadRows  same topology as create
   */
  static updateSurfaceMeshPositions(surfaceMesh, threadRows) {
    if (!surfaceMesh?.geometry || !threadRows?.length) return;
    const { cols, rowCount, singleThreadStrip } = surfaceMesh.userData || {};
    if (!cols || !rowCount) return;

    let rows = threadRows.filter((t) => t?.points?.length);
    if (singleThreadStrip && rows.length === 1) {
      const halfW = 2.5;
      const src = rows[0].points;
      rows = [
        { points: src.slice(0, cols).map((p) => p.clone().add(new THREE.Vector3(0, 0, -halfW))) },
        { points: src.slice(0, cols).map((p) => p.clone().add(new THREE.Vector3(0, 0, halfW))) },
      ];
    }

    const pos = surfaceMesh.geometry.attributes.position;
    if (!pos) return;
    for (let r = 0; r < Math.min(rowCount, rows.length); r++) {
      for (let c = 0; c < cols; c++) {
        const p = rows[r].points[c];
        if (!p) continue;
        const i = r * cols + c;
        pos.setXYZ(i, p.x, p.y, p.z);
      }
    }
    pos.needsUpdate = true;
    surfaceMesh.geometry.computeVertexNormals();
    surfaceMesh.geometry.computeBoundingSphere();
  }
}


