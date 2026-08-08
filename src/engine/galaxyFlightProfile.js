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
 * Galaxy-only: cruise = former Shift speed; Shift = 2× that (incremental).
 * Look stays soft vs ANALYSIS/NAV. Calibrated with GALAXY_DEFAULT_SCALE ≈ 96.
 */
export const GALAXY_FLIGHT_PROFILE = Object.freeze({
  moveSpeed: 56.0, // was 32 × 1.75 (previous turbo feel)
  turboMultiplier: 2.0,
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
