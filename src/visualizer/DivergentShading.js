import * as THREE from 'three';

/**
 * Calculates Z-score standardized and Tanh normalized activations across a dataset.
 * Spreads activation values symmetrically across the full [-1.0, 1.0] gamut using std deviation.
 *
 * @param {Array<number>} values - Raw activation values
 * @param {number} [scaleFactor=1.2] - Sensitivity scale factor for Tanh curve
 * @returns {Float32Array} Normalized values in [-1.0, 1.0]
 */
export function calculateZScoreNormalized(values, scaleFactor = 1.2) {
  if (!values || !values.length) return new Float32Array(0);
  const n = values.length;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += values[i];
  const mean = sum / n;

  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const diff = values[i] - mean;
    sumSq += diff * diff;
  }
  const std = Math.sqrt(sumSq / n) || 1.0;

  const result = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const z = (values[i] - mean) / (std + 1e-9);
    result[i] = Math.tanh(scaleFactor * z);
  }
  return result;
}

/**
 * Calculates CPU color and dynamic opacity based on activation value.
 *
 * Color Ramps:
 * Positive (0 to +1): Negro (0) -> Rojo (0.33) -> Naranja (0.66) -> Amarillo (+1)
 * Negative (0 to -1): Negro (0) -> Verde (-0.33) -> Azul (-0.66) -> Violeta (-1)
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

  if (t > 0) {
    // Positivo (0 a +1): Negro -> Rojo -> Naranja -> Amarillo
    if (t < 0.33) {
      const k = t / 0.33;
      r = k;
      g = 0.0;
      b = 0.0;
    } else if (t < 0.66) {
      const k = (t - 0.33) / 0.33;
      r = 1.0;
      g = 0.5 * k;
      b = 0.0;
    } else {
      const k = (t - 0.66) / 0.34;
      r = 1.0;
      g = 0.5 + 0.45 * k;
      b = 0.0;
    }
  } else if (t < 0) {
    // Negativo (0 a -1): Negro -> Verde -> Azul -> Violeta
    const f = -t;
    if (f < 0.33) {
      const k = f / 0.33;
      r = 0.0;
      g = 0.9 * k;
      b = 0.1 * k;
    } else if (f < 0.66) {
      const k = (f - 0.33) / 0.33;
      r = 0.0;
      g = 0.9 * (1.0 - k) + 0.2 * k;
      b = 0.1 * (1.0 - k) + 1.0 * k;
    } else {
      const k = (f - 0.66) / 0.34;
      r = 0.6 * k;
      g = 0.2 * (1.0 - k);
      b = 1.0 * (1.0 - k) + 0.9 * k;
    }
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
    gl_PointSize = clamp(pointSize * (300.0 / max(dist, 0.01)), 4.0, 80.0);
    gl_Position = projectionMatrix * mvPosition;
}
`;

/**
 * GLSL Fragment Shader for Dual Divergent Multi-Stop Color Ramps:
 * Positivo (0 a +1): Negro -> Rojo -> Naranja -> Amarillo
 * Negativo (0 a -1): Negro -> Verde -> Azul -> Violeta
 */
export const divergentFragmentShader = `
varying float vIntensity;
uniform float baseOpacity;

void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard; // Círculo perfecto

    // Smooth anti-aliased core circle (0.25) + glowing halo (0.25 to 0.5)
    float core = 1.0 - smoothstep(0.0, 0.25, dist);
    float halo = 1.0 - smoothstep(0.2, 0.5, dist);

    float t = clamp(vIntensity, -1.0, 1.0);
    float absT = abs(t);
    float dynamicAlpha = clamp(pow(absT, 1.2), 0.05, 1.0) * baseOpacity;

    vec3 color = vec3(0.0);

    if (t > 0.0) {
        // Positivo (0 a +1): Negro -> Rojo -> Naranja -> Amarillo
        if (t < 0.33) {
            float k = t / 0.33;
            color = mix(vec3(0.0), vec3(1.0, 0.0, 0.0), k);
        } else if (t < 0.66) {
            float k = (t - 0.33) / 0.33;
            color = mix(vec3(1.0, 0.0, 0.0), vec3(1.0, 0.5, 0.0), k);
        } else {
            float k = (t - 0.66) / 0.34;
            color = mix(vec3(1.0, 0.5, 0.0), vec3(1.0, 0.95, 0.0), k);
        }
    } else if (t < 0.0) {
        // Negativo (0 a -1): Negro -> Verde -> Azul -> Violeta
        float f = -t;
        if (f < 0.33) {
            float k = f / 0.33;
            color = mix(vec3(0.0), vec3(0.0, 0.9, 0.1), k);
        } else if (f < 0.66) {
            float k = (f - 0.33) / 0.33;
            color = mix(vec3(0.0, 0.9, 0.1), vec3(0.0, 0.2, 1.0), k);
        } else {
            float k = (f - 0.66) / 0.34;
            color = mix(vec3(0.0, 0.2, 1.0), vec3(0.6, 0.0, 0.9), k);
        }
    }

    vec3 finalColor = color * (core * 0.8 + halo * 0.4);
    float alpha = clamp(dynamicAlpha * (core + halo * 0.5), 0.05, 0.85);

    gl_FragColor = vec4(finalColor, alpha);
}
`;

/**
 * Factory function creating a customized THREE.ShaderMaterial for GPU divergent shading.
 *
 * @param {number} [pointSize=10.0] - Base size of points
 * @param {number} [baseOpacity=0.7] - Overall opacity scalar
 * @returns {THREE.ShaderMaterial}
 */
export function createDivergentMaterial(pointSize = 10.0, baseOpacity = 0.7) {
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
