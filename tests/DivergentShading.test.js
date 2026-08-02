import { describe, it, expect } from 'vitest';
import { getDivergentColor } from '../src/visualizer/DivergentShading.js';

describe('Divergent Shading CPU Algorithm', () => {
  it('debe mapear valores positivos pico (+1.0) a Amarillo Incandescente', () => {
    const { r, g, b, alpha } = getDivergentColor(1.0, 1.0);
    expect(r).toBeCloseTo(1.0, 5);
    expect(g).toBeCloseTo(0.95, 5);
    expect(b).toBe(0.0);
    expect(alpha).toBeCloseTo(1.0, 5);
  });

  it('debe mapear valores positivos intermedios (+0.5) a Naranja', () => {
    const { r, g, b } = getDivergentColor(0.5, 1.0);
    expect(r).toBeCloseTo(1.0, 5);
    expect(g).toBeCloseTo(0.5, 5);
    expect(b).toBe(0.0);
  });

  it('debe mapear el valor cero (0) a Negro con opacidad mínima (~0.05)', () => {
    const { r, g, b, alpha } = getDivergentColor(0.0, 1.0);
    expect(r).toBe(0.0);
    expect(g).toBe(0.0);
    expect(b).toBe(0.0);
    expect(alpha).toBeCloseTo(0.05, 5);
  });

  it('debe optimizar y mapear valores con |t| < 0.01 directamente a Negro con opacidad mínima (~0.05)', () => {
    const { r, g, b, alpha } = getDivergentColor(0.005, 1.0);
    expect(r).toBe(0.0);
    expect(g).toBe(0.0);
    expect(b).toBe(0.0);
    expect(alpha).toBeCloseTo(0.05, 5);
  });

  it('debe mapear valores negativos intermedios (-0.5) a Azul Eléctrico', () => {
    const { r, g, b } = getDivergentColor(-0.5, 1.0);
    expect(r).toBeCloseTo(0.0, 5);
    expect(g).toBeCloseTo(0.25, 5);
    expect(b).toBeCloseTo(1.0, 5);
  });

  it('debe mapear valores negativos pico (-1.0) a Violeta Neón', () => {
    const { r, g, b, alpha } = getDivergentColor(-1.0, 1.0);
    expect(r).toBeCloseTo(0.6, 5);
    expect(g).toBeCloseTo(0.0, 5);
    expect(b).toBeCloseTo(0.9, 5);
    expect(alpha).toBeCloseTo(1.0, 5);
  });
});
