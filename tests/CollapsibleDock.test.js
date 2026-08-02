import { describe, it, expect, beforeEach } from 'vitest';
import {
  CollapsibleDock,
  readCollapsedPreference,
  writeCollapsedPreference,
  tabGlyphFor,
  tabLabelFor,
  isMobileViewport,
} from '../src/ui/CollapsibleDock.js';

function createMockElement(tagName = 'div') {
  const children = [];
  const attrs = {};
  const classList = new Set();
  let _className = '';
  let _textContent = '';
  let _innerHTML = '';

  const element = {
    tagName: tagName.toUpperCase(),
    children,
    parentNode: null,
    style: {},
    dataset: {},
    classList: {
      add: (...cls) => {
        cls.forEach((c) => { if (c) classList.add(c); });
        _className = Array.from(classList).join(' ');
      },
      remove: (...cls) => {
        cls.forEach((c) => classList.delete(c));
        _className = Array.from(classList).join(' ');
      },
      toggle: (cls, force) => {
        if (force === true) classList.add(cls);
        else if (force === false) classList.delete(cls);
        else if (classList.has(cls)) classList.delete(cls);
        else classList.add(cls);
        _className = Array.from(classList).join(' ');
        return classList.has(cls);
      },
      contains: (cls) => classList.has(cls),
    },
    appendChild: (child) => {
      children.push(child);
      child.parentNode = element;
      return child;
    },
    removeChild: (child) => {
      const i = children.indexOf(child);
      if (i >= 0) children.splice(i, 1);
      child.parentNode = null;
      return child;
    },
    addEventListener: (type, fn) => {
      if (!element._listeners) element._listeners = {};
      if (!element._listeners[type]) element._listeners[type] = [];
      element._listeners[type].push(fn);
    },
    removeEventListener: (type, fn) => {
      if (!element._listeners || !element._listeners[type]) return;
      element._listeners[type] = element._listeners[type].filter((f) => f !== fn);
    },
    click: () => {
      (element._listeners?.click || []).forEach((fn) => fn({ type: 'click' }));
    },
    setAttribute: (k, v) => { attrs[k] = String(v); },
    getAttribute: (k) => (attrs[k] !== undefined ? attrs[k] : null),
    querySelector: (selector) => {
      const id = selector.startsWith('#') ? selector.slice(1) : null;
      const cls = selector.startsWith('.') ? selector.slice(1) : null;
      for (const child of children) {
        if (id && child.id === id) return child;
        if (cls && child.classList.contains(cls)) return child;
        const found = child.querySelector ? child.querySelector(selector) : null;
        if (found) return found;
      }
      return null;
    },
    set innerHTML(val) {
      _innerHTML = val;
      if (val === '') children.length = 0;
    },
    get innerHTML() {
      return _innerHTML;
    },
    set className(val) {
      classList.clear();
      _className = val || '';
      String(val).split(/\s+/).forEach((c) => { if (c) classList.add(c); });
    },
    get className() {
      return _className;
    },
    set textContent(val) {
      _textContent = val == null ? '' : String(val);
    },
    get textContent() {
      return _textContent;
    },
    id: '',
    type: '',
  };
  return element;
}

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => map.clear(),
    _map: map,
  };
}

const mockDoc = {
  createElement: (tagName) => {
    const el = createMockElement(tagName);
    if (tagName === 'button') el.type = 'button';
    return el;
  },
};

describe('collapsed preference helpers', () => {
  it('reads desktop stored value; defaults when missing', () => {
    const storage = createMemoryStorage();
    expect(readCollapsedPreference(storage, 'k', { isMobile: false, defaultCollapsed: false })).toBe(false);
    storage.setItem('k', '1');
    expect(readCollapsedPreference(storage, 'k', { isMobile: false })).toBe(true);
    storage.setItem('k', '0');
    expect(readCollapsedPreference(storage, 'k', { isMobile: false })).toBe(false);
  });

  it('mobile always returns collapsed and skips writes (D4 hook)', () => {
    const storage = createMemoryStorage();
    storage.setItem('k', '0');
    expect(readCollapsedPreference(storage, 'k', { isMobile: true, defaultCollapsed: false })).toBe(true);
    writeCollapsedPreference(storage, 'k', false, { isMobile: true });
    expect(storage.getItem('k')).toBe('0');
  });

  it('writes desktop preference as 1/0', () => {
    const storage = createMemoryStorage();
    writeCollapsedPreference(storage, 'k', true, { isMobile: false });
    expect(storage.getItem('k')).toBe('1');
    writeCollapsedPreference(storage, 'k', false, { isMobile: false });
    expect(storage.getItem('k')).toBe('0');
  });
});

describe('tab glyphs / labels', () => {
  it('left collapsed shows ▶; expanded ◀', () => {
    expect(tabGlyphFor('left', true)).toBe('▶');
    expect(tabGlyphFor('left', false)).toBe('◀');
  });

  it('right collapsed shows ◀; expanded ▶', () => {
    expect(tabGlyphFor('right', true)).toBe('◀');
    expect(tabGlyphFor('right', false)).toBe('▶');
  });

  it('aria labels flip with collapsed state', () => {
    expect(tabLabelFor('left', true)).toMatch(/Expand/i);
    expect(tabLabelFor('left', false)).toMatch(/Collapse/i);
  });
});

describe('isMobileViewport', () => {
  it('uses max-width 768px media query', () => {
    expect(isMobileViewport(() => ({ matches: true }))).toBe(true);
    expect(isMobileViewport(() => ({ matches: false }))).toBe(false);
    expect(isMobileViewport(undefined)).toBe(false);
  });
});

describe('CollapsibleDock', () => {
  let parent;
  let storage;

  beforeEach(() => {
    parent = createMockElement('div');
    storage = createMemoryStorage();
  });

  function makeDock(overrides = {}) {
    return new CollapsibleDock({
      parent,
      side: 'left',
      id: 'left-dock',
      storageKey: 'vl3d.dock.left.collapsed',
      storage,
      isMobile: () => false,
      doc: mockDoc,
      ...overrides,
    });
  }

  it('mounts body + tab without unmounting children on toggle', () => {
    const dock = makeDock();
    const panel = createMockElement('div');
    panel.id = 'sidebar-panel';
    dock.body.appendChild(panel);

    expect(parent.children).toContain(dock.root);
    expect(dock.tab.getAttribute('aria-expanded')).toBe('true');
    expect(dock.isCollapsed).toBe(false);

    dock.toggle();
    expect(dock.isCollapsed).toBe(true);
    expect(dock.root.classList.contains('is-collapsed')).toBe(true);
    expect(dock.tab.getAttribute('aria-expanded')).toBe('false');
    expect(dock.tab.textContent).toBe('▶');
    expect(dock.body.children).toContain(panel);

    dock.toggle();
    expect(dock.isCollapsed).toBe(false);
    expect(dock.tab.getAttribute('aria-expanded')).toBe('true');
    expect(dock.body.children).toContain(panel);
  });

  it('tab click toggles collapsed state', () => {
    const dock = makeDock({ side: 'right', id: 'right-dock', storageKey: 'vl3d.dock.right.collapsed' });
    expect(dock.isCollapsed).toBe(false);
    dock.tab.click();
    expect(dock.isCollapsed).toBe(true);
    expect(dock.tab.textContent).toBe('◀');
    dock.tab.click();
    expect(dock.isCollapsed).toBe(false);
  });

  it('persists desktop collapsed to localStorage', () => {
    const dock = makeDock();
    dock.setCollapsed(true);
    expect(storage.getItem('vl3d.dock.left.collapsed')).toBe('1');

    const dock2 = makeDock({ id: 'left-dock-2' });
    expect(dock2.isCollapsed).toBe(true);
    expect(dock2.tab.getAttribute('aria-expanded')).toBe('false');
  });

  it('MODE policy: shared left collapsed flag survives re-host (Arithmetic↔Compare)', () => {
    const dock = makeDock();
    const arithmetic = createMockElement('div');
    arithmetic.id = 'sidebar-panel';
    const compare = createMockElement('div');
    compare.id = 'compare-panel';
    compare.classList.add('hidden');
    dock.body.appendChild(arithmetic);
    dock.body.appendChild(compare);

    dock.setCollapsed(true);

    // Simulate MODE switch: hide arithmetic, show compare — dock flag untouched
    arithmetic.classList.add('hidden');
    compare.classList.remove('hidden');

    expect(dock.isCollapsed).toBe(true);
    expect(dock.root.classList.contains('is-collapsed')).toBe(true);
    expect(storage.getItem('vl3d.dock.left.collapsed')).toBe('1');
    expect(dock.body.children).toEqual([arithmetic, compare]);
  });

  it('mobile probe forces initial collapsed and does not persist toggle', () => {
    const dock = makeDock({
      isMobile: () => true,
      defaultCollapsed: false,
    });
    expect(dock.isCollapsed).toBe(true);
    dock.setCollapsed(false);
    expect(storage.getItem('vl3d.dock.left.collapsed')).toBeNull();
  });
});
