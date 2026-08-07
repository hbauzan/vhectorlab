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

/**
 * Vite SPA fallback treats `/v25` (no slash) as unknown → serves legacy `index.html`.
 * Redirect bare MPA dirs to their trailing-slash URL.
 *
 * @param {string} urlPath `req.url` (path + optional query)
 * @param {string[]} mpaDirs Absolute path prefixes without trailing slash
 * @returns {string | null} Location header value, or null if no redirect
 */
export function mpaTrailingSlashLocation(urlPath, mpaDirs = ['/v25']) {
  const qIndex = urlPath.indexOf('?');
  const pathname = qIndex === -1 ? urlPath : urlPath.slice(0, qIndex);
  const query = qIndex === -1 ? '' : urlPath.slice(qIndex);
  for (const dir of mpaDirs) {
    if (pathname === dir) return `${dir}/${query}`;
  }
  return null;
}

/** Vite plugin: 302 `/v25` → `/v25/` (dev + preview). */
export function mpaTrailingSlashRedirect(mpaDirs = ['/v25']) {
  const attach = (middlewares) => {
    middlewares.use((req, res, next) => {
      const location = mpaTrailingSlashLocation(req.url || '', mpaDirs);
      if (!location) {
        next();
        return;
      }
      res.statusCode = 302;
      res.setHeader('Location', location);
      res.end();
    });
  };
  return {
    name: 'mpa-trailing-slash-redirect',
    configureServer(server) {
      attach(server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
    },
  };
}
