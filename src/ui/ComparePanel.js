import { reorderCompareItems, sortCompareItemsByCosine } from './compareCosine.js';
import { parseCompareInput } from './parseCompareGroups.js';
import { saeControlsMarkup, wireSaeControls } from './SaeControls.js';
import { FIELD_INFO, infoTipMarkup } from './fieldInfo.js';
import { formatItCoreGroupLine } from './itCoreCorpus.js';

/**
 * Typical auto-manual lexicon in English (parts, fluids, systems).
 * Simple tokens (no spaces) for the COMPARE splitter.
 */
export const AUTO_MANUAL_VOCAB_EN = [
  // Wheels / tires
  'wheel', 'wheels', 'tire', 'tires', 'rim', 'rims', 'hub', 'axle', 'axles',
  'bearing', 'bearings', 'rubber', 'cover', 'spoke',
  // Brakes and pedals
  'brake', 'brakes', 'pad', 'pads', 'disc', 'rotor', 'drum', 'abs', 'pedal',
  'accelerator', 'throttle', 'clutch',
  // Engine and exhaust
  'engine', 'piston', 'pistons', 'cylinder', 'cylinders', 'spark', 'plug',
  'injector', 'injectors', 'head', 'crankshaft', 'camshaft', 'turbo', 'compressor',
  'exhaust', 'catalytic', 'muffler', 'manifold', 'intake',
  // Cooling / lubrication / belts
  'radiator', 'coolant', 'antifreeze', 'oil', 'filter', 'filters',
  'belt', 'belts', 'pump', 'thermostat', 'fan',
  // Electrical
  'battery', 'alternator', 'starter', 'coil', 'fuse', 'fuses', 'relay',
  'sensor', 'sensors', 'cable', 'cables', 'wiring',
  // Transmission
  'transmission', 'gearbox', 'gear', 'gears', 'differential', 'driveshaft',
  'synchronizer', 'converter',
  // Steering and suspension
  'steering', 'suspension', 'shock', 'shocks', 'spring', 'springs',
  'leaf', 'arm', 'balljoint', 'tie',
  // Body and lighting
  'chassis', 'body', 'hood', 'trunk', 'door', 'doors', 'window',
  'windshield', 'mirror', 'mirrors', 'headlight', 'headlights', 'taillight',
  'bumper', 'fender', 'roof', 'panel',
  // Cabin / safety
  'seat', 'seats', 'seatbelt', 'airbag', 'airbags', 'dashboard',
  'speedometer', 'odometer', 'horn', 'wiper', 'wipers', 'glovebox',
  // Fluids and fuel
  'fuel', 'gasoline', 'diesel', 'fluid', 'hydraulic',
  // Fasteners / shop misc
  'gasket', 'gaskets', 'bolt', 'bolts', 'nut', 'nuts', 'washer',
  'hose', 'hoses', 'tank', 'cap',
  // Vehicle
  'vehicle', 'automobile', 'car', 'truck', 'van',
];

/** Deduplicated English auto-manual lexicon (stable order). */
export const AUTO_MANUAL_UNIQUE_EN = [...new Set(AUTO_MANUAL_VOCAB_EN)];

/** Demo textarea with two named groups (vehicles vs soft/emotional lexicon). */
export const COMPARE_GROUPS_DEMO_TEXT = `GROUP_1 = "car, vehicle, automobile, truck, van, engine, piston, cylinder, crankshaft, camshaft, turbo, exhaust, muffler, radiator, transmission, gearbox, clutch, differential, driveshaft, steering, suspension, chassis, brake, brakes, rotor, wheel, wheels, tire, tires, rim, axle, bearing, pedal, accelerator, throttle, injector, manifold, intake, coolant, antifreeze, oil, filter, battery, alternator, starter, coil, fuse, relay, sensor, wiring, shock, spring, hood, trunk, windshield, headlight, bumper, fender, seatbelt, airbag, dashboard, speedometer, fuel, gasoline, diesel"
GROUP_2 = "sophia, isabella, victoria, florence, beatrice, eleanor, charlotte, gloria, clara, penelope, serenity, compassion, tenderness, nostalgia, melancholy, empathy, affection, gratitude, forgiveness, solitude, devotion, harmony, poetry, symphony, melody, lullaby, romance, intimacy, solace, grace, bliss, euphoria, sweetness, delight, softness, warmth, kindness, hope, peace, innocence, purity, elegance, beauty, passion, desire, yearning, whisper, caress, embrace, soul, spirit, intuition, wisdom, reverie, fantasy, butterfly, blossom, rose, orchid, petal, jasmine, violet, peony, dahlia, magnolia"`;

/** Bootstrap / Galaxy default: IT core (100) first, then existing GROUP_1 + GROUP_2 demos. */
export const COMPARE_GALAXY_BOOTSTRAP_TEXT = `${formatItCoreGroupLine()}
${COMPARE_GROUPS_DEMO_TEXT}`;

/**
 * COMPARE presets — arrays become comma-joined; strings are written as-is (group demos).
 */
export const COMPARE_AUTO_PRESETS = {
  sample5: ['wheel', 'engine', 'brake', 'steering', 'clutch'],
  default: AUTO_MANUAL_UNIQUE_EN,
  sample20: AUTO_MANUAL_UNIQUE_EN.slice(0, 20),
  sample50: AUTO_MANUAL_UNIQUE_EN.slice(0, 50),
  groupsDemo: COMPARE_GROUPS_DEMO_TEXT,
  galaxyDemo: COMPARE_GALAXY_BOOTSTRAP_TEXT,
};

/**
 * Single source for COMPARE first-paint: textarea default + auto Visualize payload.
 * Must stay grouped so GROUP_* floating badges appear without a second submit.
 * Order: GROUP_it_core → GROUP_1 → GROUP_2 (REF inside the IT core).
 * @returns {{
 *   mode: 'flat'|'grouped',
 *   tokens: string[],
 *   tokenMeta: Array<{ groupId: string, groupLabel: string }|null>,
 *   groups: Array<{ id: string, label: string, tokens: string[] }>,
 *   textareaValue: string,
 * }}
 */
export function getCompareBootstrap() {
  const textareaValue = COMPARE_GALAXY_BOOTSTRAP_TEXT;
  const parsed = parseCompareInput(textareaValue);
  return { ...parsed, textareaValue };
}

/** @deprecated Use COMPARE_AUTO_PRESETS */
export const COMPARE_WHEEL_PRESETS = COMPARE_AUTO_PRESETS;

/**
 * Left Sidebar Control Panel component for COMPARE Mode token sequences (1 to 1024 tokens).
 */
export class ComparePanel {
  /**
   * @param {HTMLElement} containerElement
   * @param {Function} onCalculateCallback
   * @param {Function|null} [onReorderCallback]
   * @param {{
   *   onSaeToggle?: (enabled: boolean) => void|Promise<void>,
   *   onSaeTrain?: (settings: object) => void|Promise<void>,
   *   getSaeSettings?: () => object,
   *   setSaeSettings?: (s: object) => void,
   *   onDimSortChange?: (enabled: boolean) => void,
   * }} [saeHooks]
   */
  constructor(containerElement, onCalculateCallback, onReorderCallback = null, saeHooks = {}) {
    this.container = containerElement || document.body;
    this.onCalculate = onCalculateCallback;
    this.onReorder = onReorderCallback;
    this.saeHooks = saeHooks;

    /** @type {Array|null} */
    this.items = null;
    this.reorderLocked = false;
    /** Session-only dim contrast sort (D8 OFF default). */
    this.dimSortByContrast = false;
    /** Cosine ▲/▼ blocked while ≥2 groups (D9). */
    this.cosineSortBlockedByGroups = false;

    this.element = document.createElement('div');
    this.element.id = 'compare-panel';
    this.element.className = 'glass-sidebar hidden';
    this.element.innerHTML = `
      <div class="sidebar-header">
        <h2>🔍 TOKEN COMPARISON</h2>
        <span class="sidebar-subtitle">Multi-sequence Vector Space (1–1024 Tokens)</span>
      </div>

      <form id="compare-form" class="sidebar-form">
        <div class="input-group">
          <label for="compare-tokens"><span class="field-label-text">Tokens / Words, or GROUP_name = tokens (comma, space, or newline)</span>${infoTipMarkup(FIELD_INFO.compareTokens)}</label>
          <textarea id="compare-tokens" rows="6" placeholder="e.g. wheel, engine… or GROUP_1 = car, truck&#10;GROUP_2 = grace, hope" required></textarea>
        </div>

        <div class="preset-buttons-row">
          <button type="button" class="btn-preset" data-preset="sample5">5 Tokens</button>
          <button type="button" class="btn-preset" data-preset="sample20">20 Tokens</button>
          <button type="button" class="btn-preset" data-preset="sample50">50 Tokens</button>
          <button type="button" class="btn-preset" data-preset="groupsDemo">2 Groups</button>
          <button type="button" class="btn-preset" data-preset="galaxyDemo">3 Groups</button>
        </div>

        ${saeControlsMarkup('cmp')}
      </form>

      <div class="results-container compare-results">
        <h3>ACTIVE SEQUENCE METRICS</h3>
        <div id="compare-metrics" class="compare-metrics-box">
          <span class="metric-item">Loaded Tokens: <strong id="token-count-val">0</strong></span>
        </div>
        <div id="compare-groups-legend" class="compare-groups-legend" hidden></div>
        <label id="compare-dim-sort-row" class="compare-dim-sort" hidden title="Reorder X axis by |mean_G1 − mean_G2| so group differences cluster on the left">
          <input type="checkbox" id="compare-dim-sort-toggle">
          <span class="field-label-text">Sort dims by group contrast</span>${infoTipMarkup(FIELD_INFO.dimSort)}
        </label>

        <div class="compare-cosine-header">
          <h3 id="compare-cosine-subtitle" class="compare-cosine-subtitle">COSINE SIMILARITY vs —</h3>
          <span class="compare-sort-btns">
            <button type="button" id="btn-sort-desc" class="btn-sort-cosine" data-sort="desc" disabled title="Highest → lowest" aria-label="Sort descending">▼</button>
            <button type="button" id="btn-sort-asc" class="btn-sort-cosine" data-sort="asc" disabled title="Lowest → highest" aria-label="Sort ascending">▲</button>
          </span>
        </div>
        <ul id="compare-cosine-list" class="compare-cosine-list">
          <li class="empty-state">Visualize a sequence to see similarity vs the anchor...</li>
        </ul>
      </div>
    `;

    this.container.appendChild(this.element);

    this.form = this.element.querySelector('#compare-form');
    this.textarea = this.element.querySelector('#compare-tokens');
    this.tokenCountVal = this.element.querySelector('#token-count-val');
    this.groupsLegend = this.element.querySelector('#compare-groups-legend');
    this.dimSortRow = this.element.querySelector('#compare-dim-sort-row');
    this.dimSortToggle = this.element.querySelector('#compare-dim-sort-toggle');
    this.cosineSubtitle = this.element.querySelector('#compare-cosine-subtitle');
    this.cosineList = this.element.querySelector('#compare-cosine-list');
    this.btnSortDesc = this.element.querySelector('#btn-sort-desc');
    this.btnSortAsc = this.element.querySelector('#btn-sort-asc');

    this.saeUi = wireSaeControls(this.element, 'cmp', {
      primaryLabel: '🔍 VISUALIZE SEQUENCE (3D)',
      primaryLoadingLabel: '⏳ COMPUTING SEQUENCE EMBEDDINGS...',
      onToggle: saeHooks.onSaeToggle,
      onTrain: saeHooks.onSaeTrain,
      getSettings: saeHooks.getSaeSettings,
      setSettings: saeHooks.setSaeSettings,
    });
    this.btnSubmit = this.saeUi.btnPrimary;

    // Default: 2-group demo so GROUP_* badges are visible out of the box
    this.textarea.value = getCompareBootstrap().textareaValue;

    this.initEventListeners();
  }

  initEventListeners() {
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const parsed = parseCompareInput(this.textarea.value);
      if (parsed.tokens.length === 0) return;

      if (this.onCalculate) {
        this.setLoading(true);
        this.onCalculate(parsed.tokens, parsed.tokenMeta)
          .finally(() => this.setLoading(false));
      }
    });

    this.element.querySelectorAll('.btn-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.target.getAttribute('data-preset');
        const preset = COMPARE_AUTO_PRESETS[type];
        if (typeof preset === 'string') {
          this.textarea.value = preset;
        } else if (Array.isArray(preset)) {
          this.textarea.value = preset.join(", ");
        }
        // Preset must Visualize (not only fill text) — else GROUP_* meta never reaches 3D
        if (!this.onCalculate) return;
        const parsed = parseCompareInput(this.textarea.value);
        if (parsed.tokens.length === 0) return;
        this.setLoading(true);
        this.onCalculate(parsed.tokens, parsed.tokenMeta)
          .finally(() => this.setLoading(false));
      });
    });

    // Arrow reorder only — rows themselves do not focus the 3D camera
    this.cosineList.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-reorder');
      if (!btn || this.reorderLocked) return;
      e.preventDefault();
      e.stopPropagation();

      const index = Number(btn.getAttribute('data-index'));
      const delta = btn.getAttribute('data-dir') === 'up' ? -1 : 1;
      this.handleReorder(index, delta);
    });

    this.element.querySelectorAll('.btn-sort-cosine').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.reorderLocked || this.cosineSortBlockedByGroups) return;
        const direction = btn.getAttribute('data-sort');
        this.handleSort(direction);
      });
    });

    if (this.dimSortToggle) {
      this.dimSortToggle.addEventListener('change', () => {
        this.dimSortByContrast = !!this.dimSortToggle.checked;
        if (typeof this.saeHooks.onDimSortChange === 'function') {
          this.saeHooks.onDimSortChange(this.dimSortByContrast);
        }
      });
    }
  }

  applyReorderResult(result) {
    if (!result) return;
    this.items = result.items;
    this.renderCosineList(result.anchor, result.items);

    if (this.onReorder) {
      this.setReorderLocked(true);
      Promise.resolve(this.onReorder(result))
        .catch(() => {})
        .finally(() => this.setReorderLocked(false));
    }
  }

  handleReorder(fromIndex, delta) {
    if (!this.items || this.reorderLocked) return;
    this.applyReorderResult(reorderCompareItems(this.items, fromIndex, delta));
  }

  handleSort(direction) {
    if (!this.items || this.reorderLocked || this.cosineSortBlockedByGroups) return;
    this.applyReorderResult(sortCompareItemsByCosine(this.items, direction));
  }

  setReorderLocked(locked) {
    this.reorderLocked = locked;
    this.syncCosineSortButtons();

    this.cosineList.querySelectorAll('.btn-reorder').forEach((btn) => {
      if (locked) {
        btn.disabled = true;
      } else {
        const index = Number(btn.getAttribute('data-index'));
        const dir = btn.getAttribute('data-dir');
        const n = this.items ? this.items.length : 0;
        btn.disabled = (dir === 'up' && index === 0) || (dir === 'down' && index === n - 1);
      }
    });
  }

  /**
   * Enable/disable cosine ▲/▼; when groups active, force off with reason title (D9).
   */
  syncCosineSortButtons() {
    const hasItems = !!(this.items && this.items.length > 1);
    const blocked = this.cosineSortBlockedByGroups;
    const disabled = this.reorderLocked || !hasItems || blocked;
    const title = blocked
      ? 'Disabled while groups are active (preserves group blocks)'
      : null;
    if (this.btnSortDesc) {
      this.btnSortDesc.disabled = disabled;
      this.btnSortDesc.title = title || 'Highest → lowest';
    }
    if (this.btnSortAsc) {
      this.btnSortAsc.disabled = disabled;
      this.btnSortAsc.title = title || 'Lowest → highest';
    }
  }

  /**
   * Show dim-sort toggle only when ≥2 groups; sync cosine block (D7/D9).
   * @param {Array<{ groupId?: string, groupLabel?: string }>|null|undefined} items
   */
  syncGroupLayoutControls(items) {
    /** @type {Set<string>} */
    const ids = new Set();
    for (const it of items || []) {
      if (it?.groupId) ids.add(it.groupId);
    }
    const multiGroup = ids.size >= 2;
    this.cosineSortBlockedByGroups = multiGroup;
    this.syncCosineSortButtons();

    if (this.dimSortRow) {
      if (multiGroup) {
        this.dimSortRow.removeAttribute('hidden');
      } else {
        this.dimSortRow.setAttribute('hidden', '');
        if (this.dimSortByContrast) {
          this.dimSortByContrast = false;
          if (this.dimSortToggle) this.dimSortToggle.checked = false;
          if (typeof this.saeHooks.onDimSortChange === 'function') {
            this.saeHooks.onDimSortChange(false);
          }
        }
      }
    }
    if (this.dimSortToggle) {
      this.dimSortToggle.checked = this.dimSortByContrast;
      this.dimSortToggle.disabled = !multiGroup;
    }
  }

  setLoading(loading) {
    this.saeUi.setPrimaryLoading(loading);
  }

  updateMetrics(count) {
    if (this.tokenCountVal) {
      this.tokenCountVal.textContent = count;
    }
  }

  /**
   * Visible group chips under metrics (GROUP_1 · N) — survives even if 3D overlay fails.
   * @param {Array<{ groupId?: string, groupLabel?: string }>|null|undefined} items
   */
  updateGroupLegend(items) {
    if (!this.groupsLegend) return;
    /** @type {Map<string, { label: string, count: number }>} */
    const counts = new Map();
    for (const it of items || []) {
      if (!it?.groupId) continue;
      const label = it.groupLabel || it.groupId;
      const prev = counts.get(it.groupId);
      if (prev) prev.count += 1;
      else counts.set(it.groupId, { label, count: 1 });
    }
    if (!counts.size) {
      this.groupsLegend.setAttribute('hidden', '');
      this.groupsLegend.innerHTML = '';
    } else {
      this.groupsLegend.removeAttribute('hidden');
      this.groupsLegend.innerHTML = [...counts.values()]
        .map(
          (g) =>
            `<span class="compare-group-chip" title="${g.count} tokens">${g.label}<em>${g.count}</em></span>`
        )
        .join('');
    }
    this.syncGroupLayoutControls(items);
  }

  /**
   * Populate metrics + cosine-vs-anchor list from /compare response (or reordered payload).
   * @param {{ count: number, anchor?: { text: string }, items: Array }} data
   */
  updateCompareResults(data) {
    if (!data || !data.items) {
      this.items = null;
      this.updateMetrics(0);
      this.updateGroupLegend(null);
      this.cosineSubtitle.textContent = 'COSINE SIMILARITY vs —';
      this.cosineList.innerHTML = '<li class="empty-state">Visualize a sequence to see similarity vs the anchor...</li>';
      this.setReorderLocked(false);
      return;
    }

    this.items = data.items.slice();
    this.updateMetrics(data.count);
    this.updateGroupLegend(data.items);
    const anchor = data.anchor || (data.items[0] ? { index: 0, text: data.items[0].text } : null);
    this.renderCosineList(anchor, data.items);
  }

  renderCosineList(anchor, items) {
    const anchorWord = anchor?.text ?? items[0]?.text ?? '—';
    this.cosineSubtitle.textContent = `COSINE SIMILARITY vs "${anchorWord}"`;

    this.cosineList.innerHTML = '';
    if (!items || items.length === 0) {
      this.cosineList.innerHTML = '<li class="empty-state">No tokens loaded</li>';
      this.setReorderLocked(this.reorderLocked);
      return;
    }

    items.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'compare-cosine-item';
      li.setAttribute('data-id', item.id || `tok_${index}`);

      const score = index === 0
        ? 1
        : (typeof item.cosine_vs_first === 'number' ? item.cosine_vs_first : 0);

      const refBadge = index === 0 ? '<span class="badge-ref">REF</span>' : '';
      li.innerHTML = `
        <span class="rank">#${index + 1}</span>
        <span class="word">${item.text}</span>
        ${refBadge}
        <span class="score">${score.toFixed(4)}</span>
        <span class="reorder-btns">
          <button type="button" class="btn-reorder" data-dir="up" data-index="${index}" ${index === 0 || this.reorderLocked ? 'disabled' : ''} aria-label="Move up">▲</button>
          <button type="button" class="btn-reorder" data-dir="down" data-index="${index}" ${index === items.length - 1 || this.reorderLocked ? 'disabled' : ''} aria-label="Move down">▼</button>
        </span>
      `;
      this.cosineList.appendChild(li);
    });

    this.setReorderLocked(this.reorderLocked);
  }

  show() {
    this.element.classList.remove('hidden');
  }

  hide() {
    this.element.classList.add('hidden');
  }
}
