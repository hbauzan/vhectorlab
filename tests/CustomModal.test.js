import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CustomModal } from '../src/ui/CustomModal.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const chromeCss = readFileSync(join(root, 'src/theme/chrome.css'), 'utf8');

function declarationBlocks(css) {
  const blocks = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match = re.exec(css);
  while (match) {
    blocks.push({ selector: match[1], body: match[2] });
    match = re.exec(css);
  }
  return blocks;
}

function createElement(doc, tagName) {
  const attrs = {};
  const classes = new Set();
  const listeners = {};
  const children = [];
  let className = '';
  const el = {
    tagName: String(tagName || 'div').toUpperCase(),
    children,
    id: '',
    hidden: false,
    _text: '',
    _byId: {},
    classList: {
      add(...cls) {
        cls.forEach((c) => { if (c) classes.add(c); });
        className = [...classes].join(' ');
      },
      remove(...cls) {
        cls.forEach((c) => classes.delete(c));
        className = [...classes].join(' ');
      },
      contains: (c) => classes.has(c),
    },
    setAttribute(key, value) {
      attrs[key] = String(value);
      if (key === 'id') el.id = String(value);
      if (key === 'hidden') el.hidden = true;
      if (key === 'class') el.className = String(value);
    },
    getAttribute(key) {
      return attrs[key] !== undefined ? attrs[key] : null;
    },
    removeAttribute(key) {
      delete attrs[key];
      if (key === 'hidden') el.hidden = false;
    },
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    click() {
      for (const fn of listeners.click || []) fn({ preventDefault() {}, stopPropagation() {} });
    },
    querySelector(selector) {
      if (selector.startsWith('#')) return el._byId[selector.slice(1)] || null;
      return null;
    },
    appendChild(child) {
      children.push(child);
      return child;
    },
  };
  Object.defineProperty(el, 'className', {
    get() { return className; },
    set(value) {
      className = String(value || '');
      classes.clear();
      className.split(/\s+/).filter(Boolean).forEach((c) => classes.add(c));
    },
  });
  Object.defineProperty(el, 'textContent', {
    get() { return el._text; },
    set(value) { el._text = String(value ?? ''); },
  });
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._html || ''; },
    set(value) {
      el._html = String(value ?? '');
      el._byId = {};
      const re = /<([a-zA-Z0-9:-]+)([^>]*?)>/g;
      let found = re.exec(el._html);
      while (found) {
        const id = /\bid="([^"]+)"/.exec(found[2] || '');
        if (id) {
          const child = createElement(doc, found[1]);
          const classMatch = /\bclass="([^"]*)"/.exec(found[2] || '');
          if (classMatch) child.className = classMatch[1];
          if (/\bhidden\b/.test(found[2] || '')) child.setAttribute('hidden', '');
          child.id = id[1];
          child.setAttribute('id', id[1]);
          el._byId[id[1]] = child;
        }
        found = re.exec(el._html);
      }
    },
  });
  return el;
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

describe('EasyRequest chrome contract', () => {
  const blocks = declarationBlocks(chromeCss);

  it('gives the dialog a raised outer frame and a second beveled frame', () => {
    const outer = blocks.find((block) => (
      block.selector.includes('.custom-modal')
      && !block.selector.includes('.custom-modal-frame')
      && !block.selector.includes('.custom-modal-overlay')
    ));
    expect(outer, 'missing .custom-modal rule').toBeTruthy();
    expect(outer.body).toContain('border-radius: 0');
    expect(outer.body).toContain('border-top: 2px solid #FFFFFF');
    expect(outer.body).toContain('border-left: 2px solid #FFFFFF');
    expect(outer.body).toContain('border-right: 2px solid #000000');
    expect(outer.body).toContain('border-bottom: 2px solid #000000');
    expect(outer.body).toContain('box-shadow: 2px 2px 0 #000000');

    const inner = blocks.find((block) => block.selector.includes('.custom-modal-frame'));
    expect(inner, 'missing inner EasyRequest frame').toBeTruthy();
    expect(inner.body).toContain('border-radius: 0');
    expect(inner.body).toContain('border-top: 2px solid #FFFFFF');
    expect(inner.body).toContain('border-right: 2px solid #000000');
    expect(inner.body).toContain('border-bottom: 2px solid #000000');
  });
});

describe('CustomModal EasyRequest behavior', () => {
  let previousDocument;

  beforeEach(() => {
    previousDocument = globalThis.document;
    globalThis.document = createDocument();
  });

  afterEach(() => {
    globalThis.document = previousDocument;
  });

  it('mounts a cobalt titlebar, two gadgets, and beveled OK/Cancel', () => {
    const modal = new CustomModal();
    const html = modal.overlay.innerHTML;
    expect(html).toContain('class="custom-modal amiga-window"');
    expect(html).toContain('amiga-window-titlebar');
    expect(html).toContain('id="modal-title"');
    expect(html).toContain('data-gadget="close"');
    expect(html).toContain('id="modal-close"');
    expect(html).toContain('id="modal-depth"');
    expect(html).toContain('data-gadget="depth"');
    expect(html).toContain('class="custom-modal-frame"');
    expect(html).toContain('id="modal-ok-btn" class="amiga-gadget-btn"');
    expect(html).toContain('id="modal-cancel-btn" class="amiga-gadget-btn');
    expect(html).not.toContain('&times;');
    expect(html).not.toContain('border-radius');
    expect(html).not.toContain('glass-modal');
    expect(modal.overlay.classList.contains('modal-overlay')).toBe(true);
  });

  it('show is a single OK alert and confirm resolves from OK, Cancel, and the close gadget', async () => {
    const modal = new CustomModal();
    modal.show('NOTICE', 'Saved.');
    expect(modal.titleEl.textContent).toBe('NOTICE');
    expect(modal.msgEl.textContent).toBe('Saved.');
    expect(modal.cancelBtn.hidden).toBe(true);
    expect(modal.overlay.classList.contains('hidden')).toBe(false);

    const accepted = modal.confirm('REPLACE', 'Overwrite the profile?', {
      confirmLabel: 'OK',
      cancelLabel: 'Cancel',
    });
    expect(modal.cancelBtn.hidden).toBe(false);
    expect(modal.okBtn.textContent).toBe('OK');
    expect(modal.cancelBtn.textContent).toBe('Cancel');
    modal.okBtn.click();
    await expect(accepted).resolves.toBe(true);
    expect(modal.overlay.classList.contains('hidden')).toBe(true);

    const cancelled = modal.confirm('REPLACE', 'Again?');
    modal.cancelBtn.click();
    await expect(cancelled).resolves.toBe(false);

    const closed = modal.confirm('REPLACE', 'Once more?');
    expect(modal.overlay.classList.contains('hidden')).toBe(false);
    modal.overlay.querySelector('#modal-close').click();
    await expect(closed).resolves.toBe(false);

    modal.show('DEPTH', 'The depth gadget is a mark.');
    modal.overlay.querySelector('#modal-depth').click();
    expect(modal.overlay.classList.contains('hidden')).toBe(false);
    expect(modal.titleEl.textContent).toBe('DEPTH');
  });
});
