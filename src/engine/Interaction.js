import * as THREE from 'three';

/**
 * Handles Raycasting and mouse hover / click interaction on 3D vector points.
 */
export class Interaction {
  constructor(camera, scene, domElement) {
    this.camera = camera;
    this.scene = scene;
    this.domElement = domElement || document.body;

    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Points.threshold = 5.0; // Raycast picking tolerance radius

    this.mouse = new THREE.Vector2(-10, -10);
    this.hoveredObject = null;
    this.hoveredPointIndex = null;

    this.onHoverCallback = null;
    this.onClickCallback = null;

    this.initEventListeners();
  }

  initEventListeners() {
    this.domElement.addEventListener('mousemove', (e) => {
      const rect = this.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    });

    this.domElement.addEventListener('click', (e) => {
      if (e.target.tagName === 'CANVAS' && this.hoveredObject !== null) {
        if (this.onClickCallback) {
          this.onClickCallback({
            object: this.hoveredObject,
            index: this.hoveredPointIndex
          });
        }
      }
    });
  }

  update(interactiveObjects) {
    if (!interactiveObjects || interactiveObjects.length === 0) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(interactiveObjects, true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const index = hit.index !== undefined ? hit.index : hit.instanceId;

      if (this.hoveredObject !== hit.object || this.hoveredPointIndex !== index) {
        this.hoveredObject = hit.object;
        this.hoveredPointIndex = index;

        if (this.onHoverCallback) {
          this.onHoverCallback({
            object: hit.object,
            index: index,
            point: hit.point,
            face: hit.face || null,
            userData: hit.object.userData
          });
        }
      }
    } else if (this.hoveredObject !== null) {
      this.hoveredObject = null;
      this.hoveredPointIndex = null;

      if (this.onHoverCallback) {
        this.onHoverCallback(null);
      }
    }
  }
}
