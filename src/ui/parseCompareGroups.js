import * as THREE from 'three';

/** Max tokens forwarded to /compare (ComparePanel contract). */
export const COMPARE_MAX_TOKENS = 1024;

/** Extra leftward screen-space offset (px) for group badges vs token labels.
 * Kept modest — too large pushed badges under the left Compare dock (z-index). */
export const GROUP_LABEL_SCREEN_OFFSET_X = 36;

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
 * Also stores a compact `groups` summary for legends / overlay recovery.
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
  /** @type {Map<string, { id: string, label: string, count: number }>} */
  const groupMap = new Map();
  for (const it of items) {
    if (!it?.groupId) continue;
    const prev = groupMap.get(it.groupId);
    if (prev) prev.count += 1;
    else {
      groupMap.set(it.groupId, {
        id: it.groupId,
        label: it.groupLabel || it.groupId,
        count: 1,
      });
    }
  }
  return {
    ...compareResponse,
    items,
    groups: [...groupMap.values()],
  };
}

/**
 * Re-apply groupId/groupLabel onto Instancer label rows from compare items (by id).
 * Recovers overlay when thread runtime dropped meta or SAE remapped fields.
 * @param {Array} tokenLabels
 * @param {Array<{ id?: string, groupId?: string, groupLabel?: string }>|null|undefined} items
 * @returns {Array}
 */
export function enrichLabelsWithGroupMeta(tokenLabels, items) {
  if (!tokenLabels?.length) return tokenLabels || [];
  if (!items?.length) return tokenLabels;
  const byId = new Map();
  for (const it of items) {
    if (it?.id != null) byId.set(it.id, it);
  }
  return tokenLabels.map((lab, i) => {
    if (!lab || lab.type === 'group') return lab;
    const meta = (lab.id != null && byId.get(lab.id)) || items[i];
    if (!meta?.groupId) return lab;
    return {
      ...lab,
      groupId: meta.groupId,
      groupLabel: meta.groupLabel || meta.groupId,
    };
  });
}

/**
 * Build floating group badges at the centroid of member thread origins.
 * Prefer mid-thread origin when provided as origin3D (Instancer uses thread start;
 * ANALYSIS stacks groups on Y so average start ≈ block center).
 * @param {Array<{ groupId?: string, groupLabel?: string, origin3D?: THREE.Vector3 }>} tokenLabels
 * @returns {Array<{ id: string, text: string, type: 'group', origin3D: THREE.Vector3, groupId: string, groupLabel: string }>}
 */
export function buildGroupLabels(tokenLabels) {
  /** @type {Map<string, { id: string, text: string, groupId: string, origins: THREE.Vector3[] }>} */
  const byGroup = new Map();

  for (const lab of tokenLabels || []) {
    if (!lab || !lab.groupId || !lab.origin3D) continue;
    if (!byGroup.has(lab.groupId)) {
      byGroup.set(lab.groupId, {
        id: `group:${lab.groupId}`,
        text: lab.groupLabel || lab.groupId,
        groupId: lab.groupId,
        origins: [],
      });
    }
    byGroup.get(lab.groupId).origins.push(lab.origin3D);
  }

  /** @type {Array<{ id: string, text: string, type: 'group', origin3D: THREE.Vector3, groupId: string, groupLabel: string }>} */
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
      groupId: g.groupId,
      groupLabel: g.text,
      origin3D: new THREE.Vector3(x / n, y / n, z / n),
    });
  }
  return out;
}

/**
 * Overlay label set for Compare.
 * When GROUP_* meta is present, show **only** group badges (token cards at N≈100+
 * bury the groups and are unreadable; cosine list still has every token).
 * @param {Array} tokenLabels
 * @returns {Array}
 */
export function mergeCompareOverlayLabels(tokenLabels) {
  const tokens = (tokenLabels || []).filter((l) => l && l.type !== 'group');
  const groups = buildGroupLabels(tokens);
  if (groups.length > 0) return groups;
  return tokens;
}
