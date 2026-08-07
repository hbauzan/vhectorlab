import path from 'node:path';

/**
 * Vite multi-page inputs: legacy `/` + parallel skin `/v25/`.
 * Keep keys stable — build emits `dist/index.html` and `dist/v25/index.html`.
 *
 * @param {string} rootDir Absolute project root (repo cwd).
 * @returns {{ main: string, v25: string }}
 */
export function getViteInputs(rootDir) {
  return {
    main: path.resolve(rootDir, 'index.html'),
    v25: path.resolve(rootDir, 'v25/index.html'),
  };
}
