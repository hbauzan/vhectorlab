/**
 * VHectorLab-3D `/v25/` bootstrap — Fase 8: canvas host + engine reuse.
 */
import { RemoteProvider } from '../core/RemoteProvider.js';
import { fetchArithmeticResults } from './arithmeticWire.js';
import { mountCanvasHost } from './canvasHost.js';
import './style.css';
import { mountArithmeticPanel } from './ui/arithmeticPanel.js';
import { mountFooterHud } from './ui/footerHud.js';
import { mountHeader } from './ui/header.js';
import { createLabModal } from './ui/labModal.js';
import { mountRightDock } from './ui/rightDock.js';
import { mountShell, queryShellZones } from './ui/shell.js';

const app = document.getElementById('app');
if (app) {
  const provider = new RemoteProvider();
  const modal = createLabModal();

  mountShell(app);
  const zones = queryShellZones(app);
  const header = mountHeader(zones.header);

  /** @type {{ updateResults: Function, setLoading: Function, getValues: Function } | null} */
  let arithmetic = null;

  const footer = mountFooterHud(zones.footer);
  const canvas = mountCanvasHost(zones.canvas, {
    onHover(payload) {
      footer.setCoords(payload.coords);
      footer.setTelemetry({
        segment: payload.segment,
        activation: payload.activation,
        token: payload.token,
      });
    },
  });

  const runCalculate = async (words) => {
    if (!arithmetic) return;
    try {
      arithmetic.setLoading(true);
      const { results, raw } = await fetchArithmeticResults(provider, words);
      arithmetic.updateResults(results);
      canvas.renderArithmetic(raw);
    } catch (err) {
      const message =
        err?.message ||
        'Arithmetic request failed. Check that the backend is running.';
      modal.show('ARITHMETIC ERROR', message);
    } finally {
      arithmetic.setLoading(false);
    }
  };

  arithmetic = mountArithmeticPanel(zones.left, {
    onCalculate: runCalculate,
  });
  mountRightDock(zones.right);

  provider.checkHealth().then(async (health) => {
    header.setOnline(Boolean(health?.ok));
    if (!health?.ok) {
      modal.show(
        'BACKEND OFFLINE',
        'The FastAPI backend is not reachable. Start the stack with ./setup.sh (option 1), or open this app from a running Hugging Face Space.',
      );
      return;
    }
    // Same happy-path as legado: Top-10 + threads on boot.
    await runCalculate(arithmetic.getValues());
  });
}
