/**
 * VHectorLab-3D `/v25/` bootstrap — Fase 7: Arithmetic → RemoteProvider (canvas stub).
 */
import { RemoteProvider } from '../core/RemoteProvider.js';
import { fetchArithmeticResults } from './arithmeticWire.js';
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
  const arithmetic = mountArithmeticPanel(zones.left, {
    async onCalculate(words) {
      try {
        const { results } = await fetchArithmeticResults(provider, words);
        arithmetic.updateResults(results);
      } catch (err) {
        const message =
          err?.message ||
          'Arithmetic request failed. Check that the backend is running.';
        modal.show('ARITHMETIC ERROR', message);
      }
    },
  });
  mountRightDock(zones.right);
  mountFooterHud(zones.footer);

  provider.checkHealth().then((health) => {
    header.setOnline(Boolean(health?.ok));
    if (!health?.ok) {
      modal.show(
        'BACKEND OFFLINE',
        'The FastAPI backend is not reachable. Start the stack with ./setup.sh (option 1), or open this app from a running Hugging Face Space.',
      );
    }
  });
}
