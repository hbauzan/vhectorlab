import './style.css';
import {
  applyAmigaCssVars,
  resolveAmigaColors,
} from './amigaEnvColors.js';
import { PRODUCT_NAME, PRODUCT_VERSION } from './version.js';

const colors = resolveAmigaColors(import.meta.env);
applyAmigaCssVars(document.documentElement, colors);

document.body.classList.add('amiga-workbench');

const app = document.getElementById('app');
if (app) {
  app.innerHTML = `
    <div class="amiga-shell" data-amiga-shell>
      <header class="amiga-titlebar">
        <h1 class="amiga-titlebar__brand">${PRODUCT_NAME}</h1>
        <span class="amiga-titlebar__meta">Amiga / MagicWB · v${PRODUCT_VERSION}</span>
      </header>
      <section class="amiga-panel" aria-label="Workbench scaffold">
        <p>Topaz + Magic Workbench palette scaffold.</p>
        <p>Parallel skin at /amiga/ — legacy / and /v25/ untouched.</p>
        <p>Colors from <code>VITE_AMIGA_*</code> in <code>.env</code> (defaults if unset).</p>
        <ul class="amiga-swatches" aria-label="MagicWB pens">
          <li data-pen="0" title="0 gray"></li>
          <li data-pen="1" title="1 black"></li>
          <li data-pen="2" title="2 white"></li>
          <li data-pen="3" title="3 blue"></li>
          <li data-pen="4" title="4 halfshadow"></li>
          <li data-pen="5" title="5 halfshine"></li>
          <li data-pen="6" title="6 tan"></li>
          <li data-pen="7" title="7 peach"></li>
        </ul>
      </section>
    </div>
  `;
}
