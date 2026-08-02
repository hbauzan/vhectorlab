import * as THREE from 'three';

/** Max tokens forwarded to /compare (ComparePanel contract). */
export const COMPARE_MAX_TOKENS = 1024;

/** Extra leftward screen-space offset (px) for group badges vs token labels. */
export const GROUP_LABEL_SCREEN_OFFSET_X = 96;

const GROUP_HEADER_RE = /^([A-Za-z][A-Za-z0-9_\-]*)\s*[=:]\s*(.*)$/;

/**
 * Split a free-text chunk into tokens (comma / whitespace / newline).
 * @param {string} text
 * @returns {string[]}
 */
export function splitCompareTokens(text) {
  return String(text || '')
    .split(/[\s,\n]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * @param {string} s
 * @returns {string}
 */
export function stripOuterQuotes(s) {
  const t = String(s || '').trim();
  if (
    (t.startsWith('"') && t.endsWith('"') && t.length >= 2)
    || (t.startsWith("'") && t.endsWith("'") && t.length >= 2)
  ) {
    return t.slice(1, -1).trim();
  }
  return t;
}

/**
 * Parse Compare textarea: flat token list OR GROUP_name = tokens blocks.
 *
 * Grouped mode activates when any line looks like `Name = …` / `Name: …`.
 * Leading tokens before the first header become group UNGROUPED.
 * Duplicates across groups are kept (intentional).
 *
 * @param {string} rawText
 * @param {number} [maxTokens=COMPARE_MAX_TOKENS]
 * @returns {{
 *   mode: 'flat'|'grouped',
 *   tokens: string[],
 *   tokenMeta: Array<{ groupId: string, groupLabel: string }|null>,
 *   groups: Array<{ id: string, label: string, tokens: string[] }>
 * }}
 */
export function parseCompareInput(rawText, maxTokens = COMPARE_MAX_TOKENS) {
  const text = String(rawText || '');
  const lines = text.split(/\r?\n/);
  const hasGroupHeader = lines.some((line) => GROUP_HEADER_RE.test(line.trim()));

  if (!hasGroupHeader) {
    const tokens = splitCompareTokens(text).slice(0, maxTokens);
    return {
      mode: 'flat',
      tokens,
      tokenMeta: tokens.map(() => null),
      groups: [],
    };
  }

  /** @type {Array<{ id: string, label: string, tokens: string[] }>} */
  const namedGroups = [];
  /** @type {{ id: string, label: string, tokens: string[] }|null} */
  let current = null;
  /** @type {string[]} */
  const ungroupedBefore = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(GROUP_HEADER_RE);
    if (match) {
      current = { id: match[1], label: match[1], tokens: [] };
      namedGroups.push(current);
      const rest = stripOuterQuotes(match[2]);
      if (rest) current.tokens.push(...splitCompareTokens(rest));
    } else if (current) {
      current.tokens.push(...splitCompareTokens(stripOuterQuotes(trimmed)));
    } else {
      ungroupedBefore.push(...splitCompareTokens(stripOuterQuotes(trimmed)));
    }
  }

  /** @type {Array<{ id: string, label: string, tokens: string[] }>} */
  const groups = [];
  if (ungroupedBefore.length) {
    groups.push({ id: 'UNGROUPED', label: 'UNGROUPED', tokens: ungroupedBefore });
  }
  for (const g of namedGroups) {
    if (g.tokens.length) groups.push(g);
  }

  /** @type {string[]} */
  const tokens = [];
  /** @type {Array<{ groupId: string, groupLabel: string }|null>} */
  const tokenMeta = [];

  for (const g of groups) {
    for (const tok of g.tokens) {
      if (tokens.length >= maxTokens) break;
      tokens.push(tok);
      tokenMeta.push({ groupId: g.id, groupLabel: g.label });
    }
  }

  return { mode: 'grouped', tokens, tokenMeta, groups };
}

/**
 * Attach groupId/groupLabel onto /compare items by sequence index.
 * Spreads preserve meta through compareCosine reorder/sort.
 * @param {object} compareResponse
 * @param {Array<{ groupId: string, groupLabel: string }|null>|null|undefined} tokenMeta
 * @returns {object}
 */
export function attachCompareGroupMeta(compareResponse, tokenMeta) {
  if (!compareResponse || !Array.isArray(compareResponse.items)) return compareResponse;
  const meta = Array.isArray(tokenMeta) ? tokenMeta : [];
  const items = compareResponse.items.map((item, i) => {
    const m = meta[i];
    if (!m) {
      const next = { ...item };
      delete next.groupId;
      delete next.groupLabel;
      return next;
    }
    return { ...item, groupId: m.groupId, groupLabel: m.groupLabel };
  });
  return { ...compareResponse, items };
}

/**
 * Build floating group badges at the centroid of member thread origins.
 * @param {Array<{ groupId?: string, groupLabel?: string, origin3D?: THREE.Vector3 }>} tokenLabels
 * @returns {Array<{ id: string, text: string, type: 'group', origin3D: THREE.Vector3 }>}
 */
export function buildGroupLabels(tokenLabels) {
  /** @type {Map<string, { id: string, text: string, origins: THREE.Vector3[] }>} */
  const byGroup = new Map();

  for (const lab of tokenLabels || []) {
    if (!lab || !lab.groupId || !lab.origin3D) continue;
    if (!byGroup.has(lab.groupId)) {
      byGroup.set(lab.groupId, {
        id: `group:${lab.groupId}`,
        text: lab.groupLabel || lab.groupId,
        origins: [],
      });
    }
    byGroup.get(lab.groupId).origins.push(lab.origin3D);
  }

  /** @type {Array<{ id: string, text: string, type: 'group', origin3D: THREE.Vector3 }>} */
  const out = [];
  for (const g of byGroup.values()) {
    if (!g.origins.length) continue;
    let x = 0;
    let y = 0;
    let z = 0;
    for (const o of g.origins) {
      x += o.x;
      y += o.y;
      z += o.z;
    }
    const n = g.origins.length;
    out.push({
      id: g.id,
      text: g.text,
      type: 'group',
      origin3D: new THREE.Vector3(x / n, y / n, z / n),
    });
  }
  return out;
}

/**
 * Group badges first, then per-token labels (paint / DOM order).
 * @param {Array} tokenLabels
 * @returns {Array}
 */
export function mergeCompareOverlayLabels(tokenLabels) {
  const tokens = (tokenLabels || []).filter((l) => l && l.type !== 'group');
  return [...buildGroupLabels(tokens), ...tokens];
}
