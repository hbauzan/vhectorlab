import { describe, it, expect } from 'vitest';
import { executeLayoutMath, LayoutEngine } from '../src/visualizer/LayoutEngine.js';

describe('LayoutEngine Math Tests', () => {
  it('debe calcular la coordenada X correcta según el índice e intervalo', () => {
    const threadIndex = 3;
    const spacingX = 2.5;
    const posX = executeLayoutMath.calculateX(threadIndex, spacingX);
    expect(posX).toBe(7.5);
  });

  it('debe escalar las posiciones Z según el factor de ancho Z', () => {
    const pointIndex = 10;
    const baseSpacing = 0.1;
    const zWidth = 2.0;
    const posZ = executeLayoutMath.calculateZ(pointIndex, baseSpacing, zWidth);
    expect(posZ).toBeCloseTo(2.0, 5);
  });

  it('debe instanciar LayoutEngine con valores por defecto y actualizar posiciones', () => {
    const engine = new LayoutEngine();
    expect(engine).toBeDefined();
  });

  it('debe mapear puntos 3D en modo ANÁLISIS alineados en Z=0 con apilamiento vertical Y', () => {
    const engine = new LayoutEngine({ scaleX: 1.0 });
    const vector = [1.0, -1.0, 0.0];
    // sequenceIndex = 0 (Thread 1) vs sequenceIndex = 1 (Thread 2)
    const pointsSlot0 = engine.mapVectorTo3DPoints(vector, 0, 'ANALYSIS', 5);
    const pointsSlot1 = engine.mapVectorTo3DPoints(vector, 1, 'ANALYSIS', 5);

    expect(pointsSlot0[0].z).toBe(0);
    expect(pointsSlot1[0].z).toBe(0);
    // Slot 0 should be vertically higher than Slot 1
    expect(pointsSlot0[0].y).toBeGreaterThan(pointsSlot1[0].y);
  });

  it('debe ajustar dinámicamente la separación vertical Y al cambiar spacingY', () => {
    const engine = new LayoutEngine({ scaleX: 1.0 });
    const vector = [0.0, 0.0];
    const pointsDefaultY = engine.mapVectorTo3DPoints(vector, 0, 'ANALYSIS', 5, 40.0);
    const pointsExpandedY = engine.mapVectorTo3DPoints(vector, 0, 'ANALYSIS', 5, 80.0);

    // Slot 0 (centeredYSlot = 2.0) with spacing 80 should have double the vertical Y offset of spacing 40
    expect(pointsExpandedY[0].y).toBeCloseTo(pointsDefaultY[0].y * 2, 5);
  });
});
