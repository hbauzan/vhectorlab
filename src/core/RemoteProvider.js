/**
 * HTTP Remote Provider Client for VectorLab 3D FastAPI Backend.
 */
export class RemoteProvider {
  constructor(baseUrl = "http://127.0.0.1:8000") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async checkHealth() {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const data = await res.json();
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async computeArithmetic(wordA, wordB, wordC, topK = 10) {
    try {
      const res = await fetch(`${this.baseUrl}/arithmetic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word_a: wordA,
          word_b: wordB,
          word_c: wordC,
          top_k: topK
        })
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.detail || `HTTP Error ${res.status}`);
      }

      return await res.json();
    } catch (e) {
      console.error("RemoteProvider arithmetic error:", e);
      throw e;
    }
  }

  async computeEmbedding(text) {
    const res = await fetch(`${this.baseUrl}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  }

  async computeCompare(texts) {
    try {
      const res = await fetch(`${this.baseUrl}/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts })
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.detail || `HTTP Error ${res.status}`);
      }

      return await res.json();
    } catch (e) {
      console.error("RemoteProvider compare error:", e);
      throw e;
    }
  }
}
