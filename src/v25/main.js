/**
 * VHectorLab-3D `/v25/` bootstrap — Fase 6: right dock + footer HUD chrome.
 */
import './style.css';
import { mountArithmeticPanel } from './ui/arithmeticPanel.js';
import { mountFooterHud } from './ui/footerHud.js';
import { mountHeader } from './ui/header.js';
import { mountRightDock } from './ui/rightDock.js';
import { mountShell, queryShellZones } from './ui/shell.js';

const app = document.getElementById('app');
if (app) {
  mountShell(app);
  const zones = queryShellZones(app);
  mountHeader(zones.header);
  mountArithmeticPanel(zones.left);
  mountRightDock(zones.right);
  mountFooterHud(zones.footer);
}
