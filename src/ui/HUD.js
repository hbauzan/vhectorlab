/**
 * Bottom Floating Telemetry HUD component (Glassmorphic design).
 * Displays real-time X, Y, Z coordinates, activation values, and token text.
 * Optional camera pose overlay (VITE_SHOW_CAM_POSE=true).
 */
import {
  resolveHoverTelemetry,
  formatActivationValue,
  activationDisplayBudget,
} from './hoverTelemetry.js';

export class HUD {
  /**
   * @param {HTMLElement} [containerElement]
   * @param {{ showCamPose?: boolean }} [options]
   */
  constructor(containerElement, options = {}) {
    this.container = containerElement || document.body;
    this.showCamPose = options.showCamPose === true;

    this.element = document.createElement('div');
    this.element.id = 'bottom-hud';
    this.element.className = 'glass-hud';
    this.element.innerHTML = `
      <div class="hud-left">
        <span class="hud-label">COORDS:</span>
        <span id="hud-coords" class="hud-val">X: 0 | Y: 0 | Z: 0</span>
      </div>
      <div class="hud-center">
        <span class="hud-label">HOVER TELEMETRY:</span>
        <span id="hud-segment" class="hud-badge">RESULT VECTOR</span>
        <span id="hud-dim" class="hud-val">DIM: --</span>
        <span id="hud-activation" class="hud-highlight">ACTIVATION: --</span>
      </div>
      <div class="hud-right">
        <span class="hud-label">TOKEN:</span>
        <span id="hud-token" class="hud-token-text">--</span>
      </div>
    `;

    this.container.appendChild(this.element);

    this.coordsEl = this.element.querySelector('#hud-coords');
    this.segmentEl = this.element.querySelector('#hud-segment');
    this.dimEl = this.element.querySelector('#hud-dim');
    this.activationEl = this.element.querySelector('#hud-activation');
    this.tokenEl = this.element.querySelector('#hud-token');
    this.centerEl = this.element.querySelector('.hud-center');

    this._lastActivation = null;
    this._lastDim = null;
    this._resizeObserver = null;

    if (typeof ResizeObserver !== 'undefined' && this.centerEl) {
      this._resizeObserver = new ResizeObserver(() => {
        if (this._lastActivation != null) {
          this._renderActivation(this._lastActivation);
        }
        this._renderDim(this._lastDim);
      });
      this._resizeObserver.observe(this.centerEl);
    }

    this.cameraDebugEl = null;
    this.camPosEl = null;
    this.camRotEl = null;

    if (this.showCamPose) {
      this.cameraDebugEl = document.createElement('div');
      this.cameraDebugEl.id = 'camera-pose-debug';
      this.cameraDebugEl.setAttribute('aria-hidden', 'true');

      const title = document.createElement('div');
      title.className = 'cam-debug-title';
      title.textContent = 'CAM POSE';

      this.camPosEl = document.createElement('div');
      this.camPosEl.id = 'cam-debug-pos';
      this.camPosEl.textContent = 'POS: --';

      this.camRotEl = document.createElement('div');
      this.camRotEl.id = 'cam-debug-rot';
      this.camRotEl.textContent = 'ROT: --';

      this.cameraDebugEl.appendChild(title);
      this.cameraDebugEl.appendChild(this.camPosEl);
      this.cameraDebugEl.appendChild(this.camRotEl);
      this.container.appendChild(this.cameraDebugEl);
    }
  }

  /**
   * Updates the on-screen camera pose readout (position + YXZ euler degrees).
   * No-op unless constructed with showCamPose: true.
   * @param {import('three').Camera} camera
   * @param {import('three').Euler} [euler]
   */
  updateCameraPose(camera, euler = null) {
    if (!this.showCamPose || !camera || !this.camPosEl) return;

    const p = camera.position;
    this.camPosEl.textContent = `POS: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`;

    if (euler && this.camRotEl) {
      const rad2deg = 180 / Math.PI;
      this.camRotEl.textContent =
        `ROT: ${(euler.x * rad2deg).toFixed(1)}, ${(euler.y * rad2deg).toFixed(1)}, ${(euler.z * rad2deg).toFixed(1)}`;
    }
  }

  updateTelemetry(data) {
    const t = resolveHoverTelemetry(data);
    if (!t) {
      this._lastActivation = null;
      this._lastDim = null;
      this.coordsEl.textContent = 'X: -- | Y: -- | Z: --';
      this.segmentEl.textContent = 'NEUTRAL SPACE';
      this._renderDim(null);
      this.activationEl.textContent = 'ACTIVATION: --';
      this.activationEl.style.color = '#888888';
      this.activationEl.removeAttribute('title');
      this.tokenEl.textContent = 'NONE';
      return;
    }

    const pos = t.point || { x: 0, y: 0, z: 0 };
    this.coordsEl.textContent = `X: ${Math.round(pos.x)} | Y: ${Math.round(pos.y)} | Z: ${Math.round(pos.z)}`;

    this._lastActivation = t.activation;
    this._lastDim = t.dim;
    this._renderDim(t.dim);
    this._renderActivation(t.activation);

    this.segmentEl.textContent = t.type;
    this.tokenEl.textContent = t.token;
  }

  /**
   * @param {number|null|undefined} dim
   * @private
   */
  _renderDim(dim) {
    if (!this.dimEl) return;
    if (dim == null || !Number.isFinite(dim)) {
      this.dimEl.textContent = 'DIM: --';
      this.dimEl.removeAttribute?.('title');
      return;
    }
    const n = Math.trunc(dim);
    this.dimEl.textContent = `DIM: ${n}`;
    this.dimEl.title = `dim: ${n}`;
  }

  /**
   * @param {number} val
   * @private
   */
  _renderActivation(val) {
    const slotPx = this._activationSlotWidth();
    const fontSize = this._activationFontSize();
    const { maxChars, compactLabel } = activationDisplayBudget(slotPx, 'ACTIVATION: ', fontSize);
    const label = compactLabel ? 'ACT: ' : 'ACTIVATION: ';
    const formatted = formatActivationValue(val, { maxDecimals: 32, maxChars });

    this.activationEl.textContent = `${label}${formatted}`;
    this.activationEl.title = `ACTIVATION: ${formatActivationValue(val, { maxDecimals: 32, maxChars: 48 })}`;
    this.activationEl.style.color = Math.abs(val) > 0.3 ? '#ffe600' : '#00ffaa';
  }

  /** @private */
  _activationSlotWidth() {
    if (!this.centerEl) return 160;
    const centerW = this.centerEl.clientWidth || 160;
    const labelW = this.centerEl.querySelector('.hud-label')?.offsetWidth || 0;
    const badgeW = this.segmentEl?.offsetWidth || 0;
    const dimW = this.dimEl?.offsetWidth || 0;
    const gap = 20;
    const available = centerW - labelW - badgeW - dimW - gap;
    // Mobile wrap: if center is tight, allow activation to use most of the bar
    if (available < 64 && this.element?.clientWidth) {
      return Math.max(72, Math.floor(this.element.clientWidth * 0.4));
    }
    return Math.max(64, available);
  }

  /** @private */
  _activationFontSize() {
    if (typeof window === 'undefined' || !this.activationEl) return 12;
    const cs = window.getComputedStyle?.(this.activationEl);
    const px = cs ? parseFloat(cs.fontSize) : 12;
    return Number.isFinite(px) && px > 0 ? px : 12;
  }
}
