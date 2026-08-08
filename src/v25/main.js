/**
 * VHectorLab-3D `/v25/` bootstrap — Fase 11: viz filters live + SAE on Compare.
 */
import { RemoteProvider } from '../core/RemoteProvider.js';
import {
  loadSaeSettings,
  saveSaeSettings,
} from '../ui/saeControlsDefaults.js';
import { loadVisualizationSettings } from '../ui/visualizationControlsDefaults.js';
import { fetchArithmeticResults } from './arithmeticWire.js';
import { canvasStartupContext, mountCanvasHost } from './canvasHost.js';
import { fetchCompareResults } from './compareWire.js';
import { leftPanelVisibility } from './leftPanelMode.js';
import { createSaeController } from './saeController.js';
import './style.css';
import { mountArithmeticPanel } from './ui/arithmeticPanel.js';
import { mountComparePanel } from './ui/comparePanel.js';
import { mountFooterHud } from './ui/footerHud.js';
import { mountHeader } from './ui/header.js';
import { createLabModal } from './ui/labModal.js';
import { mountRightDock } from './ui/rightDock.js';
import { mountShell, queryShellZones } from './ui/shell.js';

const app = document.getElementById('app');
if (app) {
  const provider = new RemoteProvider();
  const modal = createLabModal();
  const initialViz = loadVisualizationSettings();

  mountShell(app);
  const zones = queryShellZones(app);

  zones.left.innerHTML = `
    <div class="lab-left-host">
      <div data-panel="arithmetic"></div>
      <div data-panel="compare" hidden></div>
    </div>
  `;
  const arithmeticSlot = zones.left.querySelector('[data-panel="arithmetic"]');
  const compareSlot = zones.left.querySelector('[data-panel="compare"]');

  /** @type {{ updateResults: Function, setLoading: Function, getValues: Function } | null} */
  let arithmetic = null;
  /** @type {ReturnType<typeof mountComparePanel> | null} */
  let compare = null;
  /** @type {'ARITHMETIC'|'COMPARE'} */
  let workspaceMode = 'ARITHMETIC';

  const footer = mountFooterHud(zones.footer);
  const canvas = mountCanvasHost(zones.canvas, {
    initialViz,
    onHover(payload) {
      footer.setCoords(payload.coords);
      footer.setTelemetry({
        segment: payload.segment,
        dim: payload.dim,
        activation: payload.activation,
        token: payload.token,
      });
    },
  });

  const rightDock = mountRightDock(zones.right, {
    spatialContext: canvasStartupContext(),
    initialViz,
    onSpatialChange(values) {
      canvas.setSpatialConfig(values);
    },
    onVizChange(values) {
      canvas.setVizConfig(values);
    },
  });

  /** @type {ReturnType<typeof createSaeController> | null} */
  let sae = null;

  const applyModeToLeft = (mode) => {
    const vis = leftPanelVisibility(mode);
    if (arithmeticSlot) {
      arithmeticSlot.hidden = vis.arithmeticHidden;
      arithmeticSlot.classList.toggle('is-hidden', vis.arithmeticHidden);
    }
    if (compareSlot) {
      compareSlot.hidden = vis.compareHidden;
      compareSlot.classList.toggle('is-hidden', vis.compareHidden);
    }
    const arithRoot = zones.left.querySelector('#lab-arithmetic-panel');
    if (arithRoot) {
      arithRoot.hidden = vis.arithmeticHidden;
      arithRoot.classList.toggle('is-hidden', vis.arithmeticHidden);
    }
    compare?.setVisible(!vis.compareHidden);
  };

  const syncSpatialUiFromCanvas = (spatial) => {
    rightDock.setSpatialContext(canvas.context);
    rightDock.syncSpatial(spatial);
  };

  const runCalculate = async (words) => {
    if (!arithmetic) return;
    try {
      arithmetic.setLoading(true);
      const { results, raw } = await fetchArithmeticResults(provider, words);
      arithmetic.updateResults(results);
      canvas.renderArithmetic(raw);
    } catch (err) {
      modal.show(
        'ARITHMETIC ERROR',
        err?.message || 'Arithmetic request failed. Check that the backend is running.',
      );
    } finally {
      arithmetic.setLoading(false);
    }
  };

  const runCompare = async (tokens, tokenMeta) => {
    try {
      compare?.setLoading(true);
      const { data } = await fetchCompareResults(provider, tokens, tokenMeta);
      compare?.updateCompareResults(data);
      canvas.renderCompare(data);
      sae?.rememberRawCompare(data);
      // Fresh Visualize leaves SAE OFF visually if it was encoding a prior scope.
      if (sae?.getSettings()?.enabled) {
        sae.forceDisable();
      }
    } catch (err) {
      modal.show(
        'COMPARE ERROR',
        err?.message || 'Compare request failed. Check that the backend is running.',
      );
    } finally {
      compare?.setLoading(false);
    }
  };

  const runCompareReorder = async (payload) => {
    try {
      await canvas.reorderCompare(payload);
    } catch (err) {
      modal.show(
        'COMPARE ERROR',
        err?.message || 'Could not reorder compare threads.',
      );
    }
  };

  const handleWorkspaceMode = async (mode) => {
    const next = mode === 'COMPARE' ? 'COMPARE' : 'ARITHMETIC';
    if (next === workspaceMode && canvas.getWorkspaceMode() === next) {
      applyModeToLeft(next);
      return;
    }
    if (next === 'ARITHMETIC' && sae?.getSettings()?.enabled) {
      sae.forceDisable();
    }
    workspaceMode = next;
    applyModeToLeft(next);
    const { spatial, viewMode } = canvas.setWorkspaceMode(next);
    header.setSelection('view', viewMode);
    syncSpatialUiFromCanvas(spatial);

    if (next === 'COMPARE') {
      if (!canvas.hasCompareData()) {
        await compare?.runBootstrapVisualize();
      } else {
        canvas.refreshGeometry();
        const items = compare?.getItems();
        if (items) {
          compare.updateCompareResults({
            count: items.length,
            anchor: items[0] ? { index: 0, text: items[0].text } : null,
            items,
          });
        }
      }
      sae?.refreshStatus();
    } else if (canvas.hasArithmeticData()) {
      canvas.refreshGeometry();
    }
  };

  const header = mountHeader(zones.header, {
    onChange(state) {
      if (
        (state.workspace === 'COMPARE' || state.workspace === 'ARITHMETIC') &&
        state.workspace !== workspaceMode
      ) {
        handleWorkspaceMode(state.workspace);
      }
    },
  });

  arithmetic = mountArithmeticPanel(arithmeticSlot, {
    onCalculate: runCalculate,
  });

  // Mount Compare first so saeUi exists, then wire controller.
  compare = mountComparePanel(compareSlot, {
    onCalculate: runCompare,
    onReorder: runCompareReorder,
    onSaeToggle: (enabled) => sae?.onToggle(enabled),
    onSaeTrain: (settings) => sae?.onTrain(settings),
    getSaeSettings: () => (sae ? sae.getSettings() : loadSaeSettings()),
    setSaeSettings: (s) => {
      if (sae) sae.setSettings(s);
      else saveSaeSettings(s);
    },
  });

  sae = createSaeController({
    provider,
    canvas,
    compare,
    rightDock,
    modal,
    getWorkspaceMode: () => workspaceMode,
  });
  compare.saeUi?.syncFromSettings();

  applyModeToLeft('ARITHMETIC');

  provider.checkHealth().then(async (health) => {
    header.setOnline(Boolean(health?.ok));
    if (!health?.ok) {
      modal.show(
        'BACKEND OFFLINE',
        'The FastAPI backend is not reachable. Start the stack with ./setup.sh (option 1), or open this app from a running Hugging Face Space.',
      );
      return;
    }
    await runCalculate(arithmetic.getValues());
  });
}
