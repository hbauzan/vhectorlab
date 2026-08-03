/**
 * Custom GLSL Shaders for VHectorLab 3D.
 * Renders glowing incandescent points with radial anti-aliasing and magnitude-based color gradients.
 */

export const PointShader = {
  vertexShader: /* glsl */ `
    attribute float aActivation;
    attribute float aSize;
    attribute vec3 aColor;

    varying float vActivation;
    varying vec3 vColor;
    varying vec3 vPosition;

    void main() {
      vActivation = aActivation;
      vColor = aColor;
      vPosition = position;

      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * (300.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,

  fragmentShader: /* glsl */ `
    varying float vActivation;
    varying vec3 vColor;
    varying vec3 vPosition;

    void main() {
      // Radial distance from point center (0.0 at center, 0.5 at boundary)
      vec2 coord = gl_PointCoord - vec2(0.5);
      float dist = length(coord);

      if (dist > 0.5) {
        discard;
      }

      // Smooth anti-aliased core circle (radius 0.25) + glowing halo (0.25 to 0.5)
      float core = 1.0 - smoothstep(0.0, 0.25, dist);
      float halo = 1.0 - smoothstep(0.2, 0.5, dist);

      // Color gradient: Low activation -> Cyan/Teal (0.1, 0.6, 0.7), High activation -> Incandescent Yellow/White (1.0, 0.95, 0.4)
      vec3 lowColor = vec3(0.05, 0.45, 0.65);
      vec3 highColor = vec3(1.0, 0.95, 0.35);
      vec3 baseColor = mix(lowColor, highColor, clamp(vActivation, 0.0, 1.0));
      
      // Override with custom point color if provided
      if (length(vColor) > 0.001) {
        baseColor = vColor;
      }

      vec3 finalColor = baseColor * (core * 1.5 + halo * 0.8);
      float alpha = clamp(core + halo * 0.6, 0.0, 1.0);

      gl_FragColor = vec4(finalColor, alpha);
    }
  `
};
