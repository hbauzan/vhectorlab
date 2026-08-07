/**
 * VHectorLab-3D v25 app chrome shell — five empty zones (no business logic).
 * Zones: header | left | canvas | right | footer
 */

export const SHELL_ZONES = Object.freeze([
  'header',
  'left',
  'canvas',
  'right',
  'footer',
]);

/** Same MQ string as legacy CollapsibleDock (portrait + short landscape phones). */
export const V25_MOBILE_MQ =
  '(max-width: 768px), ((max-height: 500px) and (hover: none))';

const ZONE_LABEL = Object.freeze({
  header: 'Header',
  left: 'Left',
  canvas: 'Canvas',
  right: 'Right',
  footer: 'Footer',
});

/**
 * @returns {string} HTML for `.lab-shell` with five `data-zone` regions.
 */
export function shellMarkup() {
  const zone = (id, extraClass = '') => `
    <section
      class="lab-shell__zone lab-shell__${id}${extraClass ? ` ${extraClass}` : ''}"
      data-zone="${id}"
      aria-label="${ZONE_LABEL[id]}"
    >
      <span class="lab-shell__placeholder lab-mono">${ZONE_LABEL[id]}</span>
    </section>`;

  return `
    <div class="lab-shell" data-shell="v25">
      ${zone('header')}
      ${zone('left', 'lab-panel')}
      ${zone('canvas')}
      ${zone('right', 'lab-panel')}
      ${zone('footer', 'lab-panel')}
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
