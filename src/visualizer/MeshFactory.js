import * as THREE from 'three';
import { createDivergentMaterial, getDivergentColor, calculateZScoreNormalized } from './DivergentShading.js';
import {
  anchorsFromSettings,
  resolveVisualizationSettings,
  effectiveZeroCoveragePercent,
  normalizeHex,
} from '../ui/visualizationControlsDefaults.js';
import { lineSegmentIndices, wideRibbonQuadIndices } from './activationFilter.js';
import {
  buildPointGroupPaintAttributes,
} from './groupDimContrast.js';
import { colorForActivationWithGroupHue, getGroupHueColor } from './groupHuePaint.js';

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
    zeroCoverage: effectiveZeroCoveragePercent(viz),
    viz,
    groupDimMetrics: options.groupDimMetrics || null,
    sourceDims: options.sourceDims || null,
    groupId: options.groupId || null,
  };
}

/**
 * Paint one activation with divergent/group-hue + optional group-dim contrast.
 * @param {number} normVal
 * @param {number|undefined} sourceDim
 * @param {ReturnType<typeof resolveVizOptions>} resolved
 */
function colorForActivation(normVal, sourceDim, resolved) {
  return colorForActivationWithGroupHue(normVal, sourceDim, resolved);
}

/**
 * Base color only (no Shared noise / Sign conflict) for POINTS aBaseColor.
 * @param {number} normVal
 * @param {string|null|undefined} groupId
 * @param {ReturnType<typeof resolveVizOptions>} resolved
 */
function baseColorForPoint(normVal, groupId, resolved) {
  const viz = resolved.viz;
  const hex = viz?.groupHueEnabled && groupId
    ? normalizeHex(viz.groupHueColors?.[groupId])
    : null;
  if (hex) return getGroupHueColor(normVal, hex, resolved.zeroCoverage);
  return getDivergentColor(normVal, 1.0, resolved.anchors, resolved.zeroCoverage);
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
    const resolved = resolveVizOptions(options);
    const { filterMode, anchors, zeroCoverage, viz, groupDimMetrics } = resolved;

    pointsData.forEach((item) => {
      const pos = item.position;
      positions.push(pos.x, pos.y, pos.z);
      rawActivations.push(item.activation !== undefined ? item.activation : 0.0);
    });

    const normIntensities = calculateZScoreNormalized(rawActivations, 0.85);
    const { cancel, highlight } = buildPointGroupPaintAttributes(pointsData, groupDimMetrics, viz);

    const useGroupHue = Boolean(viz.groupHueEnabled);
    const baseColors = new Float32Array(pointsData.length * 3);
    if (useGroupHue) {
      for (let i = 0; i < pointsData.length; i++) {
        const col = baseColorForPoint(
          normIntensities[i],
          pointsData[i]?.groupId || pointsData[i]?.meta?.groupId,
          resolved,
        );
        baseColors[i * 3] = col.r;
        baseColors[i * 3 + 1] = col.g;
        baseColors[i * 3 + 2] = col.b;
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('intensity', new THREE.Float32BufferAttribute(normIntensities, 1));
    geometry.setAttribute('aCancel', new THREE.Float32BufferAttribute(cancel, 1));
    geometry.setAttribute('aHighlight', new THREE.Float32BufferAttribute(highlight, 1));
    geometry.setAttribute('aBaseColor', new THREE.Float32BufferAttribute(baseColors, 3));

    const pointSize = options.pointSize || 14.0;
    const material = createDivergentMaterial(pointSize, 1.0, {
      anchors,
      filterMode,
      zeroCoverage,
      highlightColor: viz.oppositeHighlightColor,
      softStar: options.softStar === true,
      galaxy: options.galaxy === true,
      useGroupHueBase: useGroupHue,
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
    const resolved = resolveVizOptions(options);
    const { filterMode, sourceDims } = resolved;
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    let normActivations = null;
    if (activations && activations.length === points.length) {
      normActivations = calculateZScoreNormalized(activations, 0.85);
      const colors = new Float32Array(points.length * 3);
      for (let idx = 0; idx < normActivations.length; idx++) {
        const srcDim = sourceDims ? sourceDims[idx] : idx;
        const col = colorForActivation(normActivations[idx], srcDim, resolved);
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
      activations: activations ? Array.from(activations) : null,
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
   * Dim-axis ruler: same LineSegments look as token continuity threads (§ POINTS ribbons).
   * @param {Array<{ start: { x: number, y: number, z?: number }, end: { x: number, y: number, z?: number } }>} segments
   * @param {{ color?: string|number, thickness?: number }} [options]
   * @returns {THREE.LineSegments|null}
   */
  static createDimRulerMesh(segments, options = {}) {
    if (!segments || segments.length < 1) return null;

    const hex = typeof options.color === 'string' ? normalizeHex(options.color) : null;
    const color = hex
      ? new THREE.Color(hex)
      : new THREE.Color(typeof options.color === 'number' ? options.color : 0xffffff);

    // thickness 1…20 → opacity 0.55…0.95 (WebGL linewidth stays ~1px like thread lines)
    const t = typeof options.thickness === 'number' && Number.isFinite(options.thickness)
      ? options.thickness
      : 4;
    const opacity = Math.max(0.55, Math.min(0.95, 0.55 + ((t - 1) / 19) * 0.4));

    const positions = new Float32Array(segments.length * 2 * 3);
    for (let i = 0; i < segments.length; i += 1) {
      const s = segments[i].start;
      const e = segments[i].end;
      const z0 = Number.isFinite(s.z) ? s.z : 0;
      const z1 = Number.isFinite(e.z) ? e.z : z0;
      const lo = i * 6;
      positions[lo] = s.x;
      positions[lo + 1] = s.y;
      positions[lo + 2] = z0;
      positions[lo + 3] = e.x;
      positions[lo + 4] = e.y;
      positions[lo + 5] = z1;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.LineBasicMaterial({
      color,
      linewidth: 2,
      transparent: true,
      opacity,
    });

    const lineMesh = new THREE.LineSegments(geometry, material);
    lineMesh.name = 'DimRuler';
    lineMesh.frustumCulled = false;
    lineMesh.userData.kind = 'dimRuler';
    return lineMesh;
  }

  /**
   * Dispose a dim-ruler mesh created by createDimRulerMesh.
   * @param {THREE.Object3D|null|undefined} mesh
   */
  static disposeDimRulerMesh(mesh) {
    if (!mesh) return;
    mesh.traverse((child) => {
      child.geometry?.dispose?.();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose?.());
        else child.material.dispose?.();
      }
    });
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
    const resolved = resolveVizOptions(options);
    const { filterMode, sourceDims } = resolved;
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

      const srcDim = sourceDims ? sourceDims[i] : i;
      const col = colorForActivation(norm[i], srcDim, resolved);
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
    mesh.userData = {
      kind: 'wideRibbon',
      pointCount: n,
      width,
      activations: Array.from(acts),
    };
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
