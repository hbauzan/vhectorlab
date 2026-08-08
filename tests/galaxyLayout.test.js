import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { IT_CORE_GROUP_ID } from '../src/ui/itCoreCorpus.js';
import {
  boundingBoxFromLabels,
  centroidForGroup,
  galaxyCameraTarget,
  GALAXY_DEFAULT_SCALE,
  GALAXY_MIN_SCALE,
  GALAXY_SPACING_TO_SCALE,
  layoutGalaxyPoints,
  resolveGalaxyWorldScale,
} from '../src/visualizer/galaxyLayout.js';

describe('galaxyLayout', () => {
  it('maps one world point per token from positions', () => {
    const items = [
      { id: 'a', text: 'server', groupId: IT_CORE_GROUP_ID, cosine_vs_first: 1 },
      { id: 'b', text: 'car', groupId: 'vehicles', cosine_vs_first: 0.2 },
    ];
    const positions = [
      [1, 0, 0],
      [0, 1, 0],
    ];
    const { pointsData, labels, scale } = layoutGalaxyPoints(items, positions, { scale: 10 });
    expect(scale).toBe(10);
    expect(pointsData).toHaveLength(2);
    expect(labels).toHaveLength(2);
    expect(labels[0].origin3D).toEqual(new THREE.Vector3(10, 0, 0));
    expect(labels[1].origin3D).toEqual(new THREE.Vector3(0, 10, 0));
    expect(pointsData[0].meta.token).toBe('server');
  });

  it('default layout scale matches GALAXY_DEFAULT_SCALE', () => {
    const { scale } = layoutGalaxyPoints(
      [{ id: 'a', text: 'x', cosine_vs_first: 0 }],
      [[1, 0, 0]],
    );
    expect(scale).toBe(GALAXY_DEFAULT_SCALE);
    expect(GALAXY_DEFAULT_SCALE).toBeGreaterThan(48);
  });

  it('resolveGalaxyWorldScale maps spacing and floors tiny values', () => {
    expect(resolveGalaxyWorldScale(null)).toBe(GALAXY_DEFAULT_SCALE);
    expect(resolveGalaxyWorldScale({ threadSpacing: 0.4 })).toBeCloseTo(
      0.4 * GALAXY_SPACING_TO_SCALE,
    );
    expect(resolveGalaxyWorldScale({ threadSpacing: 0.01 })).toBe(GALAXY_MIN_SCALE);
  });

  it('centroidForGroup averages member origins', () => {
    const labels = [
      { groupId: IT_CORE_GROUP_ID, origin3D: new THREE.Vector3(0, 0, 0) },
      { groupId: IT_CORE_GROUP_ID, origin3D: new THREE.Vector3(2, 4, 6) },
      { groupId: 'vehicles', origin3D: new THREE.Vector3(100, 0, 0) },
    ];
    const c = centroidForGroup(labels, IT_CORE_GROUP_ID);
    expect(c.x).toBeCloseTo(1);
    expect(c.y).toBeCloseTo(2);
    expect(c.z).toBeCloseTo(3);
  });

  it('galaxyCameraTarget prefers IT core, else all bbox center', () => {
    const withCore = [
      { groupId: IT_CORE_GROUP_ID, origin3D: new THREE.Vector3(1, 2, 3) },
      { groupId: 'vehicles', origin3D: new THREE.Vector3(50, 0, 0) },
    ];
    const t1 = galaxyCameraTarget(withCore);
    expect(t1.source).toBe(IT_CORE_GROUP_ID);
    expect(t1.lookAt).toEqual(new THREE.Vector3(1, 2, 3));

    const noCore = [
      { groupId: 'vehicles', origin3D: new THREE.Vector3(0, 0, 0) },
      { groupId: 'women', origin3D: new THREE.Vector3(10, 0, 0) },
    ];
    const t2 = galaxyCameraTarget(noCore);
    expect(t2.source).toBe('all');
    expect(t2.lookAt.x).toBeCloseTo(5);

    expect(boundingBoxFromLabels([]).isEmpty()).toBe(true);
  });
});
