import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createMulberry32 } from '../src/visualizer/spectralPrng.js';
import {
  buildGroupCosineRows,
  cosineDot,
  l2Normalize,
  pruneVector,
  prunedL2Normalize,
  prunedCosineDot,
  recomputeCompareAnchorScores,
} from '../src/ui/compareCosine.js';
import { computeSpectralQuorumMetrics } from '../src/visualizer/spectralQuorum.js';
import { ComparePanel } from '../src/ui/ComparePanel.js';

/** Box–Muller using the repo Mulberry32. Seed 165 lands near the spec's ≈0.70 / ≈0 / ≈−0.70. */
const OFFSET_SEED = 165;
const OFFSET_SIGMA = 0.05;
const OFFSET_DC = 0.8;
const OFFSET_DIM = 10;
const OFFSET_D = 64;

/**
 * @param {() => number} rng
 * @returns {number}
 */
function gaussian(rng) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * @param {number} seed
 * @returns {[number[], number[]]}
 */
function offsetPair(seed) {
  const rng = createMulberry32(seed);
  const u = new Array(OFFSET_D);
  const v = new Array(OFFSET_D);
  for (let i = 0; i < OFFSET_D; i++) {
    u[i] = gaussian(rng) * OFFSET_SIGMA;
    v[i] = gaussian(rng) * OFFSET_SIGMA;
  }
  u[OFFSET_DIM] += OFFSET_DC;
  v[OFFSET_DIM] += OFFSET_DC;
  return [u, v];
}

/**
 * @param {number} value
 * @returns {number}
 */
function round4(value) {
  return Math.round(value * 10000) / 10000;
}

/**
 * True cosine of the raw vectors (L2 then dot). Independent of the prune operator.
 * @param {ArrayLike<number>} a
 * @param {ArrayLike<number>} b
 * @returns {number}
 */
function rawCosine(a, b) {
  const ua = l2Normalize(a);
  const ub = l2Normalize(b);
  if (!ua || !ub) return 0;
  return cosineDot(ua, ub);
}

const VOID_TAGS = new Set(['input', 'br', 'hr', 'img', 'meta', 'link', 'source', 'wbr']);

/**
 * Enough of a DOM for ComparePanel's innerHTML + querySelector path.
 * @returns {Document}
 */
function createMockDocument() {
  /** @type {any} */
  const doc = {
    body: null,
    createElement(tagName) {
      return createMockElement(doc, tagName);
    },
  };
  doc.body = doc.createElement('body');
  return doc;
}

/**
 * @param {any} doc
 * @param {string} tagName
 */
function createMockElement(doc, tagName) {
  const children = [];
  const attrs = {};
  const classes = new Set();
  const listeners = {};
  let className = '';

  /** @type {any} */
  const el = {
    tagName: String(tagName || 'div').toUpperCase(),
    children,
    parentNode: null,
    ownerDocument: doc,
    style: {},
    id: '',
    type: '',
    value: '',
    disabled: false,
    _text: '',
    classList: {
      add: (...cls) => {
        cls.forEach((c) => { if (c) classes.add(c); });
        className = Array.from(classes).join(' ');
        attrs.class = className;
      },
      remove: (...cls) => {
        cls.forEach((c) => classes.delete(c));
        className = Array.from(classes).join(' ');
        attrs.class = className;
      },
      toggle: (cls, force) => {
        const has = classes.has(cls);
        const next = force === undefined ? !has : Boolean(force);
        if (next) classes.add(cls);
        else classes.delete(cls);
        className = Array.from(classes).join(' ');
        attrs.class = className;
        return classes.has(cls);
      },
      contains: (cls) => classes.has(cls),
    },
    appendChild(child) {
      children.push(child);
      child.parentNode = el;
      return child;
    },
    addEventListener(type, fn) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
    },
    setAttribute(key, value) {
      attrs[key] = String(value);
      if (key === 'id') el.id = String(value);
      if (key === 'class') el.className = String(value);
      if (key === 'type') el.type = String(value);
      if (key === 'value') el.value = String(value);
    },
    getAttribute(key) {
      return attrs[key] !== undefined ? attrs[key] : null;
    },
    removeAttribute(key) {
      delete attrs[key];
    },
    hasAttribute(key) {
      return Object.prototype.hasOwnProperty.call(attrs, key);
    },
    querySelector(selector) {
      return queryAll(el, selector)[0] || null;
    },
    querySelectorAll(selector) {
      return queryAll(el, selector);
    },
    closest(selector) {
      let node = el;
      while (node) {
        if (node.matches && node.matches(selector)) return node;
        node = node.parentNode;
      }
      return null;
    },
    matches(selector) {
      return matchSimple(el, selector);
    },
  };

  Object.defineProperty(el, 'className', {
    get() { return className; },
    set(value) {
      className = String(value || '');
      classes.clear();
      className.split(/\s+/).filter(Boolean).forEach((c) => classes.add(c));
      attrs.class = className;
    },
  });

  Object.defineProperty(el, 'textContent', {
    get() {
      const nested = children.map((child) => child.textContent || '').join('');
      return `${el._text || ''}${nested}`;
    },
    set(value) {
      el._text = String(value ?? '');
      children.length = 0;
    },
  });

  Object.defineProperty(el, 'innerHTML', {
    get() {
      return (el._text || '') + children.map(serialize).join('');
    },
    set(value) {
      el._text = '';
      children.length = 0;
      parseInto(el, String(value ?? ''), doc);
    },
  });

  return el;
}

/**
 * @param {any} el
 * @param {string} selector
 */
function matchSimple(el, selector) {
  const sel = selector.trim();
  if (!sel || !el || el.nodeType === 'text') return false;
  if (sel.startsWith('#')) return el.id === sel.slice(1);
  if (sel.startsWith('.')) return el.classList.contains(sel.slice(1));
  return el.tagName === sel.toUpperCase();
}

/**
 * @param {any} root
 * @param {any[]} out
 */
function collect(root, out) {
  for (const child of root.children || []) {
    out.push(child);
    collect(child, out);
  }
}

/**
 * @param {any} root
 * @param {string} selector
 * @returns {any[]}
 */
function queryAll(root, selector) {
  const parts = String(selector || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return [];

  /**
   * @param {any[]} nodes
   * @param {number} partIdx
   * @returns {any[]}
   */
  function walk(nodes, partIdx) {
    const hits = [];
    for (const node of nodes) {
      const desc = [];
      collect(node, desc);
      for (const candidate of desc) {
        if (!matchSimple(candidate, parts[partIdx])) continue;
        if (partIdx === parts.length - 1) hits.push(candidate);
        else hits.push(...walk([candidate], partIdx + 1));
      }
    }
    return hits;
  }

  return walk([root], 0);
}

/**
 * @param {any} el
 * @returns {string}
 */
function serialize(el) {
  const name = el.tagName.toLowerCase();
  return `<${name}>${el.innerHTML}</${name}>`;
}

/**
 * @param {string} raw
 * @param {any} el
 */
function applyAttrs(raw, el) {
  const re = /([:@\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
  let match = re.exec(raw);
  while (match) {
    const key = match[1];
    const val = match[2] ?? match[3] ?? match[4] ?? '';
    el.setAttribute(key, val);
    match = re.exec(raw);
  }
}

/**
 * @param {any} parent
 * @param {string} html
 * @param {any} doc
 */
function parseInto(parent, html, doc) {
  const stack = [parent];
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9:-]+)\s*>|<([a-zA-Z0-9:-]+)([^>]*?)(\/?)>|([^<]+)/g;
  let match = re.exec(html);
  while (match) {
    if (match[1]) {
      const name = match[1].toUpperCase();
      while (stack.length > 1 && stack[stack.length - 1].tagName !== name) stack.pop();
      if (stack.length > 1) stack.pop();
    } else if (match[2]) {
      const el = doc.createElement(match[2]);
      applyAttrs(match[3] || '', el);
      stack[stack.length - 1].appendChild(el);
      const selfClose = Boolean(match[4]) || VOID_TAGS.has(match[2].toLowerCase());
      if (!selfClose) stack.push(el);
    } else if (match[5]) {
      stack[stack.length - 1]._text += match[5];
    }
    match = re.exec(html);
  }
}

describe('compare cosine noise shield', () => {
  it('test_subspace_cosine_prunes_artificial_offset', () => {
    const [u, v] = offsetPair(OFFSET_SEED);
    const uBefore = u.slice();
    const vBefore = v.slice();
    const raw = rawCosine(u, v);
    const pruned = prunedCosineDot(u, v, [OFFSET_DIM]);
    const delta = pruned - raw;

    expect(raw).toBeCloseTo(0.7206, 3);
    expect(raw).toBeGreaterThan(0.65);
    expect(Math.abs(pruned)).toBeLessThan(0.15);
    expect(pruned).toBeCloseTo(0.0101, 3);
    expect(delta).toBeLessThan(0);
    expect(delta).toBeCloseTo(-0.7104, 3);
    expect(u).toEqual(uBefore);
    expect(v).toEqual(vBefore);
  });

  it('test_prune_operator_never_mutates_source_vectors', () => {
    const u = Array.from({ length: OFFSET_D }, () => 0.01);
    const v = Array.from({ length: OFFSET_D }, () => -0.02);
    u[OFFSET_DIM] = 0.8;
    v[OFFSET_DIM] = 0.8;
    const uBefore = u.slice();
    const vBefore = v.slice();

    const prunedU = prunedL2Normalize(u, [OFFSET_DIM]);
    const prunedV = pruneVector(v, [OFFSET_DIM]);
    prunedCosineDot(u, v, [OFFSET_DIM]);

    expect(u[OFFSET_DIM]).toBe(0.8);
    expect(v[OFFSET_DIM]).toBe(0.8);
    expect(u).toEqual(uBefore);
    expect(v).toEqual(vBefore);
    expect(prunedU).not.toBeNull();
    expect(prunedU[OFFSET_DIM]).toBe(0);
    expect(prunedV).not.toBe(v);
    expect(prunedV[OFFSET_DIM]).toBe(0);
    expect(v[OFFSET_DIM]).toBe(0.8);

    const onlyNoise = [0, 0.8, 0];
    expect(prunedL2Normalize(onlyNoise, [1])).toBeNull();
    expect(prunedCosineDot(onlyNoise, onlyNoise, [1])).toBe(0);
    expect(onlyNoise[1]).toBe(0.8);

    const orthogonal = prunedCosineDot([3, 0], [0, 4], []);
    expect(orthogonal).toBeCloseTo(0, 6);
  });

  it('test_recompute_anchor_scores_with_shield', () => {
    const dim = 16;
    const make = (shift) => {
      const row = new Array(dim);
      for (let i = 0; i < dim; i++) row[i] = Math.sin(i + shift) * 0.2;
      row[5] += 0.9;
      row[12] += 0.7;
      return l2Normalize(row);
    };
    const items = [
      { id: 'tok_0', text: 'ref', embedding: make(1) },
      { id: 'tok_1', text: 'near', embedding: make(2) },
      { id: 'tok_2', text: 'far', embedding: make(3) },
    ];
    const noiseIndices = [5, 12];
    const result = recomputeCompareAnchorScores(items, {
      noiseIndices,
      shieldEnabled: true,
    });

    expect(result.items[0].cosine_vs_first).toBe(1);
    expect(result.items[0].cosine_delta).toBeNull();

    for (const index of [1, 2]) {
      const raw = cosineDot(items[index].embedding, items[0].embedding);
      const pruned = prunedCosineDot(items[index].embedding, items[0].embedding, noiseIndices);
      expect(result.items[index].cosine_vs_first).toBeCloseTo(pruned, 6);
      expect(result.items[index].raw_cosine_vs_first).toBeCloseTo(raw, 6);
      expect(result.items[index].cosine_delta).toBe(round4(pruned - raw));
      expect(result.items[index].cosine_delta).toBeLessThan(0);
      expect(items[index].embedding).toBe(result.items[index].embedding);
    }

    const viaSet = recomputeCompareAnchorScores(items, {
      noiseIndices: new Set(noiseIndices),
      shieldEnabled: true,
    });
    expect(viaSet.items[1].cosine_vs_first).toBeCloseTo(result.items[1].cosine_vs_first, 6);
    expect(viaSet.items[2].cosine_delta).toBe(result.items[2].cosine_delta);

    const disabled = recomputeCompareAnchorScores(items, {
      noiseIndices,
      shieldEnabled: false,
    });
    expect(disabled.items[1].cosine_delta).toBeNull();
    expect(disabled.items[1].cosine_vs_first).toBeCloseTo(
      cosineDot(items[1].embedding, items[0].embedding),
      6,
    );

    const empty = recomputeCompareAnchorScores(items, {
      noiseIndices: [],
      shieldEnabled: true,
    });
    expect(empty.items[1].cosine_delta).toBeNull();
    expect(empty.items[2].cosine_vs_first).toBeCloseTo(
      cosineDot(items[2].embedding, items[0].embedding),
      6,
    );
  });

  it('test_spectral_quorum_noise_shield_exclusion', () => {
    const D = 400;
    const perGroup = 4;
    const items = [];
    for (let i = 0; i < perGroup; i++) {
      const a = new Array(D).fill(0.02);
      const b = new Array(D).fill(0.02);
      a[20] = 0.2 + i * 0.001;
      b[20] = 0.01 + i * 0.001;
      a[386] = 4 + i * 0.0005;
      b[386] = 0.05 + i * 0.0005;
      items.push({ groupId: 'alpha', embedding: a });
      items.push({ groupId: 'beta', embedding: b });
    }

    const open = computeSpectralQuorumMetrics(items, {
      quorumPercent: 10,
      minSeparability: 0.5,
    });
    expect(open).not.toBeNull();
    expect(open.summary.topQuorumDims).toContain(386);
    expect(open.metrics[386].isQuorum).toBe(true);
    expect(open.metrics[20].isQuorum).toBe(true);

    const shielded = computeSpectralQuorumMetrics(items, {
      quorumPercent: 10,
      minSeparability: 0.5,
      noiseIndices: [386],
    });
    expect(shielded).not.toBeNull();
    expect(shielded.summary.validCandidateCount).toBe(D - 1);
    expect(shielded.summary.totalDim).toBe(D);
    expect(shielded.metrics).toHaveLength(D);

    const metric = shielded.metrics[386];
    expect(metric.isNoise).toBe(true);
    expect(metric.noisePruned).toBe(true);
    expect(metric.separability).toBe(0);
    expect(metric.isTrigo).toBe(false);
    expect(metric.isQuorum).toBe(false);

    const signatures = Object.values(metric.groupSignatures);
    expect(signatures.length).toBe(2);
    for (const sig of signatures) {
      expect(sig.isNoise).toBe(true);
      expect(sig.noisePruned).toBe(true);
      expect(sig.separability).toBe(0);
      expect(sig.isTrigo).toBe(false);
      expect(sig.isQuorum).toBe(false);
    }

    expect(shielded.summary.topQuorumDims).not.toContain(386);
    expect(shielded.summary.topQuorumDims).toContain(20);
    for (const group of Object.values(shielded.summary.groupSignatures)) {
      expect(group.quorumDims).not.toContain(386);
    }
  });

  it('test_group_centroid_subspace_pruning', () => {
    const items = [
      { text: 'a', embedding: [1, 0, 0.8], groupId: 'g1', groupLabel: 'g1' },
      { text: 'b', embedding: [1, 0, 0.8], groupId: 'g1', groupLabel: 'g1' },
      { text: 'c', embedding: [0, 1, 0.8], groupId: 'g2', groupLabel: 'g2' },
      { text: 'd', embedding: [0, 1, 0.8], groupId: 'g2', groupLabel: 'g2' },
    ];
    const off = buildGroupCosineRows(items);
    const on = buildGroupCosineRows(items, { shieldEnabled: true, noiseIndices: [2] });
    expect(off.items[0].cosine_delta).toBeNull();
    expect(off.items[1].cosine_delta).toBeNull();
    expect(off.items[1].cosine_vs_first).toBeCloseTo(0.39024392128345653, 5);
    expect(on.items[0].cosine_vs_first).toBe(1);
    expect(on.items[0].cosine_delta).toBeNull();
    expect(on.items[1].cosine_vs_first).toBeCloseTo(0, 6);
    expect(on.items[1].cosine_delta).toBe(-0.3902);
  });

  describe('test_compare_panel_delta_badge_dom', () => {
    let prevDocument;
    let prevStorage;

    beforeEach(() => {
      prevDocument = global.document;
      prevStorage = global.localStorage;
      global.document = createMockDocument();
      const mem = new Map();
      global.localStorage = {
        getItem: (key) => (mem.has(key) ? mem.get(key) : null),
        setItem: (key, value) => mem.set(key, String(value)),
        removeItem: (key) => mem.delete(key),
        key: (index) => Array.from(mem.keys())[index] ?? null,
        get length() { return mem.size; },
      };
    });

    afterEach(() => {
      global.document = prevDocument;
      global.localStorage = prevStorage;
    });

    it('renders a signed delta badge on non-anchor rows', () => {
      const D = 400;
      const rawA = new Float32Array(D);
      const rawB = new Float32Array(D);
      rawA[0] = 10;
      rawB[0] = 10;
      rawB[1] = 29;
      rawA[297] = 6;
      rawB[297] = 6;
      rawA[386] = 6;
      rawB[386] = 6;
      const anchorEmb = l2Normalize(rawA);
      const otherEmb = l2Normalize(rawB);

      const panel = new ComparePanel(document.createElement('div'), () => {});
      panel.setNoiseShieldConfig({ enabled: true, noiseIndices: [386, 297] });
      panel.updateCompareResults({
        count: 2,
        anchor: { index: 0, text: 'ref' },
        items: [
          { id: 'tok_0', text: 'ref', embedding: anchorEmb },
          { id: 'tok_1', text: 'other', embedding: otherEmb },
        ],
      });

      const rows = panel.cosineList.querySelectorAll('.compare-cosine-item');
      expect(rows).toHaveLength(2);
      expect(rows[0].querySelector('.score-delta')).toBeNull();
      expect(rows[0].querySelector('.badge-ref')).not.toBeNull();

      const badge = rows[1].querySelector('.score-delta');
      expect(badge).not.toBeNull();
      expect(badge.textContent.trim()).toBe('(-0.0861)');
      expect(badge.classList.contains('drop')).toBe(true);
      expect(badge.getAttribute('title')).toBe('Cosine change under Outlier Shield');

      const chrome = readFileSync(resolve(process.cwd(), 'src/theme/chrome.css'), 'utf8');
      expect(chrome).toMatch(/\.score-delta\s*\{[^}]*font-size:\s*11px/s);
      expect(chrome).toMatch(/\.score-delta\.drop\s*\{[^}]*var\(--badge-sat,\s*#FFA997\)/s);
      expect(chrome).toMatch(/\.score-delta\.rise\s*\{[^}]*#00E5FF/s);
    });
  });
});
