import { describe, it, expect, beforeEach } from 'vitest';
import {
  isPhonePortrait,
  shouldShowLandscapeGate,
  wasLandscapeGateDismissed,
  dismissLandscapeGate,
  LandscapeGate,
  LANDSCAPE_DISMISS_KEY,
} from '../src/ui/LandscapeGate.js';

function createMockElement(tagName = 'div') {
  const children = [];
  const attrs = {};
  const classList = new Set();
  let _className = '';
  let _textContent = '';

  const element = {
    tagName: tagName.toUpperCase(),
    children,
    parentNode: null,
    style: {},
    dataset: {},
    classList: {
      add: (...cls) => { cls.forEach((c) => c && classList.add(c)); _className = Array.from(classList).join(' '); },
      remove: (...cls) => { cls.forEach((c) => classList.delete(c)); _className = Array.from(classList).join(' '); },
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
    appendChild: (child) => { children.push(child); child.parentNode = element; return child; },
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
      if (!element._listeners?.[type]) return;
      element._listeners[type] = element._listeners[type].filter((f) => f !== fn);
    },
    click: () => { (element._listeners?.click || []).forEach((fn) => fn({ type: 'click', target: element })); },
    setAttribute: (k, v) => { attrs[k] = String(v); },
    getAttribute: (k) => (attrs[k] !== undefined ? attrs[k] : null),
    querySelector: (selector) => {
      const cls = selector.startsWith('.') ? selector.slice(1) : null;
      const id = selector.startsWith('#') ? selector.slice(1) : null;
      for (const child of children) {
        if (id && child.id === id) return child;
        if (cls && child.classList.contains(cls)) return child;
        const found = child.querySelector?.(selector);
        if (found) return found;
      }
      return null;
    },
    set innerHTML(val) {
      if (val === '') children.length = 0;
      // Minimal: create dismiss button child for LandscapeGate markup
      if (String(val).includes('landscape-gate-dismiss')) {
        const btn = createMockElement('button');
        btn.className = 'btn-primary landscape-gate-dismiss';
        element.appendChild(btn);
        const card = createMockElement('div');
        card.className = 'landscape-gate-card';
        element.appendChild(card);
      }
    },
    set className(val) {
      classList.clear();
      _className = val || '';
      String(val).split(/\s+/).forEach((c) => { if (c) classList.add(c); });
    },
    get className() { return _className; },
    set textContent(val) { _textContent = val == null ? '' : String(val); },
    get textContent() { return _textContent; },
    id: '',
    type: '',
  };
  return element;
}

function memorySession() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

const mockDoc = {
  createElement: (tag) => {
    const el = createMockElement(tag);
    if (tag === 'button') el.type = 'button';
    return el;
  },
};

describe('isPhonePortrait', () => {
  it('true only for phone-width portrait', () => {
    expect(isPhonePortrait(() => ({ width: 390, height: 844 }))).toBe(true);
    expect(isPhonePortrait(() => ({ width: 844, height: 390 }))).toBe(false);
    expect(isPhonePortrait(() => ({ width: 1024, height: 1366 }))).toBe(false);
  });
});

describe('shouldShowLandscapeGate', () => {
  it('shows only for mobile portrait not yet dismissed', () => {
    expect(shouldShowLandscapeGate({ isMobile: true, isPortrait: true, dismissed: false })).toBe(true);
    expect(shouldShowLandscapeGate({ isMobile: true, isPortrait: true, dismissed: true })).toBe(false);
    expect(shouldShowLandscapeGate({ isMobile: true, isPortrait: false, dismissed: false })).toBe(false);
    expect(shouldShowLandscapeGate({ isMobile: false, isPortrait: true, dismissed: false })).toBe(false);
  });
});

describe('session dismiss', () => {
  it('persists dismiss flag in sessionStorage', () => {
    const session = memorySession();
    expect(wasLandscapeGateDismissed(session)).toBe(false);
    dismissLandscapeGate(session);
    expect(session.getItem(LANDSCAPE_DISMISS_KEY)).toBe('1');
    expect(wasLandscapeGateDismissed(session)).toBe(true);
  });
});

describe('LandscapeGate', () => {
  let parent;
  let session;

  beforeEach(() => {
    parent = createMockElement('div');
    session = memorySession();
  });

  it('shows overlay in phone portrait and dismisses without trapping', () => {
    const gate = new LandscapeGate({
      parent,
      doc: mockDoc,
      sessionStorage: session,
      isMobile: () => true,
      isPortrait: () => true,
    });

    expect(gate.isVisible).toBe(true);
    gate._dismissBtn.click();
    expect(gate.isVisible).toBe(false);
    expect(wasLandscapeGateDismissed(session)).toBe(true);

    gate.refresh();
    expect(gate.isVisible).toBe(false);
  });

  it('stays hidden on tablet/desktop and landscape phone', () => {
    const desktop = new LandscapeGate({
      parent,
      doc: mockDoc,
      sessionStorage: session,
      isMobile: () => false,
      isPortrait: () => true,
    });
    expect(desktop.isVisible).toBe(false);

    const landscape = new LandscapeGate({
      parent: createMockElement('div'),
      doc: mockDoc,
      sessionStorage: memorySession(),
      isMobile: () => true,
      isPortrait: () => false,
    });
    expect(landscape.isVisible).toBe(false);
  });
});
