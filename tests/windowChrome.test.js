import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CollapsibleDock } from '../src/ui/CollapsibleDock.js';
import { ComparePanel } from '../src/ui/ComparePanel.js';
import { Sidebar } from '../src/ui/Sidebar.js';
import { threadSlidersMarkup, wireThreadSliders } from '../src/ui/ThreadSliders.js';
import {
  visualizationControlsMarkup,
  wireVisualizationControls,
} from '../src/ui/VisualizationControls.js';
import { DEFAULT_VISUALIZATION_SETTINGS } from '../src/ui/visualizationControlsDefaults.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const chromeCss = readFileSync(join(root, 'src/theme/chrome.css'), 'utf8');

const VOID_TAGS = new Set(['input', 'br', 'hr', 'img', 'meta', 'link', 'source', 'wbr']);

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  };
}

function matchAttr(el, raw) {
  const eq = raw.indexOf('=');
  if (eq === -1) return el.hasAttribute(raw.trim());
  const name = raw.slice(0, eq).trim();
  let value = raw.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return el.getAttribute(name) === value;
}

function matchSimple(el, selector) {
  const sel = String(selector || '').trim();
  if (!sel || !el || el.nodeType === 'text') return false;
  let i = 0;
  let saw = false;
  while (i < sel.length) {
    const ch = sel[i];
    if (ch === '#') {
      const m = sel.slice(i + 1).match(/^([A-Za-z0-9_-]+)/);
      if (!m || el.id !== m[1]) return false;
      i += 1 + m[1].length;
      saw = true;
      continue;
    }
    if (ch === '.') {
      const m = sel.slice(i + 1).match(/^([A-Za-z0-9_-]+)/);
      if (!m || !el.classList.contains(m[1])) return false;
      i += 1 + m[1].length;
      saw = true;
      continue;
    }
    if (ch === '[') {
      const end = sel.indexOf(']', i);
      if (end < 0 || !matchAttr(el, sel.slice(i + 1, end))) return false;
      i = end + 1;
      saw = true;
      continue;
    }
    const m = sel.slice(i).match(/^([A-Za-z][A-Za-z0-9:-]*)/);
    if (!m || el.tagName !== m[1].toUpperCase()) return false;
    i += m[1].length;
    saw = true;
  }
  return saw;
}

function collect(node, out) {
  for (const child of node.children || []) {
    out.push(child);
    collect(child, out);
  }
}

function queryAll(rootEl, selector) {
  const parts = String(selector || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return [];

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

  return walk([rootEl], 0);
}

function createDocument() {
  const doc = {
    createElement(tagName) {
      return createElement(doc, tagName);
    },
  };
  doc.body = doc.createElement('body');
  return doc;
}

function createElement(doc, tagName) {
  const children = [];
  const attrs = {};
  const classes = new Set();
  const listeners = {};
  let className = '';
  const style = {
    setProperty(name, value) { style[name] = String(value); },
    removeProperty(name) { delete style[name]; },
  };

  const el = {
    tagName: String(tagName || 'div').toUpperCase(),
    children,
    parentNode: null,
    ownerDocument: doc,
    style,
    dataset: {},
    id: '',
    type: '',
    value: '',
    disabled: false,
    checked: false,
    hidden: false,
    _text: '',
    classList: {
      add(...cls) {
        cls.forEach((c) => { if (c) classes.add(c); });
        className = Array.from(classes).join(' ');
        attrs.class = className;
      },
      remove(...cls) {
        cls.forEach((c) => classes.delete(c));
        className = Array.from(classes).join(' ');
        attrs.class = className;
      },
      toggle(cls, force) {
        const has = classes.has(cls);
        const next = force === undefined ? !has : Boolean(force);
        if (next) classes.add(cls);
        else classes.delete(cls);
        className = Array.from(classes).join(' ');
        attrs.class = className;
        return next;
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
    removeEventListener(type, fn) {
      if (!listeners[type]) return;
      listeners[type] = listeners[type].filter((item) => item !== fn);
    },
    setAttribute(key, value) {
      attrs[key] = String(value);
      if (key === 'id') el.id = String(value);
      if (key === 'class') el.className = String(value);
      if (key === 'type') el.type = String(value);
      if (key === 'value') el.value = String(value);
      if (key === 'checked') el.checked = true;
      if (key === 'hidden') el.hidden = true;
    },
    getAttribute(key) {
      return attrs[key] !== undefined ? attrs[key] : null;
    },
    removeAttribute(key) {
      delete attrs[key];
      if (key === 'hidden') el.hidden = false;
      if (key === 'checked') el.checked = false;
    },
    hasAttribute(key) {
      return Object.prototype.hasOwnProperty.call(attrs, key);
    },
    toggleAttribute(name, force) {
      const has = el.hasAttribute(name);
      const next = force === undefined ? !has : Boolean(force);
      if (next) el.setAttribute(name, '');
      else el.removeAttribute(name);
      return next;
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
    click() {
      const event = {
        type: 'click',
        target: el,
        currentTarget: el,
        preventDefault() {},
        stopPropagation() {},
      };
      for (const fn of listeners.click || []) fn(event);
    },
    get firstElementChild() {
      return children[0] || null;
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

function serialize(el) {
  const name = el.tagName.toLowerCase();
  return `<${name}>${el.innerHTML}</${name}>`;
}

function applyAttrs(raw, el) {
  const re = /([:@\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
  let match = re.exec(raw);
  while (match) {
    const key = match[1];
    const val = match[2] ?? match[3] ?? match[4] ?? '';
    if (key) el.setAttribute(key, val);
    match = re.exec(raw);
  }
}

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
    } else if (match[5] && stack[stack.length - 1]._text != null) {
      stack[stack.length - 1]._text += match[5];
    }
    match = re.exec(html);
  }
}

function mountDock(side) {
  return new CollapsibleDock({
    parent: document.body,
    side,
    id: side === 'left' ? 'left-dock' : 'right-dock',
    storageKey: `test.dock.${side}`,
    storage: memoryStorage(),
    defaultCollapsed: false,
    isMobile: () => false,
    doc: document,
  });
}

function titlebarOf(root) {
  return root.querySelector('.amiga-window-titlebar');
}

function gadgetsOf(root) {
  const bar = titlebarOf(root);
  return bar ? bar.querySelectorAll('.amiga-window-gadget') : [];
}

function expectWindowChrome(root, title) {
  expect(root.classList.contains('amiga-window')).toBe(true);
  const bar = titlebarOf(root);
  expect(bar).not.toBeNull();
  expect(bar.querySelector('.amiga-window-title').textContent.trim()).toBe(title);
  expect(bar.textContent).not.toMatch(/⚡|🔍|📐/);
  const gadgets = gadgetsOf(root);
  expect(gadgets).toHaveLength(2);
  expect(gadgets[0].getAttribute('data-gadget')).toBe('close');
  expect(gadgets[1].getAttribute('data-gadget')).toBe('depth');
  expect(gadgets[0].getAttribute('type')).toBe('button');
  expect(gadgets[1].getAttribute('type')).toBe('button');
  expect(gadgets[0].querySelector('.gadget-inner-square')).not.toBeNull();
  expect(gadgets[1].querySelector('.gadget-inner-square')).not.toBeNull();
}

describe('Workbench window chassis contract', () => {
  it('defines a raised .amiga-window distinct from the engine-only titlebar', () => {
    const chassis = chromeCss.match(/\.amiga-window\s*\{([^}]*)\}/);
    expect(chassis, 'missing .amiga-window rule').not.toBeNull();
    const body = chassis[1];
    expect(body).toContain('border-top: 2px solid #FFFFFF');
    expect(body).toContain('border-left: 2px solid #FFFFFF');
    expect(body).toContain('border-right: 2px solid #000000');
    expect(body).toContain('border-bottom: 2px solid #000000');
    expect(body).toContain('box-shadow: 2px 2px 0 #000000');

    const titlebar = chromeCss.match(
      /\.amiga-window\s*>\s*\.amiga-window-titlebar\s*\{([^}]*)\}/,
    );
    expect(titlebar, 'missing canonical titlebar rule').not.toBeNull();
    const bar = titlebar[1];
    expect(bar).toContain('background: #3B67A2');
    expect(bar).toContain('color: #FFFFFF');
    expect(bar).toContain('height: 24px');
    expect(bar).toContain('font-size: 12px');
    expect(bar).toContain('font-weight: 700');
    expect(bar).toContain('text-transform: uppercase');
    expect(bar).toContain('var(--amiga-font)');
    expect(bar).toContain('border-bottom: 2px solid #000000');
  });
});

describe('four panels mount the canonical window', () => {
  let previousDocument;

  beforeEach(() => {
    previousDocument = globalThis.document;
    globalThis.document = createDocument();
  });

  afterEach(() => {
    globalThis.document = previousDocument;
  });

  it('ARITHMETIC close gadget toggles the left dock; depth does not', () => {
    const dock = mountDock('left');
    const sidebar = new Sidebar(dock.body, async () => {});
    expectWindowChrome(sidebar.element, 'ARITHMETIC');
    expect(sidebar.element.innerHTML).not.toContain('VECTOR ARITHMETIC');
    expect(dock.isCollapsed).toBe(false);

    sidebar.element.querySelector('[data-gadget="depth"]').click();
    expect(dock.isCollapsed).toBe(false);

    sidebar.element.querySelector('[data-gadget="close"]').click();
    expect(dock.isCollapsed).toBe(true);
    expect(dock.root.classList.contains('is-collapsed')).toBe(true);
    expect(dock.tab.getAttribute('aria-expanded')).toBe('false');

    sidebar.element.querySelector('[data-gadget="close"]').click();
    expect(dock.isCollapsed).toBe(false);
    expect(dock.tab.getAttribute('aria-expanded')).toBe('true');
  });

  it('close gadget without a dock does not throw and does not invent a host', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const sidebar = new Sidebar(parent, async () => {});
    expectWindowChrome(sidebar.element, 'ARITHMETIC');
    expect(() => sidebar.element.querySelector('[data-gadget="close"]').click()).not.toThrow();
    expect(sidebar.element.closest('.collapsible-dock')).toBeNull();
  });

  it('TOKEN COMPARISON close gadget collapses the left dock', () => {
    const dock = mountDock('left');
    const settings = {};
    const panel = new ComparePanel(dock.body, () => {}, null, {
      getSaeSettings: () => settings,
      setSaeSettings: (next) => Object.assign(settings, next),
    });
    expectWindowChrome(panel.element, 'TOKEN COMPARISON');
    expect(panel.element.innerHTML).not.toContain('TOKEN COMPARISON</h2>');
    expect(panel.element.querySelector('.sidebar-header')).toBeNull();

    panel.element.querySelector('[data-gadget="close"]').click();
    expect(dock.isCollapsed).toBe(true);
    expect(dock.tab.getAttribute('aria-expanded')).toBe('false');
  });

  it('SPATIAL CONTROLS close gadget collapses the right dock and leaves slider values', () => {
    const dock = mountDock('right');
    const host = document.createElement('div');
    host.innerHTML = threadSlidersMarkup();
    const sliders = host.firstElementChild;
    dock.body.appendChild(sliders);
    const config = {
      threadSpacing: 0.4,
      threadVectorDistance: 10,
      threadAmplitudeY: 7,
      threadWidth: 0.2,
      threadThickness: 0.05,
    };
    wireThreadSliders(sliders, null, config, null, {
      getContext: () => ({ workspaceMode: 'ARITHMETIC', viewMode: 'ANALYSIS', renderMode: 'POINTS' }),
    });

    expectWindowChrome(sliders, 'SPATIAL CONTROLS');
    expect(threadSlidersMarkup()).not.toContain('3D Spatial Controls');
    expect(threadSlidersMarkup()).not.toContain('📐');

    sliders.querySelector('[data-gadget="close"]').click();
    expect(dock.isCollapsed).toBe(true);
    expect(config.threadAmplitudeY).toBe(7);
    expect(config.threadSpacing).toBe(0.4);
  });

  it('VISUALIZATION close gadget toggles the sheet the same way as its tab', () => {
    const host = document.createElement('div');
    host.innerHTML = visualizationControlsMarkup(DEFAULT_VISUALIZATION_SETTINGS, {
      collapsed: false,
      layout: 'edge',
    });
    const sheet = host.firstElementChild;
    document.body.appendChild(sheet);
    const config = { ...DEFAULT_VISUALIZATION_SETTINGS };
    wireVisualizationControls(sheet, config, () => {}, {
      storage: memoryStorage(),
      isMobile: () => false,
    });

    const body = sheet.querySelector('.viz-panel-body');
    expectWindowChrome(body, 'VISUALIZATION');
    expect(sheet.classList.contains('is-collapsed')).toBe(false);

    body.querySelector('[data-gadget="depth"]').click();
    expect(sheet.classList.contains('is-collapsed')).toBe(false);

    body.querySelector('[data-gadget="close"]').click();
    expect(sheet.classList.contains('is-collapsed')).toBe(true);
    expect(sheet.querySelector('.viz-panel-tab').getAttribute('aria-expanded')).toBe('false');
    expect(sheet.querySelector('.viz-panel-tab').textContent).toBe('▲');

    body.querySelector('[data-gadget="close"]').click();
    expect(sheet.classList.contains('is-collapsed')).toBe(false);
    expect(sheet.querySelector('.viz-panel-tab').textContent).toBe('▼');
  });
});
