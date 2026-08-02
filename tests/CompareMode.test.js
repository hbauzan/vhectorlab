import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Instancer } from '../src/visualizer/Instancer.js';

describe('Compare Mode Sequence Engine', () => {
  it('processes and instantiates token sequences from 1 to 1024', () => {
    const scene = new THREE.Scene();
    const instancer = new Instancer(scene);

    const mockCompareResponse = {
      count: 4,
      items: [
        { id: 'tok_0', index: 0, text: 'king', embedding: new Array(768).fill(0.05) },
        { id: 'tok_1', index: 1, text: 'queen', embedding: new Array(768).fill(-0.05) },
        { id: 'tok_2', index: 2, text: 'man', embedding: new Array(768).fill(0.1) },
        { id: 'tok_3', index: 3, text: 'woman', embedding: new Array(768).fill(-0.1) },
      ]
    };

    const labels = instancer.renderCompareData(mockCompareResponse, 'POINTS', null, 'ANALYSIS');

    expect(labels.length).toBe(4);
    expect(labels[0].text).toBe('king');
    expect(labels[1].text).toBe('queen');
    expect(labels[2].text).toBe('man');
    expect(labels[3].text).toBe('woman');

    // Group should contain ribbon meshes, baseline mesh, and points mesh
    expect(instancer.activeGroup.children.length).toBeGreaterThanOrEqual(5);
  });

  it('returns an empty list when compare response is null or empty', () => {
    const scene = new THREE.Scene();
    const instancer = new Instancer(scene);

    const labels = instancer.renderCompareData(null, 'POINTS', null, 'NAVIGATION');
    expect(labels).toEqual([]);
    expect(instancer.activeGroup.children.length).toBe(0);
  });

  it('supports large sequences (e.g. 50 tokens)', () => {
    const scene = new THREE.Scene();
    const instancer = new Instancer(scene);

    const items = [];
    for (let i = 0; i < 50; i++) {
      items.push({
        id: `tok_${i}`,
        index: i,
        text: `token_${i}`,
        embedding: new Array(768).fill(0.01 * (i + 1))
      });
    }

    const mockCompareResponse = { count: 50, items };
    const labels = instancer.renderCompareData(mockCompareResponse, 'POINTS', null, 'ANALYSIS');

    expect(labels.length).toBe(50);
    expect(labels[49].text).toBe('token_49');
  });

  it('reorders 3D threads with in-place tween (reuse meshes, new sequenceIndex)', async () => {
    const scene = new THREE.Scene();
    const instancer = new Instancer(scene);

    const mockCompareResponse = {
      count: 3,
      anchor: { index: 0, text: 'king' },
      items: [
        { id: 'tok_0', index: 0, text: 'king', embedding: [0.1, -0.1, 0.2], cosine_vs_first: 1 },
        { id: 'tok_1', index: 1, text: 'queen', embedding: [0.2, 0.1, -0.1], cosine_vs_first: 0.5 },
        { id: 'tok_2', index: 2, text: 'man', embedding: [-0.1, 0.2, 0.1], cosine_vs_first: 0.2 },
      ],
    };

    instancer.renderCompareData(mockCompareResponse, 'POINTS', null, 'ANALYSIS');
    const ribbonBefore = instancer.compareRuntime.threads.map((t) => t.ribbonMesh);
    const yBefore = instancer.compareRuntime.threads.map((t) => {
      const attr = t.ribbonMesh.geometry.attributes.position;
      return attr.getY(0);
    });

    // Instant tween for deterministic test
    const labels = await instancer.animateCompareReorder(
      ['tok_1', 'tok_0', 'tok_2'],
      { duration: 0 }
    );

    // Same ribbon mesh identities (no destroy/rebuild)
    expect(instancer.compareRuntime.threads.map((t) => t.ribbonMesh)).toEqual(ribbonBefore);
    expect(instancer.compareRuntime.threads.map((t) => t.sequenceIndex)).toEqual([1, 0, 2]);

    const yAfter = instancer.compareRuntime.threads.map((t) => {
      const attr = t.ribbonMesh.geometry.attributes.position;
      return attr.getY(0);
    });
    // tok_0 moved from slot 0 → 1 (lower Y in ANALYSIS); tok_1 from 1 → 0 (higher Y)
    expect(yAfter[0]).toBeLessThan(yBefore[0]);
    expect(yAfter[1]).toBeGreaterThan(yBefore[1]);
    expect(labels.map((l) => l.id)).toEqual(['tok_0', 'tok_1', 'tok_2']);
  });
});
