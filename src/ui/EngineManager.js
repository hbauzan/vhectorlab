/**
 * Bottom-left LLM Engine Manager sheet.
 * HUD-seam counterpart of Visualization Controls. Collapse keeps the tab mounted.
 */

import { isMobileViewport } from './CollapsibleDock.js';
import {
  readEngineSettings,
  saveEngineSettings,
  readEnginePanelCollapsed,
  writeEnginePanelCollapsed,
  formatEnergyConcentration,
  formatCosineDrop,
} from './engineManagerDefaults.js';

const AUDIT_IDLE = '⚡ RUN STRUCTURAL NOISE AUDIT';
const AUDIT_BUSY = '⚡ RUNNING AUDIT...';
const SAT_TITLE = 'Saturated Outlier (Z_E >= 3.0)';
const FLAT_TITLE = 'Flat/Inert Channel (sigma <= 0.010)';

/**
 * @returns {Storage | null}
 */
function defaultStorage() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch {
    return null;
  }
  return null;
}

/**
 * @param {unknown} value
 * @returns {number[]}
 */
function indexList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    const n = Number(item);
    if (Number.isInteger(n)) out.push(n);
  }
  return out;
}

export class EngineManager {
  /**
   * @param {HTMLElement} parentContainer
   * @param {import('../core/RemoteProvider.js').RemoteProvider | { detectStructuralNoise?: Function, getEngineStatus?: Function, getEngineNoiseProfile?: Function } | null} provider
   * @param {{
   *   onShieldToggle?: (enabled: boolean) => void,
   *   onDualPathToggle?: (enabled: boolean) => void,
   *   onAuditComplete?: (profile: object) => void,
   *   storage?: Storage | null,
   *   isMobile?: () => boolean,
   * }} [callbacks]
   */
  constructor(parentContainer, provider, callbacks = {}) {
    if (!parentContainer || typeof parentContainer.appendChild !== 'function') {
      throw new Error('EngineManager requires a parent container');
    }
    this.parent = parentContainer;
    this.provider = provider || null;
    this.callbacks = callbacks || {};
    this.storage = callbacks.storage !== undefined ? callbacks.storage : defaultStorage();
    this._isMobileFn = typeof callbacks.isMobile === 'function'
      ? callbacks.isMobile
      : () => isMobileViewport();
    this.settings = readEngineSettings(this.storage);
    this._busy = false;

    const doc = typeof document !== 'undefined' ? document : null;
    if (!doc || typeof doc.createElement !== 'function') {
      throw new Error('EngineManager requires a Document');
    }

    this.root = doc.createElement('div');
    this.root.id = 'engine-manager-container';
    this.root.className = 'engine-panel amiga-raised-box';
    this.root.setAttribute('data-dock', 'engine');

    this.tab = doc.createElement('button');
    this.tab.type = 'button';
    this.tab.className = 'engine-panel-tab dock-tab';
    this.tab.setAttribute('aria-label', 'Toggle Engine Manager');
    this.arrow = doc.createElement('span');
    this.arrow.className = 'tab-arrow';
    this.tabLabel = doc.createElement('span');
    this.tabLabel.className = 'tab-label';
    this.tabLabel.textContent = 'ENGINE';
    this.tab.appendChild(this.arrow);
    this.tab.appendChild(this.tabLabel);

    this.body = doc.createElement('div');
    this.body.className = 'engine-panel-body';

    const titlebar = doc.createElement('div');
    titlebar.className = 'amiga-window-titlebar';
    titlebar.appendChild(windowGadget(doc));
    const title = doc.createElement('span');
    title.className = 'engine-title-text';
    title.textContent = 'LLM ENGINE MANAGER';
    titlebar.appendChild(title);
    this.modelTag = doc.createElement('span');
    this.modelTag.className = 'engine-model-tag';
    this.modelTag.id = 'engine-model-tag';
    this.modelTag.textContent = '—';
    titlebar.appendChild(this.modelTag);
    titlebar.appendChild(windowGadget(doc));

    const content = doc.createElement('div');
    content.className = 'engine-content';

    const well = doc.createElement('div');
    well.className = 'amiga-inset-box engine-metrics-well';

    this.auditBtn = doc.createElement('button');
    this.auditBtn.type = 'button';
    this.auditBtn.className = 'amiga-gadget-btn engine-audit-btn';
    this.auditBtn.id = 'engine-audit-btn';
    this.auditBtn.textContent = AUDIT_IDLE;

    const energyRow = metricRow(doc, 'Energy Concentration:', 'engine-metric-energy');
    this.energyEl = energyRow.value;
    const cosineRow = metricRow(doc, 'Baseline Anisotropy:', 'engine-metric-cosine');
    this.cosineEl = cosineRow.value;

    const pillsHeader = doc.createElement('div');
    pillsHeader.className = 'pills-header';
    pillsHeader.textContent = 'ISOLATED OUTLIER AXES (3D BEVELED PILLS):';

    this.pills = doc.createElement('div');
    this.pills.className = 'pills-container';
    this.pills.id = 'engine-pills-container';

    well.appendChild(this.auditBtn);
    well.appendChild(energyRow.row);
    well.appendChild(cosineRow.row);
    well.appendChild(pillsHeader);
    well.appendChild(this.pills);

    const shield = checkboxRow(doc, {
      rowId: 'engine-shield-toggle-row',
      boxId: 'cb-engine-shield',
      labelClass: 'toggle-label bold',
    });
    this.shieldRow = shield.row;
    this.shieldBox = shield.box;
    this.shieldLabel = shield.label;

    const dual = checkboxRow(doc, {
      rowId: 'engine-dual-toggle-row',
      boxId: 'cb-engine-dual',
      labelClass: 'toggle-label muted',
      labelText: 'Dual-Path Ribbon (Ghost vs Pure)',
    });
    this.dualRow = dual.row;
    this.dualBox = dual.box;
    this.dualLabel = dual.label;

    content.appendChild(well);
    content.appendChild(this.shieldRow);
    content.appendChild(this.dualRow);
    this.body.appendChild(titlebar);
    this.body.appendChild(content);

    this.root.appendChild(this.tab);
    this.root.appendChild(this.body);
    this.parent.appendChild(this.root);

    this._applyShield(this.settings.shieldEnabled);
    this._applyDual(this.settings.dualPathEnabled);
    this.setCollapsed(readEnginePanelCollapsed(this.storage, {
      isMobile: this._isMobileFn(),
    }), { persist: false });

    this.tab.addEventListener('click', () => {
      this.setCollapsed(!this.root.classList.contains('is-collapsed'));
    });
    this.shieldRow.addEventListener('click', () => {
      this.setShieldEnabled(!this.settings.shieldEnabled);
    });
    this.dualRow.addEventListener('click', () => {
      this.setDualPathEnabled(!this.settings.dualPathEnabled);
    });
    this.shieldBox.addEventListener('keydown', (event) => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      if (typeof event.preventDefault === 'function') event.preventDefault();
      this.setShieldEnabled(!this.settings.shieldEnabled);
    });
    this.dualBox.addEventListener('keydown', (event) => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      if (typeof event.preventDefault === 'function') event.preventDefault();
      this.setDualPathEnabled(!this.settings.dualPathEnabled);
    });
    this.auditBtn.addEventListener('click', () => {
      this.runAudit(true).catch((err) => {
        console.error('Engine audit failed:', err);
      });
    });
  }

  /**
   * @param {boolean} collapsed
   * @param {{ persist?: boolean }} [opts]
   */
  setCollapsed(collapsed, opts = {}) {
    const next = Boolean(collapsed);
    const persist = opts.persist !== false;
    this.root.classList.toggle('is-collapsed', next);
    const expanded = next ? 'false' : 'true';
    this.root.setAttribute('aria-expanded', expanded);
    this.tab.setAttribute('aria-expanded', expanded);
    this.arrow.textContent = next ? '▲' : '▼';
    if (persist) {
      writeEnginePanelCollapsed(this.storage, next, { isMobile: this._isMobileFn() });
    }
  }

  /**
   * @param {object | null | undefined} profile
   */
  setNoiseProfile(profile) {
    const hasEnergy = profile != null && Number.isFinite(Number(profile.energy_ratio));
    const hasDelta = profile != null && Number.isFinite(Number(profile.cosine_delta));
    this.energyEl.textContent = hasEnergy
      ? formatEnergyConcentration(profile.energy_ratio)
      : '—';
    this.cosineEl.textContent = hasDelta ? formatCosineDrop(profile) : '—';
    this._renderPills(
      hasEnergy || hasDelta || profile != null ? indexList(profile?.saturated_indices) : [],
      hasEnergy || hasDelta || profile != null ? indexList(profile?.flat_indices) : [],
    );
  }

  /**
   * @param {{ model_name?: string, model_profile?: string | null } | null | undefined} status
   */
  setEngineStatus(status) {
    if (!status || typeof status !== 'object') {
      this.modelTag.textContent = '—';
      return;
    }
    const name = status.model_name ? String(status.model_name) : '—';
    const profile = status.model_profile ? String(status.model_profile) : '';
    this.modelTag.textContent = profile ? `${name} / ${profile}` : name;
  }

  /**
   * @param {boolean} enabled
   */
  setShieldEnabled(enabled) {
    this._applyShield(Boolean(enabled));
    this._persistSettings();
    if (typeof this.callbacks.onShieldToggle === 'function') {
      this.callbacks.onShieldToggle(this.settings.shieldEnabled);
    }
  }

  /**
   * @param {boolean} enabled
   */
  setDualPathEnabled(enabled) {
    this._applyDual(Boolean(enabled));
    this._persistSettings();
    if (typeof this.callbacks.onDualPathToggle === 'function') {
      this.callbacks.onDualPathToggle(this.settings.dualPathEnabled);
    }
  }

  /**
   * @param {boolean} busy
   */
  setBusy(busy) {
    this._busy = Boolean(busy);
    this.auditBtn.disabled = this._busy;
    if (this._busy) this.auditBtn.setAttribute('disabled', '');
    else if (typeof this.auditBtn.removeAttribute === 'function') {
      this.auditBtn.removeAttribute('disabled');
    }
    this.auditBtn.textContent = this._busy ? AUDIT_BUSY : AUDIT_IDLE;
  }

  /**
   * @param {boolean} [forceRecompute=true]
   */
  async runAudit(forceRecompute = true) {
    if (this._busy) return null;
    if (!this.provider || typeof this.provider.detectStructuralNoise !== 'function') {
      throw new Error('detectStructuralNoise is not available');
    }
    this.setBusy(true);
    try {
      const profile = await this.provider.detectStructuralNoise({
        forceRecompute: Boolean(forceRecompute),
      });
      this.setNoiseProfile(profile);
      if (profile && profile.model_name) {
        this.setEngineStatus({
          model_name: profile.model_name,
          model_profile: profile.model_profile,
        });
      }
      if (typeof this.callbacks.onAuditComplete === 'function') {
        this.callbacks.onAuditComplete(profile);
      }
      return profile;
    } finally {
      this.setBusy(false);
    }
  }

  /**
   * @param {boolean} enabled
   */
  _applyShield(enabled) {
    this.settings.shieldEnabled = Boolean(enabled);
    paintCheckbox(this.shieldBox, this.settings.shieldEnabled);
    this.shieldLabel.textContent = this.settings.shieldEnabled
      ? 'Outlier Pruning Shield [3D ON]'
      : 'Outlier Pruning Shield [3D OFF]';
  }

  /**
   * @param {boolean} enabled
   */
  _applyDual(enabled) {
    this.settings.dualPathEnabled = Boolean(enabled);
    paintCheckbox(this.dualBox, this.settings.dualPathEnabled);
    this.dualLabel.textContent = 'Dual-Path Ribbon (Ghost vs Pure)';
  }

  _persistSettings() {
    saveEngineSettings(this.storage, this.settings);
  }

  /**
   * @param {number[]} saturated
   * @param {number[]} flat
   */
  _renderPills(saturated, flat) {
    while (this.pills.firstChild) {
      this.pills.removeChild(this.pills.firstChild);
    }
    const doc = this.pills.ownerDocument || document;
    for (const dim of saturated) {
      this.pills.appendChild(pill(doc, dim, 'sat', SAT_TITLE));
    }
    for (const dim of flat) {
      this.pills.appendChild(pill(doc, dim, 'flat', FLAT_TITLE));
    }
  }
}

/**
 * @param {Document} doc
 */
function windowGadget(doc) {
  const gadget = doc.createElement('div');
  gadget.className = 'amiga-window-gadget';
  const inner = doc.createElement('div');
  inner.className = 'gadget-inner-square';
  gadget.appendChild(inner);
  return gadget;
}

/**
 * @param {Document} doc
 * @param {string} labelText
 * @param {string} valueId
 */
function metricRow(doc, labelText, valueId) {
  const row = doc.createElement('div');
  row.className = 'metric-row';
  const label = doc.createElement('span');
  label.className = 'metric-label';
  label.textContent = labelText;
  const value = doc.createElement('span');
  value.className = 'metric-value';
  value.id = valueId;
  value.textContent = '—';
  row.appendChild(label);
  row.appendChild(value);
  return { row, value };
}

/**
 * @param {Document} doc
 * @param {{ rowId: string, boxId: string, labelClass: string, labelText?: string }} spec
 */
function checkboxRow(doc, spec) {
  const row = doc.createElement('div');
  row.className = 'shield-toggle-row';
  row.id = spec.rowId;
  const box = doc.createElement('div');
  box.className = 'amiga-checkbox';
  box.id = spec.boxId;
  box.setAttribute('role', 'checkbox');
  box.tabIndex = 0;
  const label = doc.createElement('span');
  label.className = spec.labelClass;
  if (spec.labelText) label.textContent = spec.labelText;
  row.appendChild(box);
  row.appendChild(label);
  return { row, box, label };
}

/**
 * @param {HTMLElement} box
 * @param {boolean} checked
 */
function paintCheckbox(box, checked) {
  box.classList.toggle('checked', checked);
  box.setAttribute('aria-checked', checked ? 'true' : 'false');
}

/**
 * @param {Document} doc
 * @param {number} dim
 * @param {'sat' | 'flat'} kind
 * @param {string} title
 */
function pill(doc, dim, kind, title) {
  const el = doc.createElement('span');
  el.className = `noise-pill ${kind}`;
  el.setAttribute('title', title);
  el.textContent = String(dim);
  return el;
}
