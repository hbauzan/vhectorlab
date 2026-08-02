import * as THREE from 'three';
import { DEFAULT_VISUALIZATION_SETTINGS, anchorsFromSettings, hexToRgb01 } from '../ui/visualizationControlsDefaults.js';
import { NEAR_ZERO_EPS } from './activationFilter.js';

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
 * Default RGB01 anchors (product defaults). Mid-stop orange/blue ramps are retired (C1).
 */
export const DEFAULT_COLOR_ANCHORS = anchorsFromSettings(DEFAULT_VISUALIZATION_SETTINGS);

/**
 * Linear RGB lerp.
 * @param {{r:number,g:number,b:number}} a
 * @param {{r:number,g:number,b:number}} b
 * @param {number} k
 */
function lerpRgb(a, b, k) {
  return {
    r: a.r + (b.r - a.r) * k,
    g: a.g + (b.g - a.g) * k,
    b: a.b + (b.b - a.b) * k,
  };
}

/**
 * Resolve anchors object from optional override (RGB01 or settings-like).
 * @param {object|null|undefined} anchors
 */
export function resolveColorAnchors(anchors) {
  if (!anchors) return DEFAULT_COLOR_ANCHORS;
  if (anchors.positive && anchors.zero && anchors.negative) {
    return {
      positive: anchors.positive,
      zero: anchors.zero,
      negative: anchors.negative,
    };
  }
  // Hex settings shape
  if (anchors.colorPositive || anchors.colorZero || anchors.colorNegative) {
    return anchorsFromSettings(anchors);
  }
  return DEFAULT_COLOR_ANCHORS;
}

/**
 * CPU color and dynamic opacity from normalized-ish activation.
 * Interpolation: lerp(zero, positive, t) for t≥0; lerp(zero, negative, −t) for t<0.
 * Near-zero |t| < 0.01 → zero anchor + alpha ≈ 0.05.
 *
 * @param {number} val - Activation value (v)
 * @param {number} [absMax=1.0] - Maximum absolute value for normalization
 * @param {object|null} [anchors] - RGB01 trio or hex settings; defaults to product anchors
 * @returns {{r: number, g: number, b: number, alpha: number}}
 */
export function getDivergentColor(val, absMax = 1.0, anchors = null) {
  const denom = absMax > 1e-9 ? absMax : 1.0;
  let t = Math.max(-1.0, Math.min(1.0, val / denom));
  const absT = Math.abs(t);
  const A = resolveColorAnchors(anchors);

  if (absT < NEAR_ZERO_EPS) {
    return { r: A.zero.r, g: A.zero.g, b: A.zero.b, alpha: 0.05 };
  }

  const alpha = Math.min(Math.max(Math.pow(absT, 1.2), 0.05), 1.0);
  const rgb = t >= 0
    ? lerpRgb(A.zero, A.positive, t)
    : lerpRgb(A.zero, A.negative, -t);

  return { r: rgb.r, g: rgb.g, b: rgb.b, alpha };
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
 * GLSL Fragment Shader: three color anchors via uniforms + optional sign filter.
 * Filter modes: 0=all, 1=positive only, 2=negative only (ε = uNearZeroEps).
 */
export const divergentFragmentShader = `
varying float vIntensity;
uniform float baseOpacity;
uniform vec3 uColorPos;
uniform vec3 uColorNeg;
uniform vec3 uColorZero;
uniform int uFilterMode;
uniform float uNearZeroEps;

void main() {
    vec2 coord = abs(gl_PointCoord - vec2(0.5));
    float maxDist = max(coord.x, coord.y);

    // Sharp 1-pixel anti-aliased square bounding edge
    float solidEdge = 1.0 - smoothstep(0.44, 0.49, maxDist);

    float t = clamp(vIntensity, -1.0, 1.0);
    float absT = abs(t);

    // Sign filter on normalized t (same semantics as activationFilter.js)
    if (uFilterMode == 1) {
        if (absT < uNearZeroEps || t <= 0.0) discard;
    } else if (uFilterMode == 2) {
        if (absT < uNearZeroEps || t >= 0.0) discard;
    }

    // Near-zero short-circuit → zero anchor + low alpha
    if (absT < uNearZeroEps) {
        gl_FragColor = vec4(uColorZero, 0.05 * baseOpacity * solidEdge);
        return;
    }

    float dynamicAlpha = clamp(pow(absT, 1.1), 0.05, 1.0) * baseOpacity;

    vec3 color = t > 0.0
        ? mix(uColorZero, uColorPos, t)
        : mix(uColorZero, uColorNeg, -t);

    vec3 finalColor = color * solidEdge;
    float alpha = dynamicAlpha * solidEdge;

    gl_FragColor = vec4(finalColor, alpha);
}
`;

/**
 * Map viz filter mode → shader int.
 * @param {'all'|'positive'|'negative'|undefined} mode
 * @returns {number}
 */
export function filterModeToUniform(mode) {
  if (mode === 'positive') return 1;
  if (mode === 'negative') return 2;
  return 0;
}

/**
 * Factory function creating a customized THREE.ShaderMaterial for GPU divergent shading.
 *
 * @param {number} [pointSize=10.0] - Base size of points
 * @param {number} [baseOpacity=0.7] - Overall opacity scalar
 * @param {{
 *   anchors?: object,
 *   filterMode?: 'all'|'positive'|'negative',
 * }} [options]
 * @returns {THREE.ShaderMaterial}
 */
export function createDivergentMaterial(pointSize = 10.0, baseOpacity = 0.7, options = {}) {
  const A = resolveColorAnchors(options.anchors ?? null);
  return new THREE.ShaderMaterial({
    uniforms: {
      pointSize: { value: pointSize },
      baseOpacity: { value: baseOpacity },
      uColorPos: { value: new THREE.Vector3(A.positive.r, A.positive.g, A.positive.b) },
      uColorNeg: { value: new THREE.Vector3(A.negative.r, A.negative.g, A.negative.b) },
      uColorZero: { value: new THREE.Vector3(A.zero.r, A.zero.g, A.zero.b) },
      uFilterMode: { value: filterModeToUniform(options.filterMode) },
      uNearZeroEps: { value: NEAR_ZERO_EPS },
    },
    vertexShader: divergentVertexShader,
    fragmentShader: divergentFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
}

/**
 * Update live color/filter uniforms without rebuilding the shader string.
 * @param {THREE.ShaderMaterial} material
 * @param {{ anchors?: object, filterMode?: string }} options
 */
export function updateDivergentMaterialUniforms(material, options = {}) {
  if (!material?.uniforms) return;
  if (options.anchors) {
    const A = resolveColorAnchors(options.anchors);
    material.uniforms.uColorPos.value.set(A.positive.r, A.positive.g, A.positive.b);
    material.uniforms.uColorNeg.value.set(A.negative.r, A.negative.g, A.negative.b);
    material.uniforms.uColorZero.value.set(A.zero.r, A.zero.g, A.zero.b);
  }
  if (options.filterMode !== undefined) {
    material.uniforms.uFilterMode.value = filterModeToUniform(options.filterMode);
  }
}

export { hexToRgb01 };
