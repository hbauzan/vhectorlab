import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { LayoutEngine } from '../src/visualizer/LayoutEngine.js';
import { PointShader } from '../src/engine/Shaders.js';
import { MeshFactory } from '../src/visualizer/MeshFactory.js';

describe('WebGL 3D Engine & Spatial Math', () => {
  it('LayoutEngine maps 1D embedding vector into 3D space correctly', () => {
    const layout = new LayoutEngine({ scaleX: 1.0, scaleY: 100.0, scaleZ: 10.0 });
    const rawVector = [0.1, 0.5, -0.2];
    
    const points = layout.mapVectorTo3DPoints(rawVector, 1);
    
    expect(points.length).toBe(3);
    expect(points[0]).toBeInstanceOf(THREE.Vector3);
    expect(points[1].y).toBeCloseTo(50.0);
    expect(points[0].z).toBe(10.0);
  });

  it('PointShader defines valid vertex and fragment shader GLSL sources', () => {
    expect(PointShader.vertexShader).toContain('attribute float aActivation');
    expect(PointShader.fragmentShader).toContain('gl_FragColor');
    expect(PointShader.fragmentShader).toContain('smoothstep');
  });

  it('MeshFactory enforces Invariant 3: frustumCulled = false on point cloud mesh', () => {
    const testPointsData = [
      { position: new THREE.Vector3(0, 10, 0), activation: 0.8, size: 14.0 },
      { position: new THREE.Vector3(5, 20, 5), activation: 0.3, size: 10.0 }
    ];

    const pointsMesh = MeshFactory.createPointsMesh(testPointsData);
    
    expect(pointsMesh).toBeInstanceOf(THREE.Points);
    expect(pointsMesh.frustumCulled).toBe(false);
  });
});
