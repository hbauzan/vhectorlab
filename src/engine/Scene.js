import * as THREE from 'three';

/**
 * Clean WebGL Scene Manager for Thread Geometry visualization.
 */
export class Scene {
  constructor(container) {
    this.container = container || document.body;

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a12);

    // 2. Camera setup
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.set(0, 5, 15);

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.container.appendChild(this.renderer.domElement);

    // 4. Lighting & Spatial Reference Grid (Y = 0)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(10, 20, 15);
    this.scene.add(dirLight);

    const gridHelper = new THREE.GridHelper(50, 50, 0x00f5ff, 0x333344);
    gridHelper.position.y = 0;
    this.scene.add(gridHelper);

    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  add(object) {
    this.scene.add(object);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
