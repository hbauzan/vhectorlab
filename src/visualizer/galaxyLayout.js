/**
 * Galaxy VIEW layout helpers — 1 world point per token from UMAP positions.
 * No LayoutEngine / dim-threads.
 */

import * as THREE from 'three';
import { IT_CORE_GROUP_ID } from '../ui/itCoreCorpus.js';

/**
 * Default world scale for server-normalized (RMS≈1) UMAP coords.
 * Raised (was 48) so Galaxy feels spacious with the slower flight profile.
 */
export const GALAXY_DEFAULT_SCALE = 96;

/**
 * Maps Spatial `threadSpacing` → galaxy world scale.
 * At global default spacing 0.4 → 96 (matches GALAXY_DEFAULT_SCALE).
 * Was 40 (→ scale 16 at spacing 0.4 — cramped).
 */
export const GALAXY_SPACING_TO_SCALE = 240;

/** Floor so tiny spacing sliders never collapse the cloud. */
export const GALAXY_MIN_SCALE = 32;

/** Soft-star base pointSize floor (¼ of prior 26 after soft-star pass). */
export const GALAXY_POINT_SIZE_FLOOR = 6.5;

/**
 * Resolve Galaxy world scale from Spatial sliders (or default).
 * @param {{ threadSpacing?: number }|null|undefined} spatialConfig
 * @returns {number}
 */
export function resolveGalaxyWorldScale(spatialConfig) {
  if (spatialConfig && spatialConfig.threadSpacing !== undefined) {
    const raw = Number(spatialConfig.threadSpacing) * GALAXY_SPACING_TO_SCALE;
    return Math.max(GALAXY_MIN_SCALE, Number.isFinite(raw) ? raw : GALAXY_DEFAULT_SCALE);
  }
  return GALAXY_DEFAULT_SCALE;
}

/**
 * Readable Galaxy POINTS size after world scale↑ (camera farther).
 * Thickness still modulates above the floor. Sized ≈¼ of first soft-star pass.
 * @param {number} [threadThickness=0.05]
 * @returns {number}
 */
export function resolveGalaxyPointSize(threadThickness = 0.05) {
  const t = Number.isFinite(threadThickness) ? threadThickness : 0.05;
  return Math.max(GALAXY_POINT_SIZE_FLOOR, 30 * Math.max(t, 0));
}

/**
 * @param {Array<{ id?: string, text?: string, groupId?: string, groupLabel?: string, cosine_vs_first?: number }>} items
 * @param {number[][]} positions  rows of length 2 or 3
 * @param {{ scale?: number }} [opts]
 * @returns {{
 *   pointsData: Array<{ position: THREE.Vector3, activation: number, size: number, meta: object }>,
 *   labels: Array<{ id: string, text: string, type: string, origin3D: THREE.Vector3, groupId?: string, groupLabel?: string }>,
 *   scale: number,
 * }}
 */
export function layoutGalaxyPoints(items, positions, opts = {}) {
  const scale = Number.isFinite(opts.scale) && opts.scale > 0
    ? opts.scale
    : GALAXY_DEFAULT_SCALE;
  const list = Array.isArray(items) ? items : [];
  const pos = Array.isArray(positions) ? positions : [];
  const n = Math.min(list.length, pos.length);

  const pointsData = [];
  const labels = [];

  for (let i = 0; i < n; i++) {
    const item = list[i];
    const row = pos[i];
    if (!row || row.length < 2) continue;
    const x = Number(row[0]) * scale;
    const y = Number(row[1]) * scale;
    const z = (row.length >= 3 ? Number(row[2]) : 0) * scale;
    if (![x, y, z].every(Number.isFinite)) continue;

    const origin3D = new THREE.Vector3(x, y, z);
    const activation = Number.isFinite(item.cosine_vs_first) ? item.cosine_vs_first : 0;
    const id = item.id || `tok_${i}`;
    const text = item.text || id;

    pointsData.push({
      position: origin3D,
      activation,
      size: 12,
      groupId: item.groupId,
      meta: { type: 'compare', token: text, dim: 0, val: activation, groupId: item.groupId },
    });
    labels.push({
      id,
      text,
      type: 'compare',
      origin3D,
      groupId: item.groupId,
      groupLabel: item.groupLabel || item.groupId,
    });
  }

  return { pointsData, labels, scale };
}

/**
 * @param {Array<{ origin3D: THREE.Vector3, groupId?: string }>} labels
 * @param {string} groupId
 * @returns {THREE.Vector3|null}
 */
export function centroidForGroup(labels, groupId) {
  const members = (labels || []).filter((l) => l.groupId === groupId && l.origin3D);
  if (!members.length) return null;
  const c = new THREE.Vector3();
  members.forEach((l) => c.add(l.origin3D));
  c.multiplyScalar(1 / members.length);
  return c;
}

/**
 * @param {Array<{ origin3D: THREE.Vector3 }>} labels
 * @returns {THREE.Box3}
 */
export function boundingBoxFromLabels(labels) {
  const box = new THREE.Box3();
  let any = false;
  for (const l of labels || []) {
    if (!l?.origin3D) continue;
    box.expandByPoint(l.origin3D);
    any = true;
  }
  if (!any) box.makeEmpty();
  return box;
}

/**
 * Camera look-at: GROUP_it_core centroid, else bbox center of all points.
 * @param {Array<{ origin3D: THREE.Vector3, groupId?: string }>} labels
 * @param {string} [preferredGroupId=IT_CORE_GROUP_ID]
 * @returns {{ lookAt: THREE.Vector3, source: string, box: THREE.Box3 }|null}
 */
export function galaxyCameraTarget(labels, preferredGroupId = IT_CORE_GROUP_ID) {
  const box = boundingBoxFromLabels(labels);
  if (box.isEmpty()) return null;

  const core = centroidForGroup(labels, preferredGroupId);
  if (core) {
    return { lookAt: core, source: preferredGroupId, box };
  }

  const center = new THREE.Vector3();
  box.getCenter(center);
  return { lookAt: center, source: 'all', box };
}
