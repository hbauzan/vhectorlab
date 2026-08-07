import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ARITHMETIC_TOP10_SCROLL,
  RESULTS_LIST_MIN_PX,
  resolveResultsListMaxHeightPx,
  shouldScrollArithmeticPanel,
} from '../src/ui/arithmeticResultsScroll.js';
import { MOBILE_MQ } from '../src/ui/CollapsibleDock.js';
import { Sidebar } from '../src/ui/Sidebar.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'src/style.css'), 'utf8');

describe('resolveResultsListMaxHeightPx — feedback loop', () => {
  it('never collapses below the floor on short phone landscape', () => {
    // iPhone-class landscape ~844×390
    const h = resolveResultsListMaxHeightPx({ width: 844, height: 390 }, { isMobile: true });
    expect(h).toBeGreaterThanOrEqual(RESULTS_LIST_MIN_PX);
    expect(h).toBeLessThanOrEqual(200);
  });

  it('never collapses when desktop vh is below the old 380px magic offset', () => {
    const h = resolveResultsListMaxHeightPx({ width: 1280, height: 360 }, { isMobile: false });
    expect(h).toBeGreaterThanOrEqual(RESULTS_LIST_MIN_PX);
  });

  it('caps at desktop/mobile ceilings on tall screens', () => {
    expect(resolveResultsListMaxHeightPx({ width: 1440, height: 900 }, { isMobile: false })).toBe(280);
    expect(resolveResultsListMaxHeightPx({ width: 390, height: 844 }, { isMobile: true })).toBe(200);
  });
});

describe('shouldScrollArithmeticPanel', () => {
  it('switches to panel scroll on short viewports (landscape phone)', () => {
    expect(shouldScrollArithmeticPanel({ height: 390 })).toBe(true);
    expect(shouldScrollArithmeticPanel({ height: 844 })).toBe(false);
    expect(shouldScrollArithmeticPanel({ height: 560 })).toBe(true);
    expect(shouldScrollArithmeticPanel({ height: 561 })).toBe(false);
  });
});

describe('ARITHMETIC_TOP10_SCROLL CSS contract', () => {
  it('keeps floored max-height expressions in CSS', () => {
    expect(css).toContain(ARITHMETIC_TOP10_SCROLL.desktopMaxHeight);
    expect(css).toContain(ARITHMETIC_TOP10_SCROLL.mobileMaxHeight);
    expect(css).toContain('@media (max-height: 560px)');
    expect(css).toMatch(/#sidebar-panel\s+\.results-list\s*\{[^}]*overflow-y:\s*auto/s);
  });

  it('mobile MQ includes short landscape phones (hover:none)', () => {
    expect(MOBILE_MQ).toContain('max-height: 500px');
    expect(MOBILE_MQ).toContain('hover: none');
    expect(css).toContain('(max-height: 500px) and (hover: none)');
  });
});

describe('Sidebar Top-10 markup', () => {
  function createMockElement(tagName = 'div') {
    const children = [];
    const classList = new Set();
    let _className = '';
    let _innerHTML = '';
    const el = {
      tagName: tagName.toUpperCase(),
      children,
      classList: {
        add: (c) => { classList.add(c); _className = [...classList].join(' '); },
        contains: (c) => classList.has(c),
      },
      appendChild: (child) => { children.push(child); return child; },
      querySelector: (sel) => {
        const clean = sel.replace('#', '').replace('.', '');
        for (const child of children) {
          if (child.id === clean || child.classList?.contains?.(clean)) return child;
          const found = child.querySelector?.(sel);
          if (found) return found;
        }
        return null;
      },
      addEventListener: () => {},
      set innerHTML(val) {
        _innerHTML = String(val);
        if (_innerHTML.includes('results-list')) {
          const ul = createMockElement('ul');
          ul.id = 'results-list';
          ul.className = 'results-list';
          el.appendChild(ul);
          const form = createMockElement('form');
          form.id = 'arithmetic-form';
          el.appendChild(form);
          const btn = createMockElement('button');
          btn.id = 'btn-calculate';
          el.appendChild(btn);
        }
      },
      get innerHTML() { return _innerHTML; },
      set className(val) {
        _className = val || '';
        classList.clear();
        String(val).split(/\s+/).forEach((c) => { if (c) classList.add(c); });
      },
      get className() { return _className; },
      id: '',
      textContent: '',
    };
    return el;
  }

  if (typeof global.document === 'undefined') {
    global.document = {
      createElement: (tag) => createMockElement(tag),
      body: createMockElement('body'),
    };
  }

  it('mounts a results-list for Top-10 neighbors', () => {
    const parent = createMockElement('div');
    const sidebar = new Sidebar(parent, async () => {});
    expect(sidebar.resultsList).not.toBeNull();
    expect(sidebar.resultsList.id).toBe('results-list');
    expect(String(sidebar.element.innerHTML)).toContain('results-list');
  });
});
