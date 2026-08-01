import * as THREE from 'three';

/**
 * Renderable 3D Orientation Axis Gizmo (Corner HUD).
 */
export class AxisGizmo {
  constructor(mainCamera) {
    this.mainCamera = mainCamera;

    this.container = document.createElement('div');
    this.container.id = 'axis-gizmo-container';
    this.container.style.cssText = `
      position: absolute;
      bottom: 20px;
      right: 20px;
      width: 100px;
      height: 100px;
      pointer-events: none;
      z-index: 100;
    `;
    document.body.appendChild(this.container);

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
