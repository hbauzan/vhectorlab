import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { getViteInputs, mpaTrailingSlashRedirect } from './vite.mpa.js';

/**
 * Dev access via ngrok (phone):
 * 1. Backend local: `cd backend && uv run python -m server` (:8000)
 * 2. Frontend: `npm run dev` (:5173)
 * 3. ONE ngrok tunnel → localhost:5173 only
 *    API calls go same-origin `/api/*` and Vite proxies to :8000.
 *
 * Do NOT point a second ngrok at :8000 with the same hostname — free ngrok
 * gives one public host per agent; two agents need two different URLs.
 */
const NGROK_HOST = 'obsessed-landfall-irritable.ngrok-free.dev';
const rootDir = path.dirname(fileURLToPath(import.meta.url));

const allowedHosts = [
  NGROK_HOST,
  '.ngrok-free.dev',
  '.ngrok.io',
  '.ngrok.app',
];

const apiProxy = {
  '/api': {
    target: 'http://127.0.0.1:8000',
    changeOrigin: true,
    secure: false,
  },
};

export default defineConfig({
  // Avoid SPA fallback masking missing MPA paths as legacy `/`.
  appType: 'mpa',
  plugins: [mpaTrailingSlashRedirect()],
  build: {
    // Three.js + app UI naturally exceeds Vite's default 500 kB advisory.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: getViteInputs(rootDir),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts,
    proxy: apiProxy,
  },
  preview: {
    host: true,
    allowedHosts,
    proxy: apiProxy,
  },
});
