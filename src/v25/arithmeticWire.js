/**
 * Pure helpers for Arithmetic Top-10 rendering + provider call (testable, no DOM).
 */

/**
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * @param {Array<{ word?: string, score?: number }>|null|undefined} results
 * @returns {string} HTML for `<ul class="lab-results-list">` children
 */
export function resultsListHtml(results) {
  if (!results || results.length === 0) {
    return '<li class="lab-results-list__empty lab-muted">No semantic matches found</li>';
  }
  return results
    .map((item, index) => {
      const word = escapeHtml(item?.word ?? '');
      const score = Number(item?.score);
      const scoreText = Number.isFinite(score) ? score.toFixed(4) : '--';
      return `
        <li class="lab-results-list__item">
          <span class="lab-results-list__rank lab-mono">#${index + 1}</span>
          <span class="lab-results-list__word">${word}</span>
          <span class="lab-results-list__score lab-mono">${scoreText}</span>
        </li>`;
    })
    .join('');
}

/**
 * @param {{ computeArithmetic: Function }} provider
 * @param {{ wordA: string, wordB: string, wordC: string, topK?: number }} words
 * @returns {Promise<{ results: Array, raw: object }>}
 */
export async function fetchArithmeticResults(provider, words) {
  if (!provider || typeof provider.computeArithmetic !== 'function') {
    throw new Error('Arithmetic provider is not available');
  }
  const wordA = String(words?.wordA || '').trim();
  const wordB = String(words?.wordB || '').trim();
  const wordC = String(words?.wordC || '').trim();
  const topK = Number(words?.topK) > 0 ? Number(words.topK) : 10;
  if (!wordA || !wordB || !wordC) {
    throw new Error('Words A, B, and C are required');
  }
  const raw = await provider.computeArithmetic(wordA, wordB, wordC, topK);
  const results = Array.isArray(raw?.results) ? raw.results : [];
  return { results, raw };
}
