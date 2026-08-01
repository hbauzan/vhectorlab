import * as THREE from 'three';

/**
 * Calculates CPU color and dynamic opacity based on activation value.
 *
 * @param {number} val - Activation value (v)
 * @param {number} [absMax=1.0] - Maximum absolute value for normalization
 * @returns {{r: number, g: number, b: number, alpha: number}} Color components in [0, 1] range
 */
export function getDivergentColor(val, absMax = 1.0) {
  const denom = absMax > 1e-9 ? absMax : 1.0;
  let t = Math.max(-1.0, Math.min(1.0, val / denom));
  const absT = Math.abs(t);
  const alpha = Math.min(Math.max(Math.pow(absT, 1.2), 0.05), 1.0);

  let r = 0.0, g = 0.0, b = 0.0;
  if (t >= 0) {
    r = t;       // Positivo: Negro -> Rojo (1.0, 0.0, 0.0)
  } else {
    const f = -t;
    r = 0.55 * f; // Negativo: Negro -> Violeta (0.55, 0.0, 0.9)
    b = 0.9 * f;
  }
  return { r, g, b, alpha };
}

/**
 * GLSL Vertex Shader for Divergent Activation Points
 */
export const divergentVertexShader = `
attribute float intensity;
varying float vIntensity;
uniform float pointSize;

void main() {
    vIntensity = intensity;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float dist = length(mvPosition.xyz);
    gl_PointSize = clamp(pointSize * (300.0 / max(dist, 0.01)), 2.0, 60.0);
    gl_Position = projectionMatrix * mvPosition;
}
`;

/**
 * GLSL Fragment Shader for Divergent Activation Points
 */
export const divergentFragmentShader = `
varying float vIntensity;
uniform float baseOpacity;

void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    if (length(coord) > 0.5) discard; // Círculo perfecto

    float t = clamp(vIntensity, -1.0, 1.0);
    float absT = abs(t);
    float dynamicAlpha = clamp(pow(absT, 1.2), 0.05, 1.0) * baseOpacity;

    vec3 color = vec3(0.0);
    if (t >= 0.0) {
        color = vec3(t, 0.0, 0.0); // Positivo: Rojo
    } else {
        float f = -t;
        color = vec3(0.55 * f, 0.0, 0.9 * f); // Negativo: Violeta
    }

    gl_FragColor = vec4(color, dynamicAlpha);
}
`;

/**
 * Factory function creating a customized THREE.ShaderMaterial for GPU divergent shading.
 *
 * @param {number} [pointSize=10.0] - Base size of points
 * @param {number} [baseOpacity=1.0] - Overall opacity scalar
 * @returns {THREE.ShaderMaterial}
 */
export function createDivergentMaterial(pointSize = 10.0, baseOpacity = 1.0) {
  return new THREE.ShaderMaterial({
    uniforms: {
      pointSize: { value: pointSize },
      baseOpacity: { value: baseOpacity }
    },
    vertexShader: divergentVertexShader,
    fragmentShader: divergentFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending
  });
}
