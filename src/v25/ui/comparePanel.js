/**
 * VHectorLab-3D v25 Compare chrome — sequence + cosine list (no SAE).
 */
import {
  COMPARE_AUTO_PRESETS,
  getCompareBootstrap,
} from '../../ui/ComparePanel.js';
import {
  reorderCompareItems,
  sortCompareItemsByCosine,
} from '../../ui/compareCosine.js';
import {
  cosineListHtml,
  groupLegendHtml,
  hasMultipleGroups,
  parseCompareText,
} from '../compareWire.js';

export const COMPARE_COPY = Object.freeze({
  title: 'COMPARE SEQUENCE',
  subtitle: 'Token embeddings vs first (REF) cosine',
  visualize: 'VISUALIZE SEQUENCE',
  visualizing: 'VISUALIZING…',
  tokensLabel: 'Tokens / groups',
  loaded: 'Loaded tokens',
  empty: 'Visualize a sequence to see similarity vs the anchor…',
});

const PRESET_BTNS = Object.freeze([
  { id: 'sample5', label: '5' },
  { id: 'sample20', label: '20' },
  { id: 'sample50', label: '50' },
  { id: 'groupsDemo', label: 'Groups' },
]);

/**
 * @param {string} [textareaValue]
 */
export function comparePanelMarkup(textareaValue = '') {
  const c = COMPARE_COPY;
  const value = textareaValue || getCompareBootstrap().textareaValue;
  return `
    <div id="lab-compare-panel" class="lab-compare" data-chrome="compare">
      <header class="lab-compare__header">
        <h2 class="lab-compare__title">${c.title}</h2>
        <p class="lab-compare__subtitle lab-muted">${c.subtitle}</p>
      </header>

      <label class="lab-field__label" for="lab-compare-tokens">${c.tokensLabel}</label>
      <textarea
        id="lab-compare-tokens"
        class="lab-compare__textarea"
        rows="6"
        spellcheck="false"
      >${value}</textarea>

      <div class="lab-compare__presets" role="group" aria-label="Presets">
        ${PRESET_BTNS.map(
          (p) =>
            `<button type="button" class="lab-btn lab-compare-preset" data-preset="${p.id}">${p.label}</button>`,
        ).join('')}
      </div>

      <button type="button" id="lab-btn-visualize" class="lab-btn lab-btn--primary lab-compare__submit">
        ${c.visualize}
      </button>

      <div class="lab-compare__metrics">
        <span class="lab-muted">${c.loaded}</span>
        <span id="lab-compare-count" class="lab-mono">0</span>
      </div>
      <div id="lab-compare-legend" class="lab-compare__legend" hidden></div>

      <div class="lab-compare__cosine-head">
        <span id="lab-compare-subtitle" class="lab-compare__cosine-sub lab-mono">COSINE SIMILARITY vs —</span>
        <span class="lab-compare__sort">
          <button type="button" class="lab-btn lab-btn--ghost lab-compare-sort" data-sort="desc" title="Highest → lowest" disabled>▼</button>
          <button type="button" class="lab-btn lab-btn--ghost lab-compare-sort" data-sort="asc" title="Lowest → highest" disabled>▲</button>
        </span>
      </div>
      <ul id="lab-compare-list" class="lab-compare-list" aria-live="polite">
        <li class="lab-compare-list__empty lab-muted">${c.empty}</li>
      </ul>
    </div>
  `.trim();
}

/**
 * @param {HTMLElement} container
 * @param {{
 *   onCalculate?: (tokens: string[], tokenMeta: Array) => void|Promise<void>,
 *   onReorder?: (payload: object) => void|Promise<void>,
 * }} [options]
 */
export function mountComparePanel(container, options = {}) {
  if (!container) throw new Error('mountComparePanel requires a container');

  const bootstrap = getCompareBootstrap();
  container.innerHTML = comparePanelMarkup(bootstrap.textareaValue);

  const root = container.querySelector('#lab-compare-panel');
  const textarea = container.querySelector('#lab-compare-tokens');
  const btnVisualize = container.querySelector('#lab-btn-visualize');
  const listEl = container.querySelector('#lab-compare-list');
  const countEl = container.querySelector('#lab-compare-count');
  const legendEl = container.querySelector('#lab-compare-legend');
  const subtitleEl = container.querySelector('#lab-compare-subtitle');
  const sortBtns = [...container.querySelectorAll('.lab-compare-sort')];

  /** @type {Array|null} */
  let items = null;
  let reorderLocked = false;
  let cosineSortBlockedByGroups = false;

  const onCalculate =
    typeof options.onCalculate === 'function' ? options.onCalculate : null;
  const onReorder =
    typeof options.onReorder === 'function' ? options.onReorder : null;

  const setLoading = (loading) => {
    if (!btnVisualize) return;
    btnVisualize.disabled = !!loading;
    btnVisualize.textContent = loading
      ? COMPARE_COPY.visualizing
      : COMPARE_COPY.visualize;
  };

  const syncSortButtons = () => {
    const hasItems = !!(items && items.length > 1);
    const disabled = reorderLocked || !hasItems || cosineSortBlockedByGroups;
    const title = cosineSortBlockedByGroups
      ? 'Disabled while groups are active (preserves group blocks)'
      : null;
    for (const btn of sortBtns) {
      btn.disabled = disabled;
      const dir = btn.getAttribute('data-sort');
      btn.title =
        title ||
        (dir === 'desc' ? 'Highest → lowest' : 'Lowest → highest');
    }
  };

  const syncReorderButtons = () => {
    listEl?.querySelectorAll('.lab-compare-reorder').forEach((btn) => {
      if (reorderLocked) {
        btn.disabled = true;
        return;
      }
      const index = Number(btn.getAttribute('data-index'));
      const dir = btn.getAttribute('data-dir');
      const n = items ? items.length : 0;
      btn.disabled =
        (dir === 'up' && index === 0) || (dir === 'down' && index === n - 1);
    });
  };

  const renderList = (anchor, nextItems) => {
    const word = anchor?.text ?? nextItems?.[0]?.text ?? '—';
    if (subtitleEl) {
      subtitleEl.textContent = `COSINE SIMILARITY vs "${word}"`;
    }
    if (listEl) listEl.innerHTML = cosineListHtml(nextItems);
    syncReorderButtons();
    syncSortButtons();
  };

  const updateCompareResults = (data) => {
    if (!data || !data.items) {
      items = null;
      cosineSortBlockedByGroups = false;
      if (countEl) countEl.textContent = '0';
      if (legendEl) {
        legendEl.hidden = true;
        legendEl.innerHTML = '';
      }
      renderList(null, []);
      return;
    }
    items = data.items.slice();
    if (countEl) countEl.textContent = String(data.count ?? items.length);
    const legend = groupLegendHtml(items);
    if (legendEl) {
      if (legend) {
        legendEl.hidden = false;
        legendEl.innerHTML = legend;
      } else {
        legendEl.hidden = true;
        legendEl.innerHTML = '';
      }
    }
    cosineSortBlockedByGroups = hasMultipleGroups(items);
    const anchor =
      data.anchor ||
      (items[0] ? { index: 0, text: items[0].text } : null);
    renderList(anchor, items);
  };

  const applyReorderResult = (result) => {
    if (!result) return;
    items = result.items;
    cosineSortBlockedByGroups = hasMultipleGroups(items);
    if (countEl) countEl.textContent = String(result.count ?? items.length);
    const legend = groupLegendHtml(items);
    if (legendEl) {
      if (legend) {
        legendEl.hidden = false;
        legendEl.innerHTML = legend;
      } else {
        legendEl.hidden = true;
        legendEl.innerHTML = '';
      }
    }
    renderList(result.anchor, items);
    if (onReorder) {
      reorderLocked = true;
      syncReorderButtons();
      syncSortButtons();
      Promise.resolve(onReorder(result))
        .catch(() => {})
        .finally(() => {
          reorderLocked = false;
          syncReorderButtons();
          syncSortButtons();
        });
    }
  };

  const runVisualize = async () => {
    if (!onCalculate || !textarea) return;
    const parsed = parseCompareText(textarea.value);
    if (!parsed.tokens.length) return;
    try {
      setLoading(true);
      await onCalculate(parsed.tokens, parsed.tokenMeta);
    } finally {
      setLoading(false);
    }
  };

  btnVisualize?.addEventListener('click', () => {
    runVisualize();
  });

  container.querySelectorAll('.lab-compare-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-preset');
      const preset = COMPARE_AUTO_PRESETS[type];
      if (!textarea) return;
      if (typeof preset === 'string') textarea.value = preset;
      else if (Array.isArray(preset)) textarea.value = preset.join(', ');
      runVisualize();
    });
  });

  listEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('.lab-compare-reorder');
    if (!btn || reorderLocked || !items) return;
    e.preventDefault();
    const index = Number(btn.getAttribute('data-index'));
    const delta = btn.getAttribute('data-dir') === 'up' ? -1 : 1;
    applyReorderResult(reorderCompareItems(items, index, delta));
  });

  sortBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (reorderLocked || cosineSortBlockedByGroups || !items) return;
      applyReorderResult(
        sortCompareItemsByCosine(items, btn.getAttribute('data-sort')),
      );
    });
  });

  return {
    root,
    setLoading,
    updateCompareResults,
    getItems: () => (items ? items.slice() : null),
    getTextareaValue: () => textarea?.value ?? '',
    setVisible(visible) {
      if (!root) return;
      root.hidden = !visible;
      root.classList.toggle('is-hidden', !visible);
    },
    runBootstrapVisualize: runVisualize,
  };
}
