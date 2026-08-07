/**
 * VHectorLab-3D `/v25/` bootstrap — Fase 4: header chrome on shell.
 */
import './style.css';
import { mountHeader } from './ui/header.js';
import { mountShell, queryShellZones } from './ui/shell.js';

const app = document.getElementById('app');
if (app) {
  mountShell(app);
  const zones = queryShellZones(app);
  mountHeader(zones.header);
}
