/**
 * Spectral Quorum Audit Export and 3D Inspection Readout.
 * Conforms to ddi-fw determinism, Protocolos 01–04, and external verification requirements:
 * - Human-interpretable 3D click readout: "Dim X — G1: A/B (P%) vs G2: C/D (Q%); Sd = S vs umbral nulo U"
 * - Auditable CSV / JSON exports with Float64 full precision (toPrecision(17))
 * - Complete metadata: model, D, group sizes, M=1000, seed, alpha=0.05, p95 null, vocab hash, timestamp
 */

/**
 * Format human-interpretable 3D inspection readout text for a given dimension.
 *
 * @param {number|null|undefined} dim - Dimension index
 * @param {Array<object>|null|undefined} groupMetrics - Group dimension metrics array
 * @param {object|null|undefined} [summary] - Spectral quorum summary object
 * @returns {string} Formatted readout text or empty string if invalid
 */
export function formatSpectralQuorumInspectionText(dim, groupMetrics, summary = null) {
  if (dim == null || !Number.isFinite(dim) || dim < 0) return '';
  if (!Array.isArray(groupMetrics) || dim >= groupMetrics.length || !groupMetrics[dim]) return '';

  const m = groupMetrics[dim];
  const sigMap = m.groupSignatures || {};
  const groupIds = Object.keys(sigMap);
  if (!groupIds.length) return '';

  const groupParts = groupIds.map((gid) => {
    const sig = sigMap[gid];
    const count = sig.coherenceCount ?? 0;
    const total = sig.coherenceTotal ?? 0;
    const pct = sig.coherencePct != null
      ? Math.round(sig.coherencePct)
      : (total > 0 ? Math.round((count / total) * 100) : 0);
    return `${gid}: ${count}/${total} (${pct}%)`;
  });

  const sdVal = typeof m.separability === 'number'
    ? m.separability.toFixed(4)
    : '--';

  const nullVal = (summary?.nullP95 != null && Number.isFinite(summary.nullP95))
    ? summary.nullP95.toFixed(4)
    : (summary?.minSeparability != null && Number.isFinite(summary.minSeparability)
        ? summary.minSeparability.toFixed(4)
        : 'N/A');

  return `Dim ${dim} — ${groupParts.join(' vs ')}; Sd = ${sdVal} vs umbral nulo ${nullVal}`;
}

/**
 * Generate complete auditable CSV export text with Float64 toPrecision(17).
 *
 * @param {Array<object>|null|undefined} items - Compare items (tokens with embedding & groupId)
 * @param {{ metrics: Array<object>, summary: object }|null|undefined} quorumResult - Result of computeSpectralQuorumMetrics
 * @param {object} [metadata] - Optional environment metadata (modelName, vocabHash, etc.)
 * @returns {string} CSV text
 */
export function generateSpectralQuorumCsv(items, quorumResult, metadata = {}) {
  const metrics = quorumResult?.metrics || [];
  const summary = quorumResult?.summary || {};
  const dimCount = summary.totalDim || metrics.length || 0;

  // Compute group counts from items if not provided in metadata
  const groupSizes = { ...(metadata.groupSizes || {}) };
  if (items && Array.isArray(items)) {
    for (const it of items) {
      if (!it?.groupId) continue;
      groupSizes[it.groupId] = (groupSizes[it.groupId] || 0) + 1;
    }
  }

  const modelName = metadata.modelName || 'BAAI/bge-m3';
  const prngSeedStr = summary.prngSeed !== undefined
    ? '0x' + (summary.prngSeed >>> 0).toString(16).toUpperCase()
    : '0xDEADBEEF';
  const permutationsRun = summary.permutationsRun || 1000;
  const nullP95Str = summary.nullP95 != null && Number.isFinite(summary.nullP95)
    ? summary.nullP95.toPrecision(17)
    : 'Infinity';
  const diagnosticStatus = summary.diagnostic?.status || 'OPERATIONAL';
  const vocabHash = metadata.vocabHash || 'N/A';
  const exportedAt = metadata.exportedAt || new Date().toISOString();

  const lines = [
    `# Spectral Quorum Audit Export (ddi-fw determinism)`,
    `# Model: ${modelName}`,
    `# Total Dimensions: ${dimCount}`,
    `# Permutation Iterations (M): ${permutationsRun}`,
    `# PRNG Seed: ${prngSeedStr}`,
    `# Alpha: 0.05`,
    `# Null Threshold (p95): ${nullP95Str}`,
    `# Sampling Diagnostic: ${diagnosticStatus}`,
    `# Sample Sizes: ${JSON.stringify(groupSizes)}`,
    `# Vocab Hash: ${vocabHash}`,
    `# Exported At: ${exportedAt}`,
    `dim,group,competitor_id,mu_g,sigma_g,mu_comp,sigma_comp,delta,polarity,sd,null_p95,admitted,coherence_count,coherence_total,coherence_pct,rank`,
  ];

  for (let d = 0; d < dimCount; d++) {
    const m = metrics[d];
    if (!m) continue;
    const sigMap = m.groupSignatures || {};
    const groupIds = Object.keys(sigMap);

    for (const gid of groupIds) {
      const sig = sigMap[gid];
      if (!sig) continue;

      const compId = sig.competitorId || '';
      const muG = typeof sig.muG === 'number' ? sig.muG.toPrecision(17) : (typeof m.meanA === 'number' ? m.meanA.toPrecision(17) : '0');
      const sigmaG = typeof sig.sigmaG === 'number' ? sig.sigmaG.toPrecision(17) : '0';
      const muComp = typeof sig.muComp === 'number' ? sig.muComp.toPrecision(17) : (typeof m.meanB === 'number' ? m.meanB.toPrecision(17) : '0');
      const sigmaComp = typeof sig.sigmaComp === 'number' ? sig.sigmaComp.toPrecision(17) : '0';
      const delta = typeof sig.delta === 'number' ? sig.delta.toPrecision(17) : '0';
      const polarity = sig.polarity ?? 1;
      const sd = typeof sig.separability === 'number' ? sig.separability.toPrecision(17) : '0';
      const admitted = Boolean(sig.isQuorum);
      const cCount = sig.coherenceCount ?? 0;
      const cTotal = sig.coherenceTotal ?? 0;
      const cPct = typeof sig.coherencePct === 'number' ? sig.coherencePct.toPrecision(17) : '0';
      const rank = sig.rank ?? 0;

      lines.push(`${d},${gid},${compId},${muG},${sigmaG},${muComp},${sigmaComp},${delta},${polarity},${sd},${nullP95Str},${admitted},${cCount},${cTotal},${cPct},${rank}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate complete auditable JSON export object with full numeric precision.
 *
 * @param {Array<object>|null|undefined} items
 * @param {{ metrics: Array<object>, summary: object }|null|undefined} quorumResult
 * @param {object} [metadata]
 * @returns {object} JSON audit object
 */
export function generateSpectralQuorumJson(items, quorumResult, metadata = {}) {
  const metrics = quorumResult?.metrics || [];
  const summary = quorumResult?.summary || {};
  const dimCount = summary.totalDim || metrics.length || 0;

  const groupSizes = { ...(metadata.groupSizes || {}) };
  if (items && Array.isArray(items)) {
    for (const it of items) {
      if (!it?.groupId) continue;
      groupSizes[it.groupId] = (groupSizes[it.groupId] || 0) + 1;
    }
  }

  const modelName = metadata.modelName || 'BAAI/bge-m3';
  const prngSeedStr = summary.prngSeed !== undefined
    ? '0x' + (summary.prngSeed >>> 0).toString(16).toUpperCase()
    : '0xDEADBEEF';
  const permutationsRun = summary.permutationsRun || 1000;
  const nullP95 = summary.nullP95 != null && Number.isFinite(summary.nullP95)
    ? summary.nullP95
    : null;
  const diagnosticStatus = summary.diagnostic?.status || 'OPERATIONAL';
  const vocabHash = metadata.vocabHash || 'N/A';
  const exportedAt = metadata.exportedAt || new Date().toISOString();

  const records = [];

  for (let d = 0; d < dimCount; d++) {
    const m = metrics[d];
    if (!m) continue;
    const sigMap = m.groupSignatures || {};
    const groupIds = Object.keys(sigMap);

    for (const gid of groupIds) {
      const sig = sigMap[gid];
      if (!sig) continue;

      records.push({
        dim: d,
        group: gid,
        competitorId: sig.competitorId || '',
        muG: typeof sig.muG === 'number' ? sig.muG : (typeof m.meanA === 'number' ? m.meanA : 0),
        sigmaG: typeof sig.sigmaG === 'number' ? sig.sigmaG : 0,
        muComp: typeof sig.muComp === 'number' ? sig.muComp : (typeof m.meanB === 'number' ? m.meanB : 0),
        sigmaComp: typeof sig.sigmaComp === 'number' ? sig.sigmaComp : 0,
        delta: typeof sig.delta === 'number' ? sig.delta : 0,
        polarity: sig.polarity ?? 1,
        sd: typeof sig.separability === 'number' ? sig.separability : 0,
        nullP95,
        admitted: Boolean(sig.isQuorum),
        coherenceCount: sig.coherenceCount ?? 0,
        coherenceTotal: sig.coherenceTotal ?? 0,
        coherencePct: typeof sig.coherencePct === 'number' ? sig.coherencePct : 0,
        rank: sig.rank ?? 0,
      });
    }
  }

  return {
    metadata: {
      version: '1.0.0',
      generator: 'VHectorLab 3D Spectral Quorum Audit Export',
      exportedAt,
      modelName,
      totalDimensions: dimCount,
      permutationCount: permutationsRun,
      prngSeed: prngSeedStr,
      alpha: 0.05,
      nullThresholdP95: nullP95,
      samplingDiagnostic: summary.diagnostic || { status: diagnosticStatus },
      groupSizes,
      vocabHash,
    },
    summary: {
      quorumCapacity: summary.quorumCapacity ?? 0,
      quorumCount: summary.quorumCount ?? 0,
      maxDelta: summary.maxDelta ?? 0,
      avgDelta: summary.avgDelta ?? 0,
      topQuorumDims: summary.topQuorumDims || [],
    },
    records,
  };
}

/**
 * Trigger browser file download of the audit payload.
 * Safe in Node / headless test environments (no-op if document / window missing).
 *
 * @param {Array<object>} items
 * @param {{ metrics: Array<object>, summary: object }} quorumResult
 * @param {'csv'|'json'} [format='csv']
 * @param {object} [metadata]
 * @returns {string} Download filename
 */
export function downloadSpectralQuorumAudit(items, quorumResult, format = 'csv', metadata = {}) {
  const isJson = String(format).toLowerCase() === 'json';
  const content = isJson
    ? JSON.stringify(generateSpectralQuorumJson(items, quorumResult, metadata), null, 2)
    : generateSpectralQuorumCsv(items, quorumResult, metadata);
  const mimeType = isJson ? 'application/json' : 'text/csv;charset=utf-8';
  const ext = isJson ? 'json' : 'csv';
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `spectral_quorum_audit_${dateStr}.${ext}`;

  if (typeof document !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return filename;
}
