# Architecture Specification - VHectorLab 3D

## System Architecture

VHectorLab 3D is a 3D semantic vector visualizer and vector arithmetic explorer.

### Backend Tier (`backend/`)
- **Framework**: FastAPI with Uvicorn.
- **Model Interface**: Lazy-loaded `SentenceTransformer` via catalog selection (`MODEL_PROFILE` / `MODEL_NAME` / `TRUNCATE_DIM`) in FastAPI `lifespan`. Catalog module: `backend/model_catalog.py` (`resolve_selection_from_env`, `build_model`, `encode_texts`).
- **Encode adapter**: All query/vocab encoding goes through `encode_texts` (E5 `query:` prefixes when `e5_mode`, optional Matryoshka `truncate_dim`, L2 normalize). Frontend never applies model-specific quirks.
- **Vocabulary Acceleration**: Pre-computed L2-normalized embedding matrix $(N \times D)$ kept in RAM for instant matrix-vector dot product cosine similarity calculation:
  $$\text{Sim}(V_{res}, V_{vocab}) = V_{vocab} \cdot V_{res}^T$$
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
