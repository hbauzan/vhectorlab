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

  it('regression Bug B2: uses spectralHighlightColor for highlight when spectralQuorumEnabled is on', () => {
    const viz = resolveVisualizationSettings({
      spectralQuorumEnabled: true,
      spectralHighlightColor: '#FF0000',
      oppositeHighlightColor: '#00E5FF',
      spectralHighlightStrength: 100,
      spectralDecimalGain: 10,
    });
    const anchors = anchorsFromSettings(viz);
    const groupMetric = {
      dim: 0,
      isQuorum: true,
      relativeScore: 1.0,
      groupSignatures: {
        G1: { isQuorum: true, relativeScore: 1.0 },
      },
    };
    const col = colorForActivationWithGroupHue(0.5, 0, {
      viz,
      anchors,
      zeroCoverage: 0,
      groupDimMetrics: [groupMetric],
      groupId: 'G1',
    });
    // Should be tinted with spectral red (#FF0000), not opposite cian (#00E5FF)
    expect(col.r).toBeCloseTo(1, 1);
    expect(col.b).toBeCloseTo(0, 1);
  });

  it('empty quorum fallback: preserves base divergent color without cancellation when admittedCount is 0', () => {
    const viz = resolveVisualizationSettings({
      spectralQuorumEnabled: true,
      spectralPajaCancelCoverage: 100,
    });
    const anchors = anchorsFromSettings(viz);
    const emptyQuorumMetric = {
      dim: 0,
      isQuorum: false,
      relativeScore: 0.0,
      quorumCount: 0,
      groupSignatures: {
        G1: { isQuorum: false, relativeScore: 0.0, groupAdmittedCount: 0 },
      },
    };
    const col = colorForActivationWithGroupHue(1.0, 0, {
      viz,
      anchors,
      zeroCoverage: 0,
      groupDimMetrics: [emptyQuorumMetric],
      groupId: 'G1',
    });
    // With admittedCount = 0, fallback does not cancel to black: preserves positive anchor (yellow #FFE600)
    expect(col.r).toBeCloseTo(anchors.positive.r, 4);
    expect(col.g).toBeCloseTo(anchors.positive.g, 4);
    expect(col.b).toBeCloseTo(anchors.positive.b, 4);
  });

  it('bicolor polarity rendering: elevation (+1) gets cyan and depression (-1) gets neon rose', () => {
    const viz = resolveVisualizationSettings({
      spectralQuorumEnabled: true,
      spectralElevationColor: '#00E5FF',
      spectralDepressionColor: '#FF3366',
      spectralHighlightStrength: 100,
      spectralDecimalGain: 10,
    });
    const anchors = anchorsFromSettings(viz);
    const metric = {
      dim: 0,
      isQuorum: true,
      relativeScore: 1.0,
      quorumCount: 1,
      groupSignatures: {
        G_elev: { isQuorum: true, relativeScore: 1.0, polarity: 1, groupAdmittedCount: 1 },
        G_depr: { isQuorum: true, relativeScore: 1.0, polarity: -1, groupAdmittedCount: 1 },
      },
    };

    const colElev = colorForActivationWithGroupHue(0.5, 0, {
      viz,
      anchors,
      zeroCoverage: 0,
      groupDimMetrics: [metric],
      groupId: 'G_elev',
    });
    // Elevation receives #00E5FF (Electric Cyan: r=0, g=0.9, b=1.0)
    expect(colElev.r).toBeCloseTo(0, 1);
    expect(colElev.g).toBeGreaterThan(0.7);
    expect(colElev.b).toBeCloseTo(1, 1);

    const colDepr = colorForActivationWithGroupHue(0.5, 0, {
      viz,
      anchors,
      zeroCoverage: 0,
      groupDimMetrics: [metric],
      groupId: 'G_depr',
    });
    // Depression receives #FF3366 (Neon Rose: r=1.0, g=0.2, b=0.4)
    expect(colDepr.r).toBeCloseTo(1, 1);
    expect(colDepr.g).toBeLessThan(0.4);
    expect(colDepr.b).toBeGreaterThan(0.2);
    expect(colDepr.b).toBeLessThan(0.6);
  });

  it('custom polarity anchors: user-defined elevation and depression hexes are respected', () => {
    const viz = resolveVisualizationSettings({
      spectralQuorumEnabled: true,
      spectralElevationColor: '#00FF00',
      spectralDepressionColor: '#0000FF',
      spectralHighlightStrength: 100,
      spectralDecimalGain: 10,
    });
    const anchors = anchorsFromSettings(viz);
    const metric = {
      dim: 0,
      isQuorum: true,
      relativeScore: 1.0,
      quorumCount: 1,
      groupSignatures: {
        G_elev: { isQuorum: true, relativeScore: 1.0, polarity: 1, groupAdmittedCount: 1 },
        G_depr: { isQuorum: true, relativeScore: 1.0, polarity: -1, groupAdmittedCount: 1 },
      },
    };

    const colElev = colorForActivationWithGroupHue(0.5, 0, {
      viz,
      anchors,
      zeroCoverage: 0,
      groupDimMetrics: [metric],
      groupId: 'G_elev',
    });
    expect(colElev.g).toBeCloseTo(1, 1);
    expect(colElev.b).toBeCloseTo(0, 1);

    const colDepr = colorForActivationWithGroupHue(0.5, 0, {
      viz,
      anchors,
      zeroCoverage: 0,
      groupDimMetrics: [metric],
      groupId: 'G_depr',
    });
    expect(colDepr.b).toBeCloseTo(1, 1);
    expect(colDepr.r).toBeCloseTo(0, 1);
  });
});

