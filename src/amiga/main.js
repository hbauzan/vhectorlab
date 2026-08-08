/**
 * `/amiga/` entry — MagicWB shell + legacy product wire (no src/v25).
 */
import './style.css';
import { AmigaApp } from './AmigaApp.js';

window.addEventListener('DOMContentLoaded', () => {
  // eslint-disable-next-line no-new
  new AmigaApp();
});
