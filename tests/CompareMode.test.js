import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Instancer } from '../src/visualizer/Instancer.js';

describe('Compare Mode Sequence Engine', () => {
  it('debe procesar e instanciar secuencias de tokens de 1 a 1024 elementos', () => {
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

  it('debe retornar lista vacía si la respuesta de compare es nula o vacía', () => {
    const scene = new THREE.Scene();
    const instancer = new Instancer(scene);

    const labels = instancer.renderCompareData(null, 'POINTS', null, 'NAVIGATION');
    expect(labels).toEqual([]);
    expect(instancer.activeGroup.children.length).toBe(0);
  });

  it('debe soportar secuencias grandes (ej. 50 tokens)', () => {
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
});
