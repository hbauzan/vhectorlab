/**
 * Short floating ThreadLabels text (3D overlay).
 * Arithmetic: WORD_A | WORD_B | WORD_C | RES | TOP1
 * Compare: full entered token text (unchanged — show every token as typed)
 */

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
