/**
 * Short floating ThreadLabels text (3D overlay).
 * Arithmetic: WORD_A | WORD_B | WORD_C | RES | TOP1
 * Compare: full entered token text (unchanged — show every token as typed)
 */

/** Canonical Arithmetic thread order (layout sequenceIndex 0..4). */
export const ARITHMETIC_THREAD_ORDER = Object.freeze(['A', 'B', 'C', 'RES', 'TOP1']);

/**
 * @param {'A'|'B'|'C'|'RES'|'TOP1'} slot
 * @returns {number} sequenceIndex for LayoutEngine (same in ANALYSIS + NAVIGATION)
 */
export function arithmeticSequenceIndex(slot) {
  const idx = ARITHMETIC_THREAD_ORDER.indexOf(slot);
  if (idx < 0) {
    throw new Error(`Unknown arithmetic thread slot: ${slot}`);
  }
  return idx;
}

/**
 * @param {'A'|'B'|'C'|'RES'|'TOP1'} slot
 * @returns {string}
 */
export function arithmeticThreadLabel(slot) {
  switch (slot) {
    case 'A': return 'WORD_A';
    case 'B': return 'WORD_B';
    case 'C': return 'WORD_C';
    case 'RES': return 'RES';
    case 'TOP1': return 'TOP1';
    default: return String(slot || '');
  }
}
