/**
 * Pure helpers for Compare Visualize + cosine list (testable, no DOM).
 */
import {
  attachCompareGroupMeta,
  parseCompareInput,
} from '../ui/parseCompareGroups.js';
import { escapeHtml } from './arithmeticWire.js';

/**
 * @param {string} text
 * @returns {{ tokens: string[], tokenMeta: Array, mode: string, groups: Array }}
 */
export function parseCompareText(text) {
  return parseCompareInput(text);
}

/**
 * @param {{ computeCompare: Function }} provider
 * @param {string[]} tokens
 * @param {Array|{groupId:string,groupLabel:string}|null} [tokenMeta]
 * @returns {Promise<{ raw: object, data: object }>}
 */
export async function fetchCompareResults(provider, tokens, tokenMeta = null) {
  if (!provider || typeof provider.computeCompare !== 'function') {
    throw new Error('Compare provider is not available');
  }
  const list = Array.isArray(tokens)
    ? tokens.map((t) => String(t || '').trim()).filter(Boolean)
    : [];
  if (!list.length) {
    throw new Error('At least one token is required');
  }
  const raw = await provider.computeCompare(list);
  const data = attachCompareGroupMeta(
    { ...raw, featureSpace: raw?.featureSpace || 'RAW' },
    tokenMeta,
  );
  return { raw, data };
}

/**
 * @param {Array<{ id?: string, text?: string, cosine_vs_first?: number, groupId?: string }>|null|undefined} items
 * @returns {string} HTML for cosine list children
 */
export function cosineListHtml(items) {
  if (!items || items.length === 0) {
    return '<li class="lab-compare-list__empty lab-muted">Visualize a sequence to see similarity vs the anchor…</li>';
  }
  return items
    .map((item, index) => {
      const word = escapeHtml(item?.text ?? '');
      const score =
        index === 0
          ? 1
          : Number.isFinite(Number(item?.cosine_vs_first))
            ? Number(item.cosine_vs_first)
            : 0;
      const ref =
        index === 0 ? '<span class="lab-compare-list__ref">REF</span>' : '';
      const upDisabled = index === 0 ? 'disabled' : '';
      const downDisabled = index === items.length - 1 ? 'disabled' : '';
      return `
        <li class="lab-compare-list__item" data-id="${escapeHtml(item?.id || `tok_${index}`)}">
          <span class="lab-compare-list__rank lab-mono">#${index + 1}</span>
          <span class="lab-compare-list__word">${word}</span>
          ${ref}
          <span class="lab-compare-list__score lab-mono">${score.toFixed(4)}</span>
          <span class="lab-compare-list__reorder">
            <button type="button" class="lab-btn lab-btn--ghost lab-compare-reorder" data-dir="up" data-index="${index}" ${upDisabled} aria-label="Move up">▲</button>
            <button type="button" class="lab-btn lab-btn--ghost lab-compare-reorder" data-dir="down" data-index="${index}" ${downDisabled} aria-label="Move down">▼</button>
          </span>
        </li>`;
    })
    .join('');
}

/**
 * Group legend chips from compare items.
 * @param {Array<{ groupId?: string, groupLabel?: string }>|null|undefined} items
 * @returns {string}
 */
export function groupLegendHtml(items) {
  /** @type {Map<string, { label: string, count: number }>} */
  const counts = new Map();
  for (const it of items || []) {
    if (!it?.groupId) continue;
    const label = it.groupLabel || it.groupId;
    const prev = counts.get(it.groupId);
    if (prev) prev.count += 1;
    else counts.set(it.groupId, { label, count: 1 });
  }
  if (!counts.size) return '';
  return [...counts.values()]
    .map(
      (g) =>
        `<span class="lab-compare-chip" title="${g.count} tokens">${escapeHtml(g.label)}<em>${g.count}</em></span>`,
    )
    .join('');
}

/**
 * True when ≥2 distinct groupIds (blocks cosine global sort).
 * @param {Array<{ groupId?: string }>|null|undefined} items
 */
export function hasMultipleGroups(items) {
  const ids = new Set();
  for (const it of items || []) {
    if (it?.groupId) ids.add(it.groupId);
  }
  return ids.size >= 2;
}
