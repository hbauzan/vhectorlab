import * as THREE from 'three';

/**
 * Renderable 3D Orientation Axis Gizmo (Corner HUD).
 * Mounts into an optional parent (right collapsible dock); falls back to document.body.
 */
export class AxisGizmo {
  /**
   * @param {import('three').Camera} mainCamera
   * @param {HTMLElement} [parentElement]
   */
  constructor(mainCamera, parentElement = null) {
    this.mainCamera = mainCamera;

    this.container = document.createElement('div');
    this.container.id = 'axis-gizmo-container';
    this.container.setAttribute('aria-hidden', 'true');
    const host = parentElement || document.body;
    host.appendChild(this.container);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-50, 50, 50, -50, 1, 1000);
    this.camera.position.set(0, 0, 100);

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(100, 100);
    this.container.appendChild(this.renderer.domElement);

    const axesHelper = new THREE.AxesHelper(35);
    // Custom colors: X=Red, Y=Green, Z=Blue
    axesHelper.material.linewidth = 3;
    this.scene.add(axesHelper);
  }

  update() {
    this.camera.quaternion.copy(this.mainCamera.quaternion);
    this.renderer.render(this.scene, this.camera);
  }
}
