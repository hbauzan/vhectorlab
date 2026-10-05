import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { APP_VERSION, Navbar } from '../src/ui/Navbar.js';
import packageJson from '../package.json';

describe('Navbar version tag', () => {
  let origDoc;

  beforeEach(() => {
    origDoc = global.document;
    global.document = {
      createElement: (tag) => {
        const el = {
          tagName: tag.toUpperCase(),
          className: '',
          id: '',
          innerHTML: '',
          children: [],
          appendChild: (c) => el.children.push(c),
          addEventListener: () => {},
          querySelectorAll: () => [],
          querySelector: (sel) => {
            if (sel === '.version-tag') {
              const match = el.innerHTML.match(/<span class="version-tag">([^<]+)<\/span>/);
              return match ? { textContent: match[1] } : null;
            }
            return null;
          },
        };
        return el;
      },
      body: {},
    };
  });

  afterEach(() => {
    global.document = origDoc;
  });

  it('matches package.json version with v prefix', () => {
    expect(APP_VERSION).toBe(`v${packageJson.version}`);
    expect(APP_VERSION).toBe('v3.4.0');
  });

  it('renders exact APP_VERSION in the header version-tag span', () => {
    const container = document.createElement('div');
    const navbar = new Navbar(container, () => {}, () => {}, () => {}, () => {});
    const tag = navbar.element.querySelector('.version-tag');
    expect(tag).not.toBeNull();
    expect(tag.textContent).toBe(`v${packageJson.version}`);
    expect(tag.textContent).toBe('v3.4.0');
  });
});
