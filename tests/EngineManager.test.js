import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RemoteProvider } from '../src/core/RemoteProvider.js';
import { EngineManager } from '../src/ui/EngineManager.js';
import {
  DEFAULT_ENGINE_SETTINGS,
  ENGINE_STORAGE_KEYS,
  readEngineSettings,
  saveEngineSettings,
  readEnginePanelCollapsed,
  writeEnginePanelCollapsed,
  formatEnergyConcentration,
  formatCosineDrop,
} from '../src/ui/engineManagerDefaults.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function createMockElement(tagName = 'div') {
  const children = [];
  const attrs = {};
  const classes = new Set();
  let className = '';
  let textContent = '';

  const element = {
    tagName: tagName.toUpperCase(),
    children,
    parentNode: null,
    ownerDocument: null,
    style: {},
    id: '',
    type: '',
    disabled: false,
    tabIndex: 0,
    classList: {
      add: (...cls) => {
        cls.forEach((c) => { if (c) classes.add(c); });
        className = Array.from(classes).join(' ');
      },
      remove: (...cls) => {
        cls.forEach((c) => classes.delete(c));
        className = Array.from(classes).join(' ');
      },
      toggle: (cls, force) => {
        const has = classes.has(cls);
        const next = force === undefined ? !has : Boolean(force);
        if (next) classes.add(cls);
        else classes.delete(cls);
        className = Array.from(classes).join(' ');
        return classes.has(cls);
      },
      contains: (cls) => classes.has(cls),
    },
    appendChild: (child) => {
      children.push(child);
      child.parentNode = element;
      return child;
    },
    removeChild: (child) => {
      const index = children.indexOf(child);
      if (index >= 0) children.splice(index, 1);
      child.parentNode = null;
      return child;
    },
    get firstChild() {
      return children[0] || null;
    },
    addEventListener: (type, fn) => {
      if (!element._listeners) element._listeners = {};
      if (!element._listeners[type]) element._listeners[type] = [];
      element._listeners[type].push(fn);
    },
    setAttribute: (key, value) => { attrs[key] = String(value); },
    getAttribute: (key) => (attrs[key] !== undefined ? attrs[key] : null),
    removeAttribute: (key) => { delete attrs[key]; },
    querySelector: (selector) => queryAll(element, selector)[0] || null,
    querySelectorAll: (selector) => queryAll(element, selector),
    click: () => {
      (element._listeners?.click || []).forEach((fn) => fn({ type: 'click' }));
    },
    set className(value) {
      classes.clear();
      className = value || '';
      String(value || '').split(/\s+/).forEach((c) => { if (c) classes.add(c); });
    },
    get className() {
      return className;
    },
    set textContent(value) {
      textContent = value == null ? '' : String(value);
    },
    get textContent() {
      return textContent;
    },
  };
  return element;
}

function elementMatches(el, simple) {
  if (simple.startsWith('#')) return el.id === simple.slice(1);
  if (simple.includes('.')) {
    const parts = simple.split('.').filter(Boolean);
    const tag = simple.startsWith('.') ? null : parts.shift();
    if (tag && el.tagName !== tag.toUpperCase()) return false;
    return parts.every((cls) => el.classList.contains(cls));
  }
  return el.tagName === simple.toUpperCase();
}

function collectDescendants(node, pred, out) {
  for (const child of node.children || []) {
    if (pred(child)) out.push(child);
    collectDescendants(child, pred, out);
  }
}

function queryAll(root, selector) {
  const parts = String(selector).trim().split(/\s+/).filter(Boolean);
  let current = [root];
  for (const part of parts) {
    const next = [];
    for (const node of current) {
      collectDescendants(node, (el) => elementMatches(el, part), next);
    }
    current = next;
  }
  return current;
}

const mockDocument = {
  createElement(tagName) {
    const el = createMockElement(tagName);
    el.ownerDocument = mockDocument;
    if (tagName === 'button') el.type = 'button';
    return el;
  },
};

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(String(key), String(value)); },
    removeItem: (key) => { map.delete(key); },
    clear: () => map.clear(),
  };
}

const BGE_PROFILE = {
  model_name: 'BAAI/bge-m3',
  saturated_indices: [38, 58, 65, 80, 297, 376, 386, 404, 549, 577, 780],
  flat_indices: [329, 616],
  noise_indices: [38, 58, 65, 80, 297, 329, 376, 386, 404, 549, 577, 616, 780],
  energy_ratio: 0.1980,
  cosine_delta: 0.1152,
};

let originalFetch;

beforeEach(() => {
  globalThis.document = mockDocument;
  globalThis.localStorage = memoryStorage();
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('engineManagerDefaults', () => {
  it('test_engine_settings_roundtrip', () => {
    const storage = memoryStorage();
    expect(readEngineSettings(storage)).toEqual(DEFAULT_ENGINE_SETTINGS);
    expect(DEFAULT_ENGINE_SETTINGS).toEqual({
      shieldEnabled: true,
      dualPathEnabled: false,
    });
    saveEngineSettings(storage, { shieldEnabled: false, dualPathEnabled: true });
    expect(storage.getItem(ENGINE_STORAGE_KEYS.shieldEnabled)).toBe('0');
    expect(storage.getItem(ENGINE_STORAGE_KEYS.dualPathEnabled)).toBe('1');
    expect(readEngineSettings(storage)).toEqual({
      shieldEnabled: false,
      dualPathEnabled: true,
    });
    expect(formatEnergyConcentration(0.198)).toBe('19.80% L2 Norm');
    expect(formatCosineDrop({
      cosine_delta: 0.1152,
      cosine_raw: 0.4981,
      cosine_pruned: 0.3829,
    })).toBe('0.4981 → 0.3829 (Δ -0.1152)');
    expect(formatCosineDrop({ cosine_delta: 0.1152 })).toBe('(Δ -0.1152)');
    expect(formatEnergyConcentration(undefined)).toBe('—');
    expect(formatCosineDrop(null)).toBe('—');
  });

  it('test_engine_panel_collapsed_mobile_ignores_storage', () => {
    const storage = memoryStorage({ [ENGINE_STORAGE_KEYS.panelCollapsed]: '0' });
    expect(readEnginePanelCollapsed(storage, { isMobile: false })).toBe(false);
    expect(readEnginePanelCollapsed(storage, { isMobile: true })).toBe(true);
    writeEnginePanelCollapsed(storage, false, { isMobile: true });
    expect(storage.getItem(ENGINE_STORAGE_KEYS.panelCollapsed)).toBe('0');
    writeEnginePanelCollapsed(storage, true, { isMobile: false });
    expect(storage.getItem(ENGINE_STORAGE_KEYS.panelCollapsed)).toBe('1');
  });
});

describe('EngineManager', () => {
  it('test_engine_manager_markup_and_initial_render', () => {
    const parent = document.createElement('div');
    new EngineManager(parent, {});
    const container = parent.querySelector('#engine-manager-container');
    expect(container).toBeTruthy();
    expect(container.getAttribute('aria-expanded')).toBe('true');
    expect(container.getAttribute('data-dock')).toBe('engine');
    expect(container.classList.contains('engine-panel')).toBe(true);
    expect(container.classList.contains('amiga-raised-box')).toBe(true);
    expect(parent.querySelector('.engine-title-text').textContent).toBe('LLM ENGINE MANAGER');
    expect(parent.querySelectorAll('.amiga-window-gadget')).toHaveLength(2);
    expect(parent.querySelector('.gadget-inner-square')).toBeTruthy();
    expect(parent.querySelector('.engine-model-tag').id).toBe('engine-model-tag');
    expect(parent.querySelector('.engine-panel-tab').getAttribute('aria-expanded')).toBe('true');
    expect(parent.querySelector('.tab-label').textContent).toBe('ENGINE');
    expect(`${parent.querySelector('.tab-arrow').textContent} ${parent.querySelector('.tab-label').textContent}`)
      .toBe('▼ ENGINE');
    const shield = parent.querySelector('#cb-engine-shield');
    const dual = parent.querySelector('#cb-engine-dual');
    expect(shield.classList.contains('checked')).toBe(true);
    expect(shield.getAttribute('aria-checked')).toBe('true');
    expect(shield.getAttribute('role')).toBe('checkbox');
    expect(dual.classList.contains('checked')).toBe(false);
    expect(dual.getAttribute('aria-checked')).toBe('false');
    expect(parent.querySelector('#engine-metric-energy').textContent).toBe('—');
    expect(parent.querySelector('#engine-metric-cosine').textContent).toBe('—');
    expect(parent.querySelector('#engine-audit-btn').textContent).toBe('⚡ RUN STRUCTURAL NOISE AUDIT');
  });

  it('restores shield and dual-path from storage without emitting', () => {
    const storage = memoryStorage({
      [ENGINE_STORAGE_KEYS.shieldEnabled]: '0',
      [ENGINE_STORAGE_KEYS.dualPathEnabled]: '1',
    });
    const calls = [];
    const parent = document.createElement('div');
    new EngineManager(parent, {}, {
      storage,
      onShieldToggle: (value) => calls.push(value),
      onDualPathToggle: (value) => calls.push(value),
    });
    expect(parent.querySelector('#cb-engine-shield').getAttribute('aria-checked')).toBe('false');
    expect(parent.querySelector('#cb-engine-dual').getAttribute('aria-checked')).toBe('true');
    expect(parent.querySelector('#engine-shield-toggle-row .toggle-label').textContent)
      .toBe('Outlier Pruning Shield [3D OFF]');
    expect(calls).toEqual([]);
  });

  it('test_engine_manager_collapse_toggle_and_persistence', () => {
    const parent = document.createElement('div');
    new EngineManager(parent, {});
    const container = parent.querySelector('#engine-manager-container');
    const tab = parent.querySelector('.engine-panel-tab');
    tab.click();
    expect(container.classList.contains('is-collapsed')).toBe(true);
    expect(container.getAttribute('aria-expanded')).toBe('false');
    expect(tab.getAttribute('aria-expanded')).toBe('false');
    expect(parent.querySelector('.tab-arrow').textContent).toBe('▲');
    expect(localStorage.getItem('vl3d.engine.panelCollapsed')).toBe('1');
    tab.click();
    expect(container.classList.contains('is-collapsed')).toBe(false);
    expect(container.getAttribute('aria-expanded')).toBe('true');
    expect(localStorage.getItem('vl3d.engine.panelCollapsed')).toBe('0');
    expect(parent.querySelector('.tab-arrow').textContent).toBe('▼');
  });

  it('mobile collapse toggles in the session and does not write storage', () => {
    const storage = memoryStorage({
      [ENGINE_STORAGE_KEYS.panelCollapsed]: '0',
    });
    const parent = document.createElement('div');
    new EngineManager(parent, {}, { storage, isMobile: () => true });
    const container = parent.querySelector('#engine-manager-container');
    expect(container.classList.contains('is-collapsed')).toBe(true);
    expect(container.getAttribute('aria-expanded')).toBe('false');
    parent.querySelector('.engine-panel-tab').click();
    expect(container.classList.contains('is-collapsed')).toBe(false);
    expect(storage.getItem(ENGINE_STORAGE_KEYS.panelCollapsed)).toBe('0');
  });

  it('test_engine_manager_profile_rendering', () => {
    const parent = document.createElement('div');
    const manager = new EngineManager(parent, {});
    manager.setNoiseProfile(BGE_PROFILE);
    expect(parent.querySelector('#engine-metric-energy').textContent).toContain('19.80%');
    expect(parent.querySelector('#engine-metric-cosine').textContent).toContain('0.1152');
    const saturated = parent.querySelectorAll('#engine-pills-container .noise-pill.sat');
    const flat = parent.querySelectorAll('#engine-pills-container .noise-pill.flat');
    expect(saturated).toHaveLength(11);
    expect(flat).toHaveLength(2);
    expect(saturated[0].textContent).toBe('38');
    expect(saturated[0].getAttribute('title')).toBe('Saturated Outlier (Z_E >= 3.0)');
    expect(flat[0].textContent).toBe('329');
    expect(flat[1].textContent).toBe('616');
    expect(flat[0].getAttribute('title')).toBe('Flat/Inert Channel (sigma <= 0.010)');
    expect(parent.querySelector('#engine-model-tag').textContent).toBe('—');
  });

  it('prints the raw-to-pruned cosine pair only when both means are present', () => {
    const parent = document.createElement('div');
    const manager = new EngineManager(parent, {});
    manager.setNoiseProfile({
      ...BGE_PROFILE,
      cosine_raw: 0.4981,
      cosine_pruned: 0.3829,
    });
    expect(parent.querySelector('#engine-metric-energy').textContent).toBe('19.80% L2 Norm');
    expect(parent.querySelector('#engine-metric-cosine').textContent)
      .toBe('0.4981 → 0.3829 (Δ -0.1152)');
  });

  it('test_engine_manager_empty_profile_is_distinct_from_missing', () => {
    const parent = document.createElement('div');
    const manager = new EngineManager(parent, {});
    manager.setNoiseProfile({
      energy_ratio: 0,
      cosine_delta: 0,
      saturated_indices: [],
      flat_indices: [],
      noise_indices: [],
    });
    expect(parent.querySelector('#engine-metric-energy').textContent).toBe('0.00% L2 Norm');
    expect(parent.querySelector('#engine-metric-cosine').textContent).toBe('(Δ +0.0000)');
    expect(parent.querySelectorAll('#engine-pills-container .noise-pill')).toHaveLength(0);
    manager.setNoiseProfile(null);
    expect(parent.querySelector('#engine-metric-energy').textContent).toBe('—');
    expect(parent.querySelector('#engine-metric-cosine').textContent).toBe('—');
    expect(parent.querySelectorAll('#engine-pills-container .noise-pill')).toHaveLength(0);
  });

  it('test_engine_manager_checkbox_callbacks', () => {
    const calls = [];
    const parent = document.createElement('div');
    new EngineManager(parent, {}, {
      onShieldToggle: (enabled) => calls.push(['shield', enabled]),
      onDualPathToggle: (enabled) => calls.push(['dual', enabled]),
    });
    parent.querySelector('#engine-shield-toggle-row').click();
    const shield = parent.querySelector('#cb-engine-shield');
    expect(shield.classList.contains('checked')).toBe(false);
    expect(shield.getAttribute('aria-checked')).toBe('false');
    expect(calls).toEqual([['shield', false]]);
    expect(localStorage.getItem('vl3d.engine.shieldEnabled')).toBe('0');
    parent.querySelector('#engine-dual-toggle-row').click();
    const dual = parent.querySelector('#cb-engine-dual');
    expect(dual.classList.contains('checked')).toBe(true);
    expect(dual.getAttribute('aria-checked')).toBe('true');
    expect(calls[1]).toEqual(['dual', true]);
    expect(localStorage.getItem('vl3d.engine.dualPathEnabled')).toBe('1');
  });

  it('test_engine_manager_busy_and_status', () => {
    const parent = document.createElement('div');
    const manager = new EngineManager(parent, {});
    const btn = parent.querySelector('#engine-audit-btn');
    manager.setBusy(true);
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('⚡ RUNNING AUDIT...');
    manager.setBusy(false);
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe('⚡ RUN STRUCTURAL NOISE AUDIT');
    manager.setEngineStatus({ model_name: 'BAAI/bge-m3', model_profile: null });
    expect(parent.querySelector('#engine-model-tag').textContent).toBe('BAAI/bge-m3');
    manager.setEngineStatus({ model_name: 'BAAI/bge-m3', model_profile: 'local-full' });
    expect(parent.querySelector('#engine-model-tag').textContent).toBe('BAAI/bge-m3 / local-full');
    manager.setEngineStatus(null);
    expect(parent.querySelector('#engine-model-tag').textContent).toBe('—');
  });

  it('test_engine_manager_audit_button_interaction', async () => {
    const profile = {
      model_name: 'BAAI/bge-m3',
      saturated_indices: [38, 58],
      flat_indices: [329],
      energy_ratio: 0.198,
      cosine_delta: 0.1152,
    };
    let captured = null;
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    let resolveDone;
    const done = new Promise((resolve) => { resolveDone = resolve; });
    const provider = {
      detectStructuralNoise: (opts) => {
        captured = opts;
        return gate.then(() => profile);
      },
    };
    const parent = document.createElement('div');
    new EngineManager(parent, provider, {
      onAuditComplete: (value) => resolveDone(value),
    });
    const btn = parent.querySelector('#engine-audit-btn');
    btn.click();
    expect(captured).toEqual({ forceRecompute: true });
    expect(btn.textContent).toBe('⚡ RUNNING AUDIT...');
    expect(btn.disabled).toBe(true);
    release();
    const completed = await done;
    expect(completed).toBe(profile);
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe('⚡ RUN STRUCTURAL NOISE AUDIT');
    expect(parent.querySelector('#engine-metric-energy').textContent).toContain('19.80%');
    expect(parent.querySelector('#engine-metric-cosine').textContent).toContain('0.1152');
    expect(parent.querySelectorAll('#engine-pills-container .noise-pill.sat')).toHaveLength(2);
    expect(parent.querySelectorAll('#engine-pills-container .noise-pill.flat')).toHaveLength(1);
    expect(parent.querySelector('#engine-model-tag').textContent).toBe('BAAI/bge-m3');
  });
});

describe('RemoteProvider engine routes', () => {
  it('test_remote_provider_engine_methods', async () => {
    const calls = [];
    globalThis.fetch = async (url, init = {}) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    };

    const provider = new RemoteProvider('http://127.0.0.1:8000');
    await provider.getEngineStatus();
    await provider.detectStructuralNoise();
    await provider.detectStructuralNoise({ forceRecompute: true });
    await provider.getEngineNoiseProfile();

    expect(calls[0].url).toBe('http://127.0.0.1:8000/engine/status');
    expect(calls[0].init.method).toBeUndefined();
    expect(calls[0].init.headers['Content-Type']).toBeUndefined();

    expect(calls[1].url).toBe('http://127.0.0.1:8000/engine/detect-structural-noise');
    expect(calls[1].init.method).toBe('POST');
    expect(calls[1].init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(calls[1].init.body)).toEqual({ force_recompute: false });

    expect(JSON.parse(calls[2].init.body)).toEqual({ force_recompute: true });

    expect(calls[3].url).toBe('http://127.0.0.1:8000/engine/noise-profile');
    expect(calls[3].init.headers['Content-Type']).toBeUndefined();

    const tunneled = new RemoteProvider('https://lab.ngrok-free.dev');
    await tunneled.getEngineStatus();
    expect(calls[4].url).toBe('https://lab.ngrok-free.dev/engine/status');
    expect(calls[4].init.headers['ngrok-skip-browser-warning']).toBe('true');
  });

  it('surfaces engine HTTP failures with the server detail', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 503,
      json: async () => ({ detail: 'No embeddings or active model available for noise detection.' }),
    });
    const provider = new RemoteProvider('/api');
    await expect(provider.detectStructuralNoise({ forceRecompute: true }))
      .rejects.toThrow('No embeddings or active model available for noise detection.');
    await expect(provider.getEngineNoiseProfile()).rejects.toThrow('No embeddings');
    await expect(provider.getEngineStatus()).rejects.toThrow('No embeddings');
  });
});

describe('engine manager stylesheet contract', () => {
  it('test_engine_gadget_depress_and_dock_css', () => {
    const chrome = readFileSync(resolve(ROOT, 'src/theme/chrome.css'), 'utf8');
    const layout = readFileSync(resolve(ROOT, 'src/style.css'), 'utf8');
    expect(chrome).toContain('.amiga-gadget-btn:active {');
    expect(chrome).toContain('transform: translate(1px, 1px);');
    expect(chrome).toContain('border-top: 2px solid #000000;');
    expect(chrome).toContain('border-left: 2px solid #000000;');
    expect(chrome).toContain('border-right: 2px solid #FFFFFF;');
    expect(chrome).toContain('border-bottom: 2px solid #FFFFFF;');
    expect(chrome).toContain('background: #3B67A2;');
    expect(chrome).toContain('background: #FFA997;');
    expect(chrome).toContain('background: #AA907C;');
    expect(chrome).toContain('background: rgba(0, 0, 0, 0.5);');
    expect(layout).toContain('left: var(--hud-pad, 10px);');
    expect(layout).toContain('bottom: calc(var(--hud-bottom, 8px) + var(--hud-height, 28px) - 1px);');
    expect(layout).toContain('width: 330px;');
    expect(layout).toContain('z-index: 45;');
    expect(layout).toContain('#engine-manager-container.is-collapsed .engine-panel-body');
  });
});
