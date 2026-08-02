import * as THREE from 'three';

/** Exponential fog density — soft atmosphere without blacking out far RIBBONS/MESH. */
export const SCENE_FOG_DENSITY = 0.0008;
export const SCENE_FOG_COLOR = 0x050505;

/**
 * Initializes and manages the Three.js 3D WebGL scene setup.
 */
export class SceneSetup {
  constructor(containerElement) {
    this.container = containerElement || document.body;

    // 1. Scene setup with dark background #050505
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SCENE_FOG_COLOR);
    // Soft FogExp2: MeshBasicMaterial (RIBBONS/MESH) respects fog; density must stay
    // readable at COMPARE camera distances (~300–400). POINTS shaders omit fog.
    this.scene.fog = new THREE.FogExp2(SCENE_FOG_COLOR, SCENE_FOG_DENSITY);

    // 2. Camera setup
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 2000);
    this.camera.position.set(-178.3, 13.5, 52.2);

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.container.appendChild(this.renderer.domElement);

    // 4. Lighting & Environment
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(200, 400, 300);
    this.scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x00ffaa, 2, 500);
    pointLight.position.set(0, 100, 0);
    this.scene.add(pointLight);

    // Resize handling
    window.addEventListener('resize', () => this.onWindowResize());
  }

  onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
