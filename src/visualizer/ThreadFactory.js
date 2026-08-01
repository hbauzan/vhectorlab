import * as THREE from 'three';

const THREAD_COLORS = [
  0x6C63FF, // Neon Purple
  0x00F5FF, // Cyan
  0xFF007F, // Pink/Magenta
  0x00FF88, // Mint Green
  0xFFB800, // Gold Yellow
  0xFF5533, // Orange Red
  0x7000FF, // Deep Violet
  0x00E5FF  // Electric Blue
];

/**
 * Creates synthetic 3D vector thread data and WebGL buffer geometries.
 *
 * @param {number} count - Number of synthetic threads to generate (default 5)
 * @param {number} pointsPerThread - Number of vector points per thread (default 100)
 * @returns {Array<Object>} List of synthetic thread objects
 */
export function createSyntheticThreads(count = 5, pointsPerThread = 100) {
  const threads = [];

  for (let i = 0; i < count; i++) {
    const rawValues = new Float32Array(pointsPerThread);
    const freq = 0.05 + i * 0.02;
    const phase = i * 0.5;

    for (let p = 0; p < pointsPerThread; p++) {
      rawValues[p] = Math.sin(p * freq + phase) * 1.5 + Math.cos(p * 0.1) * 0.5;
    }

    const positions = new Float32Array(pointsPerThread * 3);
    for (let p = 0; p < pointsPerThread; p++) {
      positions[p * 3 + 0] = 0;
      positions[p * 3 + 1] = rawValues[p];
      positions[p * 3 + 2] = p * 0.1;
    }

    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3));

    const pointsGeom = new THREE.BufferGeometry();
    pointsGeom.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3));

    const threadColor = THREAD_COLORS[i % THREAD_COLORS.length];

    const lineMat = new THREE.LineBasicMaterial({
      color: threadColor,
      transparent: true,
      opacity: 0.85
    });

    const pointsMat = new THREE.PointsMaterial({
      color: threadColor,
      size: 0.1,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9
    });

    const lineMesh = new THREE.Line(lineGeom, lineMat);
    const pointsMesh = new THREE.Points(pointsGeom, pointsMat);

    // CRITICAL INVARIANT: frustumCulled = false prevents objects disappearing on stretch/move
    lineMesh.frustumCulled = false;
    pointsMesh.frustumCulled = false;

    threads.push({
      id: i,
      label: `Vector ${i}`,
      rawValues,
      color: threadColor,
      lineMesh,
      pointsMesh
    });
  }

  return threads;
}
