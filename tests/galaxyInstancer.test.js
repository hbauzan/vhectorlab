import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Instancer } from '../src/visualizer/Instancer.js';
import { IT_CORE_GROUP_ID } from '../src/ui/itCoreCorpus.js';
import {
  GALAXY_DEFAULT_SCALE,
  GALAXY_SPACING_TO_SCALE,
} from '../src/visualizer/galaxyLayout.js';

describe('Instancer.renderGalaxyData', () => {
  it('mounts a single POINTS mesh and no ribbons', () => {
    const scene = new THREE.Scene();
    const instancer = new Instancer(scene);

    const compareResponse = {
      count: 3,
      items: [
        {
          id: 'tok_0',
          text: 'server',
          embedding: [0.1, 0.2],
          groupId: IT_CORE_GROUP_ID,
          cosine_vs_first: 1,
        },
        {
          id: 'tok_1',
          text: 'car',
          embedding: [0.2, 0.1],
          groupId: 'vehicles',
          cosine_vs_first: 0.1,
        },
        {
          id: 'tok_2',
          text: 'grace',
          embedding: [0.0, 0.3],
          groupId: 'women',
          cosine_vs_first: 0.05,
        },
      ],
    };
    const positions = [
      [0.1, 0.2, 0.3],
      [-0.4, 0.1, 0.0],
      [0.0, -0.2, 0.5],
    ];

    const labels = instancer.renderGalaxyData(compareResponse, positions);
    expect(labels).toHaveLength(3);
    expect(labels[0].text).toBe('server');
    expect(labels[0].groupId).toBe(IT_CORE_GROUP_ID);
    expect(labels[0].origin3D.x).toBeCloseTo(0.1 * GALAXY_DEFAULT_SCALE);

    expect(instancer.activeGroup.children).toHaveLength(1);
    expect(instancer.activeGroup.children[0].type).toBe('Points');
    expect(instancer.activeGroup.children[0].userData.galaxy).toBe(true);
    expect(instancer.compareRuntime).toBeNull();
  });

  it('scales from threadSpacing via resolveGalaxyWorldScale', () => {
    const scene = new THREE.Scene();
    const instancer = new Instancer(scene);
    const compareResponse = {
      items: [
        { id: 'a', text: 'a', embedding: [0], cosine_vs_first: 1 },
      ],
    };
    const positions = [[1, 0, 0]];
    const spacing = 0.5;
    const labels = instancer.renderGalaxyData(compareResponse, positions, {
      threadSpacing: spacing,
      threadThickness: 0.05,
    });
    expect(labels[0].origin3D.x).toBeCloseTo(spacing * GALAXY_SPACING_TO_SCALE);
  });

  it('mounts soft-star Galaxy POINTS material', () => {
    const scene = new THREE.Scene();
    const instancer = new Instancer(scene);
    const compareResponse = {
      items: [
        {
          id: 'tok_0',
          text: 'server',
          embedding: [0.1],
          groupId: IT_CORE_GROUP_ID,
          cosine_vs_first: 1,
        },
      ],
    };
    instancer.renderGalaxyData(compareResponse, [[0.1, 0.2, 0.3]], {
      threadSpacing: 0.4,
      threadThickness: 0.05,
    });
    const mesh = instancer.activeGroup.children[0];
    expect(mesh.userData.galaxy).toBe(true);
    expect(mesh.material.userData.pointEdgeStyle).toBe('softStar');
    expect(mesh.material.fragmentShader).toContain('length(gl_PointCoord');
    expect(mesh.material.uniforms.pointSize.value).toBeGreaterThanOrEqual(6);
  });

  it('returns empty when positions missing', () => {
    const scene = new THREE.Scene();
    const instancer = new Instancer(scene);
    expect(instancer.renderGalaxyData({ items: [{ text: 'a', embedding: [1] }] }, null)).toEqual([]);
    expect(instancer.activeGroup.children).toHaveLength(0);
  });
});
