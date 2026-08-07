/**
 * VHectorLab-3D `/v25/` bootstrap — Fase 5: Arithmetic chrome (no API).
 */
import './style.css';
import { mountArithmeticPanel } from './ui/arithmeticPanel.js';
import { mountHeader } from './ui/header.js';
import { mountShell, queryShellZones } from './ui/shell.js';

const app = document.getElementById('app');
if (app) {
  mountShell(app);
  const zones = queryShellZones(app);
  mountHeader(zones.header);
  mountArithmeticPanel(zones.left);
}
