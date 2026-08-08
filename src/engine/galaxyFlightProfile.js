/**
 * Flight feel profiles for Navigation (WASD/QE + mouse look).
 * Galaxy VIEW uses a slower profile; ANALYSIS/NAVIGATION keep defaults.
 */

/** @typedef {{ moveSpeed: number, turboMultiplier: number, lookSensitivity: number }} FlightProfile */

/** Current ANALYSIS / NAVIGATION feel (pre–Galaxy-feel baseline). */
export const DEFAULT_FLIGHT_PROFILE = Object.freeze({
  moveSpeed: 75.0,
  turboMultiplier: 2.0,
  lookSensitivity: 0.003,
});

/**
 * Galaxy-only: slower cruise + softer look so a larger UMAP world feels elegant.
 * Calibrated with GALAXY_DEFAULT_SCALE ≈ 96 (RMS≈1 → ~several seconds across IT-core).
 */
export const GALAXY_FLIGHT_PROFILE = Object.freeze({
  moveSpeed: 32.0,
  turboMultiplier: 1.75,
  lookSensitivity: 0.0014,
});

/**
 * @param {{ moveSpeed?: number, turboMultiplier?: number, lookSensitivity?: number }|null|undefined} nav
 * @param {FlightProfile|null|undefined} profile
 * @returns {typeof nav}
 */
export function applyFlightProfile(nav, profile) {
  if (!nav || !profile) return nav;
  nav.moveSpeed = profile.moveSpeed;
  nav.turboMultiplier = profile.turboMultiplier;
  nav.lookSensitivity = profile.lookSensitivity;
  return nav;
}

/** @param {object|null|undefined} nav */
export function applyGalaxyFlightProfile(nav) {
  return applyFlightProfile(nav, GALAXY_FLIGHT_PROFILE);
}

/** @param {object|null|undefined} nav */
export function restoreDefaultFlightProfile(nav) {
  return applyFlightProfile(nav, DEFAULT_FLIGHT_PROFILE);
}
