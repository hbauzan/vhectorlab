# Architecture Specification - VHectorLab 3D

## System Architecture

VHectorLab 3D is a 3D semantic vector visualizer and vector arithmetic explorer.

### Backend Tier (`backend/`)
- **Framework**: FastAPI with Uvicorn.
- **Model Interface**: Lazy-loaded `SentenceTransformer` via catalog selection (`MODEL_PROFILE` / `MODEL_NAME` / `TRUNCATE_DIM`) in FastAPI `lifespan`. Catalog module: `backend/model_catalog.py` (`resolve_selection_from_env`, `build_model`, `encode_texts`). Each catalog selection and named profile carries `family` (`ModelFamily`) and `memory_tier` (`MemoryTier`). A Hub ID outside the ten-model table still resolves with the same encode flags; `family` is the publisher when the org is one of the six families, otherwise `null`, and `memory_tier` stays `null` (weight is not guessed). Neither field is on `GET /health`.
- **Hardware inspector**: `backend/hardware_inspector.get_hardware_profile()` returns a frozen `HardwareProfile` (OS, CPU brand, core count, total and available RAM in bytes, accelerator `mps`|`cuda`|`cpu`). Not mounted on the HTTP API.
- **Micro-benchmark**: `backend/benchmark_runner.run_model_benchmark()` times one catalog `ModelSelection` on a 500-item deck sampled from `public/vocab_en_es.txt` with seed 42 (or an explicit deck). It records cold load, a 32-item warmup, the median of 3 encode runs, peak RAM, and `estimated_vocab_sec = round(N / throughput_wps, 2)` where `N` is the non-empty line count of that vocab file (10338 on the current file) and `throughput_wps = len(deck) / median_sec`. MPS calls `torch.mps.synchronize()` before the clock stops; CUDA calls `torch.cuda.synchronize()`. Peak RAM is the larger of the process RSS increase and the accelerator-allocation increase, not their sum. The CLI `scripts/benchmark_models.py` writes `backend/artifacts/benchmark_cache.json` atomically (temp file + replace), keyed by Hub id. A Hub id already in the local Hugging Face cache is loaded with `local_files_only` so the clock does not include a Hub round-trip. Loader progress bars are suppressed. That file is machine-local and gitignored. The benchmark does not read or write `.env` and is not mounted on the HTTP API. A Hub id with no measured `memory_tier` is refused.
- **Encode adapter**: All query/vocab encoding goes through `encode_texts` (E5 `query:` prefixes when `e5_mode`, optional Matryoshka `truncate_dim`, L2 normalize). Frontend never applies model-specific quirks.
- **Vocabulary Acceleration**: Pre-computed L2-normalized embedding matrix $(N \times D)$ kept in RAM for instant matrix-vector dot product cosine similarity calculation:
  $$\text{Sim}(V_{res}, V_{vocab}) = V_{vocab} \cdot V_{res}^T$$
- **Structural noise**: `backend/structural_noise.detect_structural_noise` classifies saturated and flat coordinates on a matrix. The engine router runs it on `state.vocab_embeddings` when that matrix has at least 2 rows; otherwise it encodes up to 500 lines from `public/vocab_en_es.txt` (fallback `public/vocab.txt`) through `encode_texts`. Indices are computed per matrix. They are not hardcoded.
- **Noise profile cache**: RAM on `AppState.noise_profile`, cleared when `load_model_and_vocab` actually starts a load. Disk JSON at `backend/artifacts/noise_profiles/{safe_id}.json` (`/` `\` and spaces in the Hub id become `_`). That directory is gitignored. `POST` returns RAM, then disk, unless `force_recompute` is true (JSON body or query; the query wins when present).
- **SAE dim safety**: On load, if session SAE `input_dim` ≠ active `embedding_dim`, SAE RAM + checkpoint are cleared automatically.
- **Vocab NPZ**: Prefer `VOCAB_EMBEDDINGS_PATH` when present. Keys: `words`, `embeddings`, `model_name`, `embedding_dim`, optional `truncate_dim`, `vocab_source_sha256` (SHA-256 of the source vocabulary text file), and `computed_device` (`'mps'`|`'cpu'`|`'cuda'`). **Mismatch strategy**: if `model_name`, effective width, or `vocab_source_sha256` disagrees with the active catalog selection or source text, log a warning, re-encode from `VOCAB_PATH` via `encode_texts`, and overwrite the NPZ (local DX auto-rebuild). Precomputation on Mac utilizes MPS for high performance and numerical harmony with live queries; Linux/Docker uses CPU. Cross-platform equivalence is governed by geometric tolerance ($\text{cosine\_drift} < 10^{-6}$), never by byte-level SHA-256.
- **CORS Policy**: `allow_origins=["*"]` with `allow_credentials=False` for cross-origin WebGL clients.

### API Surface
- `GET /health`: Server status, model Hub id, optional `model_profile`, `embedding_dim`, `truncate_dim`, vocabulary size, runtime `device` (`cpu`|`cuda`|`mps`), `vocab_source_sha256`, `vocab_file_sha256`, and `vocab_device`.
- `POST /embed`: Computes embedding vector for input text.
- `POST /tokenize`: Returns tokenization details.
- `POST /arithmetic`: Computes $V_{res} = V_A - V_B + V_C$ and returns top-$K$ nearest vocabulary words and component vectors.
- `POST /compare`: Batch-encodes 1–1024 texts, L2-normalizes embeddings, and returns per-item cosine vs the first token (anchor), plus batch coordinate `extrema` (`min`, `max`).
- `POST /project`: Projects precomputed embedding vectors to 2D/3D (does **not** re-encode text). v1 method = **`umap` only**; `pca` / `tsne` → **501**; other methods → **400**. Default seed `42`. When `dim > 50`, internal PCA→50 before UMAP. Positions are zero-mean and RMS-scaled server-side.
- `GET /engine/status`: Active model name, profile, embedding dim, accelerator (`state.device`), load flag, whether a noise profile is cached, vocabulary size. HTTP 200.
- `POST /engine/detect-structural-noise`: Optional JSON `{force_recompute, sat_threshold_z, flat_threshold_sigma}`. Returns the noise profile. HTTP 503 when no matrix and no usable model. HTTP 422 on a malformed body.
- `GET /engine/noise-profile`: Cached profile from RAM or disk. HTTP 404 when neither exists.

Routes above are also mounted under `/api`.

### Data Contracts

#### Health
```json
{
  "status": "ok",
  "model": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
  "model_profile": "local-comfort",
  "short_label": "MiniLM-multi",
  "embedding_dim": 384,
  "truncate_dim": null,
  "device": "mps",
  "is_loaded": true,
  "vocab_size": 12345,
  "vocab_source_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "vocab_file_sha256": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  "vocab_device": "mps"
}
```
`model_profile` / `truncate_dim` / `short_label` may be `null` when unset. `embedding_dim` is the effective width after truncate. Navbar ONLINE chip uses profile (if any) · short_label · `{D}D` · device.

#### Arithmetic
```json
{
  "word_a": "king",
  "word_b": "man",
  "word_c": "woman",
  "top_k": 10
}
```
Returns:
```json
{
  "inputs": {"word_a": "king", "word_b": "man", "word_c": "woman"},
  "vector_res": [0.01, ..., 0.05],
  "components": {"vec_a": [...], "vec_b": [...], "vec_c": [...]},
  "results": [
    {"word": "queen", "score": 0.892, "token_id": 42}
  ]
}
```

#### Compare
```json
{ "texts": ["king", "queen", "man"] }
```
Returns:
```json
{
  "count": 3,
  "anchor": { "index": 0, "text": "king" },
  "extrema": { "min": -0.1852, "max": 0.2140 },
  "items": [
    {
      "id": "tok_0",
      "index": 0,
      "text": "king",
      "embedding": [0.01, "..."],
      "cosine_vs_first": 1.0
    }
  ]
}
```
`cosine_vs_first` is $\text{dot}(\hat{e}_i, \hat{e}_0)$ on L2-normalized embeddings. `extrema` reports global $\min$ and $\max$ coordinates across the encoded batch for adaptive frontend amplitude scaling. Frontend reorders may recompute scores in memory without re-calling `/compare`.

#### Project (Galaxy / UMAP)
```json
{
  "vectors": [[0.01, "..."], ["..."]],
  "method": "umap",
  "n_components": 3,
  "seed": 42,
  "params": { "n_neighbors": 15, "min_dist": 0.1, "metric": "cosine" }
}
```
Constraints: `len(vectors)` ∈ 1..1024; uniform row dim; `n_components` ∈ {2, 3}; `method` = `umap` (green path).

Returns:
```json
{
  "method": "umap",
  "n_components": 3,
  "positions": [[x, y, z], "..."],
  "meta": {
    "seed": 42,
    "n_neighbors": 15,
    "min_dist": 0.1,
    "metric": "cosine",
    "pre_pca_dims": 50
  }
}
```
`meta.pre_pca_dims` is present only when the internal PCA pre-step ran. Encoding stays on `/compare` (or SAE encode); `/project` is additive.

#### Engine noise profile
```json
{
  "model_name": "BAAI/bge-m3",
  "embedding_dim": 1024,
  "noise_indices": [38, 58, 65, 80, 297, 329, 376, 386, 404, 549, 577, 616, 780],
  "saturated_indices": [38, 58, 65, 80, 297, 376, 386, 404, 549, 577, 780],
  "flat_indices": [329, 616],
  "energy_ratio": 0.198,
  "cosine_delta": 0.1152,
  "timestamp_utc": "2026-10-26T20:00:00.000000+00:00"
}
```
The index arrays, `energy_ratio`, and `cosine_delta` are the measured result for the current `public/vocab_embeddings.npz` (10338×1024, `BAAI/bge-m3`). `timestamp_utc` in the sample is illustrative. Another matrix returns another set. `energy_ratio` is noise-coordinate \(L_2^2\) over total \(L_2^2\), rounded to 4 decimals. `cosine_delta` is mean pairwise cosine on a 500-row `RandomState(42)` sample, raw minus pruned, rounded to 4 decimals. `GET /engine/status` adds `accelerator`, `is_loaded`, `has_cached_profile`, `vocab_size`, and `model_profile`.

The workbench sheet calls these routes through `RemoteProvider.getEngineStatus`, `detectStructuralNoise` (`forceRecompute` → `force_recompute`), and `getEngineNoiseProfile`. The sheet prints `energy_ratio × 100` as `NN.NN% L2 Norm` and `cosine_delta` as a signed drop. It prints `raw → pruned` only when the payload also carries both means. Pills are `saturated_indices` and `flat_indices` from the response. The pruning-shield and dual-path toggles do not alter this API. While the shield is on, the client recomputes Compare cosine with those `noise_indices` removed and keeps the same coordinates out of Spectral Quorum admission. The dual-path toggle does not draw a second ribbon.
