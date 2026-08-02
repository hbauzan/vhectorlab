/**
 * HTTP Remote Provider Client for VectorLab 3D FastAPI Backend.
 *
 * Base URL resolution:
 * - `VITE_API_BASE_URL` if set (preferred; `.env` enables `/api` for Vite proxy / ngrok)
 * - else localhost / 127.0.0.1 → direct `http://127.0.0.1:8000`
 * - else public host → same-origin `/api` (Vite proxy)
 */

/**
 * @param {{ envBase?: string|undefined, hostname?: string }} [opts]
 * @returns {string}
 */
export function resolveApiBaseUrl(opts = {}) {
  const envBase = opts.envBase !== undefined
    ? opts.envBase
    : (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_BASE_URL : undefined);

  if (envBase != null && String(envBase).trim() !== '') {
    return String(envBase).replace(/\/$/, '');
  }

  const hostname = opts.hostname !== undefined
    ? opts.hostname
    : (typeof window !== 'undefined' ? window.location.hostname : 'localhost');

  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://127.0.0.1:8000';
  }

  // Tunneled / remote page: hit Vite (or reverse proxy) same-origin `/api`
  return '/api';
}

/**
 * @param {string} baseUrl
 * @param {string} path  e.g. "/health"
 */
export function apiUrl(baseUrl, path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!baseUrl) return p;
  return `${baseUrl.replace(/\/$/, '')}${p}`;
}

export class RemoteProvider {
  /**
   * @param {string} [baseUrl]
   */
  constructor(baseUrl = resolveApiBaseUrl()) {
    this.baseUrl = String(baseUrl || '').replace(/\/$/, '');
  }

  /**
   * Extra headers for ngrok free interstitial / JSON APIs.
   * @returns {Record<string, string>}
   */
  _headers(extra = {}) {
    const headers = { ...extra };
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    if (host.includes('ngrok') || this.baseUrl.includes('ngrok')) {
      headers['ngrok-skip-browser-warning'] = 'true';
    }
    return headers;
  }

  async checkHealth() {
    try {
      const res = await fetch(apiUrl(this.baseUrl, '/health'), {
        headers: this._headers(),
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const data = await res.json();
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async computeArithmetic(wordA, wordB, wordC, topK = 10) {
    try {
      const res = await fetch(apiUrl(this.baseUrl, '/arithmetic'), {
        method: 'POST',
        headers: this._headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          word_a: wordA,
          word_b: wordB,
          word_c: wordC,
          top_k: topK,
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.detail || `HTTP Error ${res.status}`);
      }

      return await res.json();
    } catch (e) {
      console.error('RemoteProvider arithmetic error:', e);
      throw e;
    }
  }

  async computeEmbedding(text) {
    const res = await fetch(apiUrl(this.baseUrl, '/embed'), {
      method: 'POST',
      headers: this._headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  }

  async computeCompare(texts) {
    try {
      const res = await fetch(apiUrl(this.baseUrl, '/compare'), {
        method: 'POST',
        headers: this._headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ texts }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.detail || `HTTP Error ${res.status}`);
      }

      return await res.json();
    } catch (e) {
      console.error('RemoteProvider compare error:', e);
      throw e;
    }
  }
}
