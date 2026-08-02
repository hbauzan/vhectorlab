import * as THREE from 'three';

/**
 * Inertial Flight & Camera Navigation Controller (WASDQE + Mouse Drag Look + Shift Turbo).
 */
export class Navigation {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement || (typeof document !== 'undefined' ? document.body : null);

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
    this.moveSpeed = 75.0; // Bounded speed units/sec for responsive control
    this.turboMultiplier = 2.0;
    this.damping = 0.85;

    /** Touch / virtual-joystick axes in [-1, 1] (camera-local X/Z). */
    this.touchAxes = { x: 0, z: 0 };
    /** Touch vertical: -1 = Q (down), +1 = E (up), 0 = none. */
    this.touchVertical = 0;

    // Mouse drag state
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');

    this.initEventListeners();
  }

  /**
   * Virtual joystick move input (camera-local). Desktop keys still work in parallel.
   * @param {number} x  strafe (−1 left … +1 right)
   * @param {number} z  forward (−1 forward … +1 back) matching KeyW/KeyS convention
   */
  setMoveAxes(x = 0, z = 0) {
    this.touchAxes.x = Math.max(-1, Math.min(1, Number(x) || 0));
    this.touchAxes.z = Math.max(-1, Math.min(1, Number(z) || 0));
  }

  /**
   * @param {number} dir  -1 down (Q), 0 none, +1 up (E)
   */
  setVertical(dir = 0) {
    const n = Number(dir) || 0;
    this.touchVertical = n > 0 ? 1 : n < 0 ? -1 : 0;
  }

  /**
   * Apply look delta in screen pixels (same sensitivity as mouse drag).
   * @param {number} deltaX
   * @param {number} deltaY
   */
  applyLookDelta(deltaX, deltaY) {
    this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.y -= deltaX * 0.003;
    this.euler.x -= deltaY * 0.003;
    this.euler.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.euler.x));
    this.camera.quaternion.setFromEuler(this.euler);
  }

  initEventListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      // Ignore key events when user is typing in UI inputs
      const tag = document.activeElement ? document.activeElement.tagName : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return;
      }
      if (this.keys.hasOwnProperty(e.code)) {
        this.keys[e.code] = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.keys.hasOwnProperty(e.code)) {
        this.keys[e.code] = false;
      }
    });

    window.addEventListener('blur', () => {
      // Clear key state when window loses focus
      Object.keys(this.keys).forEach((k) => (this.keys[k] = false));
      this.velocity.set(0, 0, 0);
    });

    if (this.domElement) {
      this.domElement.addEventListener('mousedown', (e) => {
        // Only drag with left mouse button when clicking CANVAS
        if (e.button === 0 && e.target.tagName === 'CANVAS') {
          this.isDragging = true;
          this.previousMousePosition = { x: e.clientX, y: e.clientY };
        }
      });
    }

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;

      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;
      this.applyLookDelta(deltaX, deltaY);
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });
  }

  update(deltaTime) {
    const dt = Math.min(deltaTime, 0.1);
    const targetSpeed = (this.keys.ShiftLeft || this.keys.ShiftRight ? this.moveSpeed * this.turboMultiplier : this.moveSpeed) * dt;

    const moveVector = new THREE.Vector3();

    if (this.keys.KeyW) moveVector.z -= 1;
    if (this.keys.KeyS) moveVector.z += 1;
    if (this.keys.KeyA) moveVector.x -= 1;
    if (this.keys.KeyD) moveVector.x += 1;
    if (this.keys.KeyQ) moveVector.y -= 1;
    if (this.keys.KeyE) moveVector.y += 1;

    // Touch joystick / vertical buttons (Etapa C) — same camera-local frame
    if (Math.abs(this.touchAxes.x) > 0.01 || Math.abs(this.touchAxes.z) > 0.01) {
      moveVector.x += this.touchAxes.x;
      moveVector.z += this.touchAxes.z;
    }
    if (this.touchVertical < 0) moveVector.y -= 1;
    if (this.touchVertical > 0) moveVector.y += 1;

    if (moveVector.lengthSq() > 0) {
      moveVector.normalize();
      moveVector.applyQuaternion(this.camera.quaternion);
      moveVector.multiplyScalar(targetSpeed);
      // Smoothly interpolate velocity toward targetSpeed (prevents infinite speed accumulation)
      this.velocity.lerp(moveVector, 0.25);
    } else {
      // Smooth deceleration down to 0
      this.velocity.multiplyScalar(this.damping);
    }

    this.camera.position.add(this.velocity);
  }

  focusPosition(targetPosition, duration = 1.0) {
    // Smooth camera transition to target 3D vector point
    const offset = new THREE.Vector3(0, 30, 80);
    const targetCamPos = new THREE.Vector3().copy(targetPosition).add(offset);

    this.camera.position.copy(targetCamPos);
    this.camera.lookAt(targetPosition);
    this.euler.setFromQuaternion(this.camera.quaternion);
  }

  setAnalysisView() {
    // Captured ARITHMETIC + ANÁLISIS + POINTS framing (POS / ROT from CAM POSE overlay)
    this.camera.position.set(-75.2, -0.8, 62.5);
    this.euler.set(0, 0, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this.euler);
    this.velocity.set(0, 0, 0);
  }

  setNavigationView() {
    // Captured default corridor view (king-man+woman @ Separación 0.4 / Amplitud 7)
    this.camera.position.set(-178.3, 13.5, 52.2);
    const deg2rad = Math.PI / 180;
    this.euler.set(-5.4 * deg2rad, -51.5 * deg2rad, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this.euler);
    this.velocity.set(0, 0, 0);
  }
}
