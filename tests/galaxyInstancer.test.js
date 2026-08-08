import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Instancer } from '../src/visualizer/Instancer.js';
import { IT_CORE_GROUP_ID } from '../src/ui/itCoreCorpus.js';

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
          groupId: 'GROUP_1',
          cosine_vs_first: 0.1,
        },
        {
          id: 'tok_2',
          text: 'grace',
          embedding: [0.0, 0.3],
          groupId: 'GROUP_2',
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

    expect(instancer.activeGroup.children).toHaveLength(1);
    expect(instancer.activeGroup.children[0].type).toBe('Points');
    expect(instancer.activeGroup.children[0].userData.galaxy).toBe(true);
    expect(instancer.compareRuntime).toBeNull();
  });

  it('returns empty when positions missing', () => {
    const scene = new THREE.Scene();
    const instancer = new Instancer(scene);
    expect(instancer.renderGalaxyData({ items: [{ text: 'a', embedding: [1] }] }, null)).toEqual([]);
    expect(instancer.activeGroup.children).toHaveLength(0);
  });
});
