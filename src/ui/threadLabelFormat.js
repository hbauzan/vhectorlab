/**
 * Short floating ThreadLabels text (3D overlay only).
 * Arithmetic: WORD_A | WORD_B | WORD_C | RES | TOP1
 * Compare: TOPn + token truncated to TOKEN_MAX chars
 */

export const THREAD_LABEL_TOKEN_MAX = 10;

/**
 * @param {unknown} text
 * @param {number} [max=THREAD_LABEL_TOKEN_MAX]
 * @returns {string}
 */
export function truncateToken(text, max = THREAD_LABEL_TOKEN_MAX) {
  const s = String(text ?? '').trim();
  if (s.length <= max) return s;
  return s.slice(0, max);
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

/**
 * @param {number} rank1Based - 1 = REF / first row
 * @param {unknown} token
 * @returns {string}
 */
export function compareThreadLabel(rank1Based, token) {
  const n = Math.max(1, Math.round(Number(rank1Based) || 1));
  const tok = truncateToken(token);
  return tok ? `TOP${n} ${tok}` : `TOP${n}`;
}
