/**
 * VHectorLab-3D `/v25/` bootstrap — Fase 2: tokens + skin demo (no feature chrome).
 */
import './style.css';

const app = document.getElementById('app');
if (app) {
  app.innerHTML = `
    <main class="lab-skin-demo">
      <h1 class="lab-skin-demo__brand">VHectorLab-<span>3D</span> v25</h1>
      <p class="lab-muted">Dark/fluo lab tokens — chrome panels land in later phases.</p>
      <section class="lab-panel" aria-label="Token preview">
        <h2 class="lab-panel__title">Lab plate</h2>
        <p class="lab-panel__body">
          Opaque chapa, thick border, soft inset. Accent triad:
          portal green / teal / magenta-fluo.
        </p>
        <ul class="lab-swatches" aria-hidden="true">
          <li class="sw-accent"></li>
          <li class="sw-teal"></li>
          <li class="sw-magenta"></li>
          <li class="sw-warn"></li>
          <li class="sw-danger"></li>
        </ul>
        <p class="lab-panel__body lab-mono" style="margin-top: 0.75rem">
          t = 0.8421 · dim 128
        </p>
      </section>
      <div class="lab-skin-demo__actions">
        <button type="button" class="lab-btn lab-btn--primary">Primary</button>
        <button type="button" class="lab-btn">Secondary</button>
      </div>
    </main>
  `;
}
