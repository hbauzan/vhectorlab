import path from 'node:path';

/**
 * Vite page inputs. Product UI is a single entry at `/` (MagicWB theme default).
 * Parallel MPA skins `/v25/` and `/amiga/` were retired in 2.4.1.
 *
 * @param {string} rootDir Absolute project root (repo cwd).
 * @returns {{ main: string }}
 */
export function getViteInputs(rootDir) {
  return {
    main: path.resolve(rootDir, 'index.html'),
  };
}

/**
 * Redirect bare MPA dirs to trailing slash. Empty by default (no parallel skins).
 *
 * @param {string} urlPath `req.url` (path + optional query)
 * @param {string[]} mpaDirs Absolute path prefixes without trailing slash
 * @returns {string | null} Location header value, or null if no redirect
 */
export function mpaTrailingSlashLocation(urlPath, mpaDirs = []) {
  const qIndex = urlPath.indexOf('?');
  const pathname = qIndex === -1 ? urlPath : urlPath.slice(0, qIndex);
  const query = qIndex === -1 ? '' : urlPath.slice(qIndex);
  for (const dir of mpaDirs) {
    if (pathname === dir) return `${dir}/${query}`;
  }
  return null;
}

/** Vite plugin: 302 bare MPA dirs → trailing slash (dev + preview). */
export function mpaTrailingSlashRedirect(mpaDirs = []) {
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
