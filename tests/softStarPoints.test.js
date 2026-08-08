import { describe, expect, it } from 'vitest';
import {
  POINT_EDGE_STYLE,
  resolvePointEdgeStyle,
  divergentFragmentShaderFor,
  divergentVertexShaderFor,
  createDivergentMaterial,
  divergentFragmentShader,
  divergentVertexShader,
} from '../src/visualizer/DivergentShading.js';
import { resolveGalaxyPointSize } from '../src/visualizer/galaxyLayout.js';

describe('soft star point style (Galaxy)', () => {
  it('resolvePointEdgeStyle is square by default and softStar when galaxy/softStar', () => {
    expect(resolvePointEdgeStyle()).toBe(POINT_EDGE_STYLE.SQUARE);
    expect(resolvePointEdgeStyle({})).toBe(POINT_EDGE_STYLE.SQUARE);
    expect(resolvePointEdgeStyle({ galaxy: true })).toBe(POINT_EDGE_STYLE.SOFT_STAR);
    expect(resolvePointEdgeStyle({ softStar: true })).toBe(POINT_EDGE_STYLE.SOFT_STAR);
    expect(resolvePointEdgeStyle({ galaxy: false, softStar: false })).toBe(POINT_EDGE_STYLE.SQUARE);
  });

  it('soft-star fragment uses radial disc mask, not Chebyshev square', () => {
    const soft = divergentFragmentShaderFor(POINT_EDGE_STYLE.SOFT_STAR);
    const square = divergentFragmentShaderFor(POINT_EDGE_STYLE.SQUARE);
    expect(soft).toContain('length(gl_PointCoord');
    expect(soft).not.toContain('max(coord.x, coord.y)');
    expect(square).toContain('max(coord.x, coord.y)');
    expect(square).toBe(divergentFragmentShader);
  });

  it('soft-star vertex uses smaller clamp ceiling (~¼ prior soft-star)', () => {
    const softV = divergentVertexShaderFor(POINT_EDGE_STYLE.SOFT_STAR);
    const squareV = divergentVertexShaderFor(POINT_EDGE_STYLE.SQUARE);
    expect(softV).toContain('35.0');
    expect(squareV).toContain('80.0');
    expect(squareV).toBe(divergentVertexShader);
  });

  it('soft-star fragment has solid core + soft halo', () => {
    const soft = divergentFragmentShaderFor(POINT_EDGE_STYLE.SOFT_STAR);
    expect(soft).toContain('float core');
    expect(soft).toContain('float halo');
  });

  it('createDivergentMaterial picks soft shaders when galaxy: true', () => {
    const mat = createDivergentMaterial(24, 1, { galaxy: true });
    expect(mat.userData.pointEdgeStyle).toBe(POINT_EDGE_STYLE.SOFT_STAR);
    expect(mat.fragmentShader).toContain('length(gl_PointCoord');
    const square = createDivergentMaterial(14, 1, {});
    expect(square.userData.pointEdgeStyle).toBe(POINT_EDGE_STYLE.SQUARE);
    expect(square.fragmentShader).toContain('max(coord.x, coord.y)');
  });

  it('resolveGalaxyPointSize is ~¼ prior soft-star floor', () => {
    expect(resolveGalaxyPointSize(0.05)).toBeCloseTo(6.5);
    expect(resolveGalaxyPointSize(0.01)).toBeCloseTo(6.5);
    expect(resolveGalaxyPointSize(0.3)).toBeGreaterThan(resolveGalaxyPointSize(0.05));
  });
});
