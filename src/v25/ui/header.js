/**
 * VHectorLab-3D v25 header chrome — UI-only MODE / VIEW / RENDER + ONLINE badge.
 * Does not wire the 3D engine (later phases).
 */
import {
  DEFAULT_RENDER_MODE,
  DEFAULT_VIEW_MODE,
  DEFAULT_WORKSPACE_MODE,
} from '../../ui/appViewDefaults.js';
import { PRODUCT_NAME, PRODUCT_VERSION } from '../version.js';

export const HEADER_OPTIONS = Object.freeze({
  workspace: Object.freeze(['ARITHMETIC', 'COMPARE']),
  view: Object.freeze(['ANALYSIS', 'NAVIGATION']),
  render: Object.freeze(['POINTS', 'RIBBONS']),
});

/**
 * @param {Partial<{ workspace: string, view: string, render: string, online: boolean }>} initial
 */
export function createHeaderState(initial = {}) {
  return {
    workspace: initial.workspace ?? DEFAULT_WORKSPACE_MODE,
    view: initial.view ?? DEFAULT_VIEW_MODE,
    render: initial.render ?? DEFAULT_RENDER_MODE,
    online: initial.online !== undefined ? Boolean(initial.online) : true,
  };
}

/**
 * @param {ReturnType<typeof createHeaderState>} state
 * @param {'workspace' | 'view' | 'render'} group
 * @param {string} value
 */
export function applyHeaderSelection(state, group, value) {
  const allowed = HEADER_OPTIONS[group];
  if (!allowed || !allowed.includes(value)) return state;
  if (state[group] === value) return state;
  return { ...state, [group]: value };
}

/**
 * @param {ReturnType<typeof createHeaderState>} state
 * @param {boolean} online
 */
export function applyOnlineStatus(state, online) {
  const next = Boolean(online);
  if (state.online === next) return state;
  return { ...state, online: next };
}

function tabButtons(group, options, active) {
  return options
    .map(
      (value) => `
      <button
        type="button"
        class="lab-tab${value === active ? ' is-active' : ''}"
        data-group="${group}"
        data-value="${value}"
        aria-pressed="${value === active ? 'true' : 'false'}"
      >${value}</button>`,
    )
    .join('');
}

/**
 * @param {HTMLElement} container
 * @param {{ version?: string, name?: string, initial?: object, onChange?: (state: object) => void }} [options]
 */
export function mountHeader(container, options = {}) {
  if (!container) throw new Error('mountHeader requires a container');

  const version = options.version ?? PRODUCT_VERSION;
  const name = options.name ?? PRODUCT_NAME;
  let state = createHeaderState(options.initial);
  const onChange = typeof options.onChange === 'function' ? options.onChange : null;

  const render = () => {
    container.innerHTML = `
      <div class="lab-header" data-chrome="header">
        <div class="lab-header__brand">
          <h1 class="lab-header__title">${name}</h1>
          <span class="lab-header__version lab-mono">v${version}</span>
        </div>

        <div class="lab-header__tabs" role="toolbar" aria-label="Workspace controls">
          <div class="lab-header__group" data-tabs="workspace">
            <span class="lab-header__label">MODE</span>
            ${tabButtons('workspace', HEADER_OPTIONS.workspace, state.workspace)}
          </div>
          <div class="lab-header__group" data-tabs="view">
            <span class="lab-header__label">VIEW</span>
            ${tabButtons('view', HEADER_OPTIONS.view, state.view)}
          </div>
          <div class="lab-header__group" data-tabs="render">
            <span class="lab-header__label">RENDER</span>
            ${tabButtons('render', HEADER_OPTIONS.render, state.render)}
          </div>
        </div>

        <div class="lab-header__status" data-online="${state.online ? '1' : '0'}">
          <span class="lab-header__status-dot" aria-hidden="true"></span>
          <span class="lab-header__status-text lab-mono">${state.online ? 'ONLINE' : 'OFFLINE'}</span>
        </div>
      </div>
    `;

    container.querySelectorAll('.lab-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const group = btn.getAttribute('data-group');
        const value = btn.getAttribute('data-value');
        const next = applyHeaderSelection(state, group, value);
        if (next === state) return;
        state = next;
        render();
        if (onChange) onChange({ ...state });
      });
    });
  };

  render();

  return {
    getState: () => ({ ...state }),
    setOnline(online) {
      const next = applyOnlineStatus(state, online);
      if (next === state) return;
      state = next;
      render();
      if (onChange) onChange({ ...state });
    },
    setSelection(group, value) {
      const next = applyHeaderSelection(state, group, value);
      if (next === state) return;
      state = next;
      render();
      if (onChange) onChange({ ...state });
    },
  };
}
