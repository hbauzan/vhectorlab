/**
 * VHectorLab-3D `/v25/` bootstrap — Fase 3: 5-zone layout shell.
 */
import './style.css';
import { mountShell } from './ui/shell.js';

const app = document.getElementById('app');
if (app) {
  mountShell(app);
}
