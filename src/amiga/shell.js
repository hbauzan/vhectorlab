/**
 * Amiga layout helpers — fullscreen `#app` like legacy `/`.
 * PROHIBIDO: multi-zone / left-canvas-right panel grids (that is v25, not Amiga).
 */
import { MOBILE_MQ } from '../ui/CollapsibleDock.js';

/** Same MQ as legacy docks — phones + short landscape. */
export const AMIGA_MOBILE_MQ = MOBILE_MQ;

/**
 * @deprecated Do not reintroduce zone grids. Kept empty so old imports fail loudly if misused.
 */
export const SHELL_ZONES = Object.freeze([]);

/**
 * Assert Amiga stays on the legacy chrome model (no panel grid).
 * @returns {'fullscreen-floating-docks'}
 */
export function amigaLayoutModel() {
  return 'fullscreen-floating-docks';
}
