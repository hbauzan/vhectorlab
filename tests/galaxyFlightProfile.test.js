import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FLIGHT_PROFILE,
  GALAXY_FLIGHT_PROFILE,
  applyFlightProfile,
  applyGalaxyFlightProfile,
  restoreDefaultFlightProfile,
} from '../src/engine/galaxyFlightProfile.js';

function stubNav(overrides = {}) {
  return {
    moveSpeed: DEFAULT_FLIGHT_PROFILE.moveSpeed,
    turboMultiplier: DEFAULT_FLIGHT_PROFILE.turboMultiplier,
    lookSensitivity: DEFAULT_FLIGHT_PROFILE.lookSensitivity,
    ...overrides,
  };
}

describe('galaxyFlightProfile', () => {
  it('Galaxy profile is slower translation and look than default', () => {
    expect(GALAXY_FLIGHT_PROFILE.moveSpeed).toBeLessThan(DEFAULT_FLIGHT_PROFILE.moveSpeed);
    expect(GALAXY_FLIGHT_PROFILE.lookSensitivity).toBeLessThan(
      DEFAULT_FLIGHT_PROFILE.lookSensitivity,
    );
    expect(GALAXY_FLIGHT_PROFILE.turboMultiplier).toBe(2);
  });

  it('Galaxy Shift is exactly 2× normal cruise', () => {
    expect(GALAXY_FLIGHT_PROFILE.moveSpeed).toBe(56);
    expect(
      GALAXY_FLIGHT_PROFILE.moveSpeed * GALAXY_FLIGHT_PROFILE.turboMultiplier,
    ).toBe(112);
  });

  it('applyGalaxyFlightProfile sets slower speeds on nav', () => {
    const nav = stubNav();
    applyGalaxyFlightProfile(nav);
    expect(nav.moveSpeed).toBe(GALAXY_FLIGHT_PROFILE.moveSpeed);
    expect(nav.turboMultiplier).toBe(GALAXY_FLIGHT_PROFILE.turboMultiplier);
    expect(nav.lookSensitivity).toBe(GALAXY_FLIGHT_PROFILE.lookSensitivity);
  });

  it('restoreDefaultFlightProfile restores ANALYSIS/NAV feel', () => {
    const nav = stubNav();
    applyGalaxyFlightProfile(nav);
    restoreDefaultFlightProfile(nav);
    expect(nav.moveSpeed).toBe(DEFAULT_FLIGHT_PROFILE.moveSpeed);
    expect(nav.turboMultiplier).toBe(DEFAULT_FLIGHT_PROFILE.turboMultiplier);
    expect(nav.lookSensitivity).toBe(DEFAULT_FLIGHT_PROFILE.lookSensitivity);
  });

  it('applyFlightProfile is a no-op for missing nav/profile', () => {
    expect(applyFlightProfile(null, GALAXY_FLIGHT_PROFILE)).toBeNull();
    const nav = stubNav({ moveSpeed: 99 });
    expect(applyFlightProfile(nav, null)).toBe(nav);
    expect(nav.moveSpeed).toBe(99);
  });
});
