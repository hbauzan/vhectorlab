import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GROUP_HUE_PALETTE,
  defaultGroupHueHexAt,
  ensureGroupHueColors,
  getGroupHueColor,
  normalizeGroupHueColors,
  colorForActivationWithGroupHue,
  groupsForHueUi,
  groupIdsForHueUi,
  normalizeGroupHueRowSpecs,
} from '../src/visualizer/groupHuePaint.js';
import { anchorsFromSettings, resolveVisualizationSettings } from '../src/ui/visualizationControlsDefaults.js';

describe('groupHuePaint', () => {
  it('groupsForHueUi uses textarea groupLabel, keeps encounter order', () => {
    expect(groupsForHueUi([
      { groupId: 'animals', groupLabel: 'animals' },
      { groupId: 'animals', groupLabel: 'animals' },
      { groupId: 'it_core', groupLabel: 'it_core' },
      { groupId: 'vehicles', groupLabel: 'vehicles' },
    ])).toEqual([
      { id: 'animals', label: 'animals' },
      { id: 'it_core', label: 'it_core' },
      { id: 'vehicles', label: 'vehicles' },
    ]);
    expect(groupIdsForHueUi([
      { groupId: 'A', groupLabel: 'Alpha' },
      { groupId: 'B', groupLabel: 'Beta' },
    ])).toEqual(['A', 'B']);
  });

  it('normalizeGroupHueRowSpecs accepts ids or {id,label}', () => {
    expect(normalizeGroupHueRowSpecs(['G1', 'G2'])).toEqual([
      { id: 'G1', label: 'G1' },
      { id: 'G2', label: 'G2' },
    ]);
    expect(normalizeGroupHueRowSpecs([
      { id: 'G1', label: 'cars' },
      { id: 'G2', label: 'women' },
    ])).toEqual([
      { id: 'G1', label: 'cars' },
      { id: 'G2', label: 'women' },
    ]);
  });

  it('palette cycles stably', () => {
    expect(defaultGroupHueHexAt(0)).toBe(DEFAULT_GROUP_HUE_PALETTE[0]);
    expect(defaultGroupHueHexAt(DEFAULT_GROUP_HUE_PALETTE.length)).toBe(
      DEFAULT_GROUP_HUE_PALETTE[0],
    );
  });

  it('ensureGroupHueColors fills missing ids and keeps persisted', () => {
    const map = ensureGroupHueColors(['GROUP_B', 'GROUP_A'], {
      GROUP_A: '#FF0000',
    });
    expect(map.GROUP_A).toBe('#FF0000');
    expect(map.GROUP_B).toMatch(/^#[0-9A-F]{6}$/);
    expect(map.GROUP_B).not.toBe('#FF0000');
  });

  it('normalizeGroupHueColors drops junk', () => {
    expect(normalizeGroupHueColors({ a: '#abc', b: '#00FF00', '': '#FFFFFF' })).toEqual({
      b: '#00FF00',
    });
  });

  it('getGroupHueColor: −1 black, +1 group hex, 0 midpoint', () => {
    const hex = '#00FF00';
    const neg = getGroupHueColor(-1, hex);
    expect(neg.r).toBeCloseTo(0, 5);
    expect(neg.g).toBeCloseTo(0, 5);
    expect(neg.b).toBeCloseTo(0, 5);

    const pos = getGroupHueColor(1, hex);
    expect(pos.r).toBeCloseTo(0, 5);
    expect(pos.g).toBeCloseTo(1, 5);
    expect(pos.b).toBeCloseTo(0, 5);

    const mid = getGroupHueColor(0, hex);
    expect(mid.r).toBeCloseTo(0, 5);
    expect(mid.g).toBeCloseTo(0.5, 5);
    expect(mid.b).toBeCloseTo(0, 5);
    expect(mid.alpha).toBeCloseTo(0.05, 5);

    const soft = getGroupHueColor(0.5, hex);
    expect(soft.g).toBeGreaterThan(0.2);
    expect(soft.g).toBeLessThan(1);
  });

  it('colorForActivationWithGroupHue OFF uses divergent; ON uses group ramp', () => {
    const vizOff = resolveVisualizationSettings({ groupHueEnabled: false });
    const anchors = anchorsFromSettings(vizOff);
    const off = colorForActivationWithGroupHue(1, 0, {
      viz: vizOff,
      anchors,
      zeroCoverage: 0,
      groupId: 'GROUP_1',
    });
    expect(off.r).toBeCloseTo(anchors.positive.r, 5);

    const vizOn = resolveVisualizationSettings({
      groupHueEnabled: true,
      groupHueColors: { GROUP_1: '#00FF00' },
    });
    const on = colorForActivationWithGroupHue(1, 0, {
      viz: vizOn,
      anchors: anchorsFromSettings(vizOn),
      zeroCoverage: 0,
      groupId: 'GROUP_1',
    });
    expect(on.g).toBeCloseTo(1, 5);
    expect(on.r).toBeCloseTo(0, 5);

    const missing = colorForActivationWithGroupHue(1, 0, {
      viz: vizOn,
      anchors: anchorsFromSettings(vizOn),
      zeroCoverage: 0,
      groupId: null,
    });
    expect(missing.r).toBeCloseTo(anchorsFromSettings(vizOn).positive.r, 5);
  });
});
