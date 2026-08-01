/**
 * Bottom Floating Telemetry HUD component (Glassmorphic design).
 * Displays real-time X, Y, Z coordinates, activation values, and token text.
 */
export class HUD {
  constructor(containerElement) {
    this.container = containerElement || document.body;

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
    this.activationEl = this.element.querySelector('#hud-activation');
    this.tokenEl = this.element.querySelector('#hud-token');
  }

  updateTelemetry(data) {
    if (!data) {
      this.coordsEl.textContent = 'X: -- | Y: -- | Z: --';
      this.segmentEl.textContent = 'NEUTRAL SPACE';
      this.activationEl.textContent = 'ACTIVATION: 0.000';
      this.activationEl.style.color = '#888888';
      this.tokenEl.textContent = 'NONE';
      return;
    }

    const pos = data.point || { x: 0, y: 0, z: 0 };
    this.coordsEl.textContent = `X: ${Math.round(pos.x)} | Y: ${Math.round(pos.y)} | Z: ${Math.round(pos.z)}`;

    const val = data.userData?.val !== undefined ? data.userData.val : (data.activation || 0);
    const formattedVal = val.toFixed(4);
    this.activationEl.textContent = `ACTIVATION: ${formattedVal}`;
    this.activationEl.style.color = val > 0.3 ? '#ffe600' : '#00ffaa';

    const typeStr = (data.userData?.type || 'VECTOR').toUpperCase();
    this.segmentEl.textContent = typeStr;

    const tokenText = data.userData?.word || data.userData?.token || `DIM #${data.index || 0}`;
    this.tokenEl.textContent = tokenText;
  }
}
