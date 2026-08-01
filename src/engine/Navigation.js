import * as THREE from 'three';

/**
 * Inertial Flight & Camera Navigation Controller (WASDQE + Mouse Drag Look + Shift Turbo).
 */
export class Navigation {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement || document.body;

    this.keys = {
      KeyW: false,
      KeyS: false,
      KeyA: false,
      KeyD: false,
      KeyQ: false,
      KeyE: false,
      ShiftLeft: false,
      ShiftRight: false
    };

    this.velocity = new THREE.Vector3();
    this.moveSpeed = 75.0; // Half base speed units/sec for smooth control
    this.turboMultiplier = 2.5;
    this.damping = 0.88;

    // Mouse drag state
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');

    this.initEventListeners();
  }

  initEventListeners() {
    window.addEventListener('keydown', (e) => {
      if (this.keys.hasOwnProperty(e.code)) {
        this.keys[e.code] = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.keys.hasOwnProperty(e.code)) {
        this.keys[e.code] = false;
      }
    });

    this.domElement.addEventListener('mousedown', (e) => {
      // Only drag with left mouse button when not clicking UI inputs
      if (e.button === 0 && e.target.tagName === 'CANVAS') {
        this.isDragging = true;
        this.previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;

      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      this.euler.setFromQuaternion(this.camera.quaternion);

      this.euler.y -= deltaX * 0.003;
      this.euler.x -= deltaY * 0.003;

      // Limit vertical pitch angle (-85 deg to +85 deg)
      this.euler.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.euler.x));

      this.camera.quaternion.setFromEuler(this.euler);
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });
  }

  update(deltaTime) {
    const dt = Math.min(deltaTime, 0.1);
    const speed = (this.keys.ShiftLeft || this.keys.ShiftRight ? this.moveSpeed * this.turboMultiplier : this.moveSpeed) * dt;

    const moveVector = new THREE.Vector3();

    if (this.keys.KeyW) moveVector.z -= 1;
    if (this.keys.KeyS) moveVector.z += 1;
    if (this.keys.KeyA) moveVector.x -= 1;
    if (this.keys.KeyD) moveVector.x += 1;
    if (this.keys.KeyQ) moveVector.y -= 1;
    if (this.keys.KeyE) moveVector.y += 1;

    moveVector.normalize();
    moveVector.applyQuaternion(this.camera.quaternion);
    moveVector.multiplyScalar(speed);

    this.velocity.add(moveVector);
    this.camera.position.add(this.velocity);

    // Apply smooth inertial damping
    this.velocity.multiplyScalar(this.damping);
  }

  focusPosition(targetPosition, duration = 1.0) {
    // Smooth camera transition to target 3D vector point
    const offset = new THREE.Vector3(0, 30, 80);
    const targetCamPos = new THREE.Vector3().copy(targetPosition).add(offset);
    
    this.camera.position.copy(targetCamPos);
    this.camera.lookAt(targetPosition);
    this.euler.setFromQuaternion(this.camera.quaternion);
  }
}
