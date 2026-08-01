import { describe, it, expect } from 'vitest';
import { getDivergentColor } from '../src/visualizer/DivergentShading.js';

describe('Divergent Shading CPU Algorithm (Multi-Stop Heatmap)', () => {
  it('debe mapear valores positivos pico a Amarillo Incandescente', () => {
    const { r, g, b, alpha } = getDivergentColor(1.0, 1.0);
    expect(r).toBeCloseTo(1.0, 5);
    expect(g).toBeCloseTo(0.9, 5);
    expect(b).toBeCloseTo(0.2, 5);
    expect(alpha).toBeCloseTo(1.0, 5);
  });

  it('debe mapear el valor cero a Negro con opacidad mínima (~0.05)', () => {
    const { r, g, b, alpha } = getDivergentColor(0.0, 1.0);
    expect(r).toBe(0.0);
    expect(g).toBe(0.0);
    expect(b).toBe(0.0);
    expect(alpha).toBeCloseTo(0.05, 5);
  });

  it('debe mapear valores negativos pico a Cian Neón', () => {
    const { r, g, b, alpha } = getDivergentColor(-1.0, 1.0);
    expect(r).toBeCloseTo(0.0, 5);
    expect(g).toBeCloseTo(0.95, 5);
    expect(b).toBeCloseTo(1.0, 5);
    expect(alpha).toBeCloseTo(1.0, 5);
  });
});
