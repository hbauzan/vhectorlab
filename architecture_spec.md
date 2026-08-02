# Architecture Specification - VectorLab 3D

## System Architecture

VectorLab 3D is a 3D semantic vector visualizer and vector arithmetic explorer.

### Backend Tier (`backend/`)
- **Framework**: FastAPI with Uvicorn.
- **Model Interface**: Lazy-loaded `SentenceTransformer('all-mpnet-base-v2')` in FastAPI `lifespan`.
- **Vocabulary Acceleration**: Pre-computed L2-normalized embedding matrix $(N \times D)$ kept in RAM for instant matrix-vector dot product cosine similarity calculation:
  $$\text{Sim}(V_{res}, V_{vocab}) = V_{vocab} \cdot V_{res}^T$$
- **CORS Policy**: `allow_origins=["*"]` with `allow_credentials=False` for cross-origin WebGL clients.

### API Surface
- `GET /health`: Server status, model name, and vocabulary size.
- `POST /embed`: Computes embedding vector for input text.
- `POST /tokenize`: Returns tokenization details.
- `POST /arithmetic`: Computes $V_{res} = V_A - V_B + V_C$ and returns top-$K$ nearest vocabulary words and component vectors.
- `POST /compare`: Batch-encodes 1–1024 texts, L2-normalizes embeddings, and returns per-item cosine vs the first token (anchor).

### Data Contracts

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
`cosine_vs_first` is $\text{dot}(\hat{e}_i, \hat{e}_0)$ on L2-normalized embeddings. Frontend reorders may recompute scores in memory without re-calling `/compare`.
