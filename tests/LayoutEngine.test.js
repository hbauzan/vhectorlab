import { describe, it, expect } from 'vitest';
import { executeLayoutMath, LayoutEngine } from '../src/visualizer/LayoutEngine.js';

describe('LayoutEngine Math Tests', () => {
  it('computes X from index and interval', () => {
    const threadIndex = 3;
    const spacingX = 2.5;
    const posX = executeLayoutMath.calculateX(threadIndex, spacingX);
    expect(posX).toBe(7.5);
  });

  it('scales Z positions by width factor', () => {
    const pointIndex = 10;
    const baseSpacing = 0.1;
    const zWidth = 2.0;
    const posZ = executeLayoutMath.calculateZ(pointIndex, baseSpacing, zWidth);
    expect(posZ).toBeCloseTo(2.0, 5);
  });

  it('constructs LayoutEngine with defaults and updates positions', () => {
    const engine = new LayoutEngine();
    expect(engine).toBeDefined();
  });

  it('maps 3D points in ANALYSIS mode aligned at Z=0 with vertical Y stack', () => {
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

  it('dynamically adjusts vertical Y spacing when spacingY changes', () => {
    const engine = new LayoutEngine({ scaleX: 1.0 });
    const vector = [0.0, 0.0];
    const pointsDefaultY = engine.mapVectorTo3DPoints(vector, 0, 'ANALYSIS', 5, 40.0);
    const pointsExpandedY = engine.mapVectorTo3DPoints(vector, 0, 'ANALYSIS', 5, 80.0);

    // Slot 0 (centeredYSlot = 2.0) with spacing 80 should have double the vertical Y offset of spacing 40
    expect(pointsExpandedY[0].y).toBeCloseTo(pointsDefaultY[0].y * 2, 5);
  });
});
