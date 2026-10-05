import { describe, expect, it } from 'vitest';
import {
  formatSpectralQuorumInspectionText,
  generateSpectralQuorumCsv,
  generateSpectralQuorumJson,
  downloadSpectralQuorumAudit,
} from '../src/ui/spectralQuorumAuditExport.js';

describe('spectralQuorumAuditExport', () => {
  const mockItems = [
    { text: 'car', groupId: 'vehicles', embedding: [0.1, 0.2] },
    { text: 'truck', groupId: 'vehicles', embedding: [0.15, 0.25] },
    { text: 'girl', groupId: 'women', embedding: [0.05, 0.8] },
    { text: 'mother', groupId: 'women', embedding: [0.06, 0.85] },
  ];

  const mockMetrics = [
    {
      dim: 0,
      separability: 1.1023456789012345,
      deltaMean: 0.08,
      polarity: 1,
      isQuorum: true,
      rank: 0,
      groupSignatures: {
        vehicles: {
          dim: 0,
          delta: 0.08,
          absDelta: 0.08,
          polarity: 1,
          separability: 1.1023456789012345,
          competitorId: 'women',
          muG: 0.125,
          sigmaG: 0.025,
          muComp: 0.045,
          sigmaComp: 0.04757152063003058,
          coherenceCount: 2,
          coherenceTotal: 2,
          coherencePct: 100.0,
          rank: 0,
          isQuorum: true,
          relativeScore: 1.0,
        },
        women: {
          dim: 0,
          delta: -0.08,
          absDelta: 0.08,
          polarity: -1,
          separability: 1.1023456789012345,
          competitorId: 'vehicles',
          muG: 0.055,
          sigmaG: 0.005,
          muComp: 0.125,
          sigmaComp: 0.025,
          coherenceCount: 2,
          coherenceTotal: 2,
          coherencePct: 100.0,
          rank: 0,
          isQuorum: true,
          relativeScore: 1.0,
        },
      },
    },
    {
      dim: 1,
      separability: 0.45,
      deltaMean: 0.02,
      polarity: -1,
      isQuorum: false,
      rank: 1,
      groupSignatures: {
        vehicles: {
          dim: 1,
          delta: -0.6,
          absDelta: 0.6,
          polarity: -1,
          separability: 0.45,
          competitorId: 'women',
          muG: 0.225,
          sigmaG: 0.025,
          muComp: 0.825,
          sigmaComp: 0.025,
          coherenceCount: 1,
          coherenceTotal: 2,
          coherencePct: 50.0,
          rank: 1,
          isQuorum: false,
          relativeScore: 0.0,
        },
        women: {
          dim: 1,
          delta: 0.6,
          absDelta: 0.6,
          polarity: 1,
          separability: 0.45,
          competitorId: 'vehicles',
          muG: 0.825,
          sigmaG: 0.025,
          muComp: 0.225,
          sigmaComp: 0.025,
          coherenceCount: 2,
          coherenceTotal: 2,
          coherencePct: 100.0,
          rank: 1,
          isQuorum: false,
          relativeScore: 0.0,
        },
      },
    },
  ];

  const mockSummary = {
    totalDim: 2,
    quorumCapacity: 1,
    quorumCount: 1,
    maxDelta: 0.08,
    avgDelta: 0.05,
    minSeparability: 0.7314,
    nullP95: 0.7314159265358979,
    diagnostic: {
      status: 'OPERATIONAL',
      pMin: 0.0001,
      message: 'Operativo normal',
    },
    prngSeed: 0xDEADBEEF,
    permutationsRun: 1000,
  };

  const mockQuorumResult = {
    metrics: mockMetrics,
    summary: mockSummary,
  };

  it('formatSpectralQuorumInspectionText formats readout accurately', () => {
    const text = formatSpectralQuorumInspectionText(0, mockMetrics, mockSummary);
    expect(text).toBe(
      'Dim 0 — vehicles: 2/2 (100%) vs women: 2/2 (100%); Sd = 1.1023 vs umbral nulo 0.7314'
    );

    // Dim 1
    const textDim1 = formatSpectralQuorumInspectionText(1, mockMetrics, mockSummary);
    expect(textDim1).toBe(
      'Dim 1 — vehicles: 1/2 (50%) vs women: 2/2 (100%); Sd = 0.4500 vs umbral nulo 0.7314'
    );

    // Invalid dim
    expect(formatSpectralQuorumInspectionText(-1, mockMetrics, mockSummary)).toBe('');
    expect(formatSpectralQuorumInspectionText(99, mockMetrics, mockSummary)).toBe('');
    expect(formatSpectralQuorumInspectionText(null, mockMetrics, mockSummary)).toBe('');
  });

  it('generateSpectralQuorumCsv outputs full metadata and 17-digit precision', () => {
    const csv = generateSpectralQuorumCsv(mockItems, mockQuorumResult, {
      modelName: 'BAAI/bge-m3',
      vocabHash: 'sha256-test1234',
    });

    const lines = csv.split('\n');
    expect(lines[0]).toBe('# Spectral Quorum Audit Export (ddi-fw determinism)');
    expect(lines[1]).toBe('# Model: BAAI/bge-m3');
    expect(lines[2]).toBe('# Total Dimensions: 2');
    expect(lines[3]).toBe('# Permutation Iterations (M): 1000');
    expect(lines[4]).toBe('# PRNG Seed: 0xDEADBEEF');
    expect(lines[5]).toBe('# Alpha: 0.05');
    expect(lines[6]).toContain('# Null Threshold (p95): 0.7314159265358979');
    expect(lines[7]).toBe('# Sampling Diagnostic: OPERATIONAL');
    expect(lines[8]).toBe('# Sample Sizes: {"vehicles":2,"women":2}');
    expect(lines[9]).toBe('# Vocab Hash: sha256-test1234');
    expect(lines[11]).toBe(
      'dim,group,competitor_id,mu_g,sigma_g,mu_comp,sigma_comp,delta,polarity,sd,null_p95,admitted,coherence_count,coherence_total,coherence_pct,rank'
    );

    // Check data row precision and round-trip
    const row0 = lines[12].split(',');
    expect(row0[0]).toBe('0'); // dim
    expect(row0[1]).toBe('vehicles'); // group
    expect(row0[2]).toBe('women'); // competitor_id
    expect(Number(row0[3])).toBeCloseTo(0.125, 10); // mu_g
    expect(Number(row0[4])).toBeCloseTo(0.025, 10); // sigma_g
    expect(Number(row0[5])).toBeCloseTo(0.045, 10); // mu_comp
    expect(Number(row0[6])).toBeCloseTo(0.04757152, 6); // sigma_comp
    expect(Number(row0[7])).toBeCloseTo(0.08, 10); // delta
    expect(row0[8]).toBe('1'); // polarity
    expect(Number(row0[9])).toBeCloseTo(1.1023456789012345, 10); // sd
    expect(row0[11]).toBe('true'); // admitted
    expect(row0[12]).toBe('2'); // coherence_count
    expect(row0[13]).toBe('2'); // coherence_total

    // Verificación independiente: recalcular Sd con tolerancia < 1e-6
    const muG = Number(row0[3]);
    const sigG = Number(row0[4]);
    const muComp = Number(row0[5]);
    const sigComp = Number(row0[6]);
    const delta = Math.abs(muG - muComp);
    const recomputedSd = delta / (sigG + sigComp + 1e-6);
    const exportedSd = Number(row0[9]);
    expect(Math.abs(recomputedSd - exportedSd)).toBeLessThan(1e-6);
  });

  it('generateSpectralQuorumJson generates complete audit structure', () => {
    const json = generateSpectralQuorumJson(mockItems, mockQuorumResult, {
      modelName: 'BAAI/bge-m3',
      vocabHash: 'sha256-test1234',
    });

    expect(json.metadata.modelName).toBe('BAAI/bge-m3');
    expect(json.metadata.alpha).toBe(0.05);
    expect(json.metadata.prngSeed).toBe('0xDEADBEEF');
    expect(json.metadata.permutationCount).toBe(1000);
    expect(json.metadata.groupSizes).toEqual({ vehicles: 2, women: 2 });
    expect(json.summary.quorumCount).toBe(1);

    expect(json.records).toHaveLength(4); // 2 dims * 2 groups
    const rec0 = json.records[0];
    expect(rec0.dim).toBe(0);
    expect(rec0.group).toBe('vehicles');
    expect(rec0.competitorId).toBe('women');
    expect(rec0.admitted).toBe(true);
    expect(rec0.coherencePct).toBe(100.0);
  });

  it('downloadSpectralQuorumAudit returns valid filename for csv and json', () => {
    const csvFilename = downloadSpectralQuorumAudit(mockItems, mockQuorumResult, 'csv');
    expect(csvFilename).toMatch(/^spectral_quorum_audit_.*\.csv$/);

    const jsonFilename = downloadSpectralQuorumAudit(mockItems, mockQuorumResult, 'json');
    expect(jsonFilename).toMatch(/^spectral_quorum_audit_.*\.json$/);
  });
});
