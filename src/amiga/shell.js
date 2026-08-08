/**
 * Amiga `/amiga/` five-zone shell (header | left | canvas | right | footer).
 * MQ matches legacy CollapsibleDock for phone + short landscape.
 */
import { MOBILE_MQ } from '../ui/CollapsibleDock.js';

export const SHELL_ZONES = Object.freeze([
  'header',
  'left',
  'canvas',
  'right',
  'footer',
]);

/** Re-export legacy mobile MQ — keep identical for docks / viz layout. */
export const AMIGA_MOBILE_MQ = MOBILE_MQ;

const ZONE_LABEL = Object.freeze({
  header: 'Header',
  left: 'Left',
  canvas: 'Canvas',
  right: 'Right',
  footer: 'Footer',
});

/**
 * @returns {string}
 */
export function shellMarkup() {
  const zone = (id) => `
    <section
      class="amiga-shell__zone amiga-shell__${id}"
      data-zone="${id}"
      aria-label="${ZONE_LABEL[id]}"
    ></section>`;

  return `
    <div class="amiga-shell" data-shell="amiga">
      ${zone('header')}
      ${zone('left')}
      ${zone('canvas')}
      ${zone('right')}
      ${zone('footer')}
    </div>
  `.trim();
}

/**
 * @param {ParentNode} root
 * @returns {Record<string, Element | null>}
 */
export function queryShellZones(root) {
  const zones = {};
  for (const id of SHELL_ZONES) {
    zones[id] = root.querySelector(`[data-zone="${id}"]`);
  }
  return zones;
}

/**
 * @param {HTMLElement} mount
 * @returns {Record<string, Element | null>}
 */
export function mountShell(mount) {
  if (!mount) throw new Error('mountShell requires a mount element');
  mount.innerHTML = shellMarkup();
  const zones = queryShellZones(mount);
  for (const id of SHELL_ZONES) {
    if (!zones[id]) throw new Error(`shell zone missing: ${id}`);
  }
  return zones;
}

/**
 * Canvas host client size (never 0×0).
 * @param {{ clientWidth?: number, clientHeight?: number } | null | undefined} el
 */
export function resolveCanvasSize(el) {
  const width = Math.max(1, Math.floor(Number(el?.clientWidth) || 0));
  const height = Math.max(1, Math.floor(Number(el?.clientHeight) || 0));
  return { width, height };
}
