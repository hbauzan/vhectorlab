/**
 * VHectorLab-3D v25 footer HUD chrome — telemetry placeholders (no engine wire).
 */

export const HUD_PLACEHOLDERS = Object.freeze({
  coords: 'X: 0 | Y: 0 | Z: 0',
  segment: 'RESULT VECTOR',
  dim: 'DIM: --',
  activation: 'ACTIVATION: --',
  token: '--',
});

export function footerHudMarkup() {
  return `
    <div id="lab-footer-hud" class="lab-hud" data-chrome="footer">
      <div class="lab-hud__block">
        <span class="lab-hud__label">COORDS</span>
        <span id="lab-hud-coords" class="lab-hud__val lab-mono">${HUD_PLACEHOLDERS.coords}</span>
      </div>
      <div class="lab-hud__block lab-hud__block--center">
        <span class="lab-hud__label">HOVER TELEMETRY</span>
        <span id="lab-hud-segment" class="lab-hud__badge">${HUD_PLACEHOLDERS.segment}</span>
        <span id="lab-hud-dim" class="lab-hud__val lab-mono">${HUD_PLACEHOLDERS.dim}</span>
        <span id="lab-hud-activation" class="lab-hud__val lab-mono">${HUD_PLACEHOLDERS.activation}</span>
      </div>
      <div class="lab-hud__block">
        <span class="lab-hud__label">TOKEN</span>
        <span id="lab-hud-token" class="lab-hud__val lab-mono">${HUD_PLACEHOLDERS.token}</span>
      </div>
    </div>
  `.trim();
}

/**
 * @param {HTMLElement} container
 */
export function mountFooterHud(container) {
  if (!container) throw new Error('mountFooterHud requires a container');
  container.innerHTML = footerHudMarkup();
  return {
    setCoords(text) {
      const el = container.querySelector('#lab-hud-coords');
      if (el) el.textContent = text;
    },
    setTelemetry({ segment, dim, activation, token } = {}) {
      const seg = container.querySelector('#lab-hud-segment');
      const dimEl = container.querySelector('#lab-hud-dim');
      const act = container.querySelector('#lab-hud-activation');
      const tok = container.querySelector('#lab-hud-token');
      if (seg && segment != null) seg.textContent = segment;
      if (dimEl && dim != null) dimEl.textContent = dim;
      if (act && activation != null) act.textContent = activation;
      if (tok && token != null) tok.textContent = token;
    },
  };
}
