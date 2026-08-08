import * as THREE from 'three';
import { resolveCameraPose, VIEW_CAMERA_FALLBACKS } from './cameraViewDefaults.js';
import { DEFAULT_FLIGHT_PROFILE } from './galaxyFlightProfile.js';

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
    this.moveSpeed = DEFAULT_FLIGHT_PROFILE.moveSpeed;
    this.turboMultiplier = DEFAULT_FLIGHT_PROFILE.turboMultiplier;
    this.lookSensitivity = DEFAULT_FLIGHT_PROFILE.lookSensitivity;
    this.damping = 0.85;
    this._cameraTweenRaf = null;

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
    const sens = Number.isFinite(this.lookSensitivity)
      ? this.lookSensitivity
      : DEFAULT_FLIGHT_PROFILE.lookSensitivity;
    this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.y -= deltaX * sens;
    this.euler.x -= deltaY * sens;
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
    const offset = new THREE.Vector3(0, 30, 80);
    const targetCamPos = new THREE.Vector3().copy(targetPosition).add(offset);
    this.animateLookAt(targetCamPos, targetPosition, Math.max(0, Number(duration) || 0) * 1000);
  }

  /**
   * Snap camera to a resolved POS / ROT (degrees, YXZ euler).
   * @param {{ position: number[], rotationDeg: number[] }} pose
   */
  applyResolvedPose(pose) {
    this._cancelCameraTween();
    const [px, py, pz] = pose.position;
    const [rx, ry, rz] = pose.rotationDeg;
    this.camera.position.set(px, py, pz);
    const deg2rad = Math.PI / 180;
    this.euler.set(rx * deg2rad, ry * deg2rad, rz * deg2rad, 'YXZ');
    this.camera.quaternion.setFromEuler(this.euler);
    this.velocity.set(0, 0, 0);
  }

  /**
   * Smoothly fly camera to `position` while looking at `lookAt` (ease-out cubic).
   * @param {THREE.Vector3|{x:number,y:number,z:number}} position
   * @param {THREE.Vector3|{x:number,y:number,z:number}} lookAt
   * @param {number} [durationMs=450]
   * @returns {Promise<void>}
   */
  animateLookAt(position, lookAt, durationMs = 450) {
    this._cancelCameraTween();
    const toPos = position.isVector3
      ? position.clone()
      : new THREE.Vector3(position.x, position.y, position.z);
    const toLook = lookAt.isVector3
      ? lookAt.clone()
      : new THREE.Vector3(lookAt.x, lookAt.y, lookAt.z);

    const fromPos = this.camera.position.clone();
    const fromQuat = this.camera.quaternion.clone();
    const toCam = this.camera.clone();
    toCam.position.copy(toPos);
    toCam.lookAt(toLook);
    const toQuat = toCam.quaternion.clone();

    const duration = Math.max(0, Number(durationMs) || 0);
    this.velocity.set(0, 0, 0);

    if (duration <= 0 || typeof requestAnimationFrame !== 'function') {
      this.camera.position.copy(toPos);
      this.camera.quaternion.copy(toQuat);
      this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
      return Promise.resolve();
    }

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const start = performance.now();

    return new Promise((resolve) => {
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const e = easeOutCubic(t);
        this.camera.position.lerpVectors(fromPos, toPos, e);
        this.camera.quaternion.slerpQuaternions(fromQuat, toQuat, e);
        this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
        if (t < 1) {
          this._cameraTweenRaf = requestAnimationFrame(tick);
        } else {
          this._cameraTweenRaf = null;
          resolve();
        }
      };
      this._cameraTweenRaf = requestAnimationFrame(tick);
    });
  }

  /**
   * Frame content bounds: ANALYSIS = front wall; NAVIGATION = angled overview.
   * @param {THREE.Box3} box
   * @param {{ viewMode?: string, durationMs?: number }} [opts]
   * @returns {Promise<void>}
   */
  animateToFitBox(box, opts = {}) {
    if (!box || box.isEmpty()) return Promise.resolve();
    const viewMode = opts.viewMode === 'ANALYSIS' ? 'ANALYSIS' : 'NAVIGATION';
    const durationMs = opts.durationMs ?? 450;

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const radius = Math.max(size.x, size.y, size.z, 1) * 0.5;

    let targetPos;
    if (viewMode === 'ANALYSIS') {
      // Front-on wall: sit on +Z looking toward −Z (default camera forward)
      const dist = Math.max(radius * 2.4, size.x * 0.65, size.y * 1.4, 90);
      targetPos = new THREE.Vector3(center.x - size.x * 0.05, center.y, center.z + dist);
    } else {
      const dist = Math.max(radius * 2.8, size.x * 0.7, 140);
      targetPos = new THREE.Vector3(
        center.x - dist * 0.4,
        center.y + Math.max(dist * 0.1, size.y * 0.35 + 12),
        center.z + dist * 0.85
      );
    }
    return this.animateLookAt(targetPos, center, durationMs);
  }

  /**
   * Lerp to a resolved POS/ROT pose.
   * @param {{ position: number[], rotationDeg: number[] }} pose
   * @param {number} [durationMs=450]
   * @returns {Promise<void>}
   */
  animateToPose(pose, durationMs = 450) {
    this._cancelCameraTween();
    const [px, py, pz] = pose.position;
    const [rx, ry, rz] = pose.rotationDeg;
    const deg2rad = Math.PI / 180;
    const toPos = new THREE.Vector3(px, py, pz);
    const toEuler = new THREE.Euler(rx * deg2rad, ry * deg2rad, rz * deg2rad, 'YXZ');
    const toQuat = new THREE.Quaternion().setFromEuler(toEuler);

    const fromPos = this.camera.position.clone();
    const fromQuat = this.camera.quaternion.clone();
    const duration = Math.max(0, Number(durationMs) || 0);
    this.velocity.set(0, 0, 0);

    if (duration <= 0 || typeof requestAnimationFrame !== 'function') {
      this.applyResolvedPose(pose);
      return Promise.resolve();
    }

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const start = performance.now();

    return new Promise((resolve) => {
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const e = easeOutCubic(t);
        this.camera.position.lerpVectors(fromPos, toPos, e);
        this.camera.quaternion.slerpQuaternions(fromQuat, toQuat, e);
        this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
        if (t < 1) {
          this._cameraTweenRaf = requestAnimationFrame(tick);
        } else {
          this._cameraTweenRaf = null;
          resolve();
        }
      };
      this._cameraTweenRaf = requestAnimationFrame(tick);
    });
  }

  _cancelCameraTween() {
    if (this._cameraTweenRaf != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this._cameraTweenRaf);
    }
    this._cameraTweenRaf = null;
  }

  /**
   * Apply camera default for MODE / VIEW / RENDER (see cameraViewDefaults.js).
   * @param {{ workspaceMode?: string, viewMode?: string, renderMode?: string }} [ctx]
   */
  setContextView(ctx = {}) {
    this.applyResolvedPose(resolveCameraPose(ctx));
  }

  setAnalysisView() {
    this.applyResolvedPose(VIEW_CAMERA_FALLBACKS.ANALYSIS);
  }

  setNavigationView() {
    this.applyResolvedPose(VIEW_CAMERA_FALLBACKS.NAVIGATION);
  }
}
