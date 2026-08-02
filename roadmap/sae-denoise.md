# Roadmap — Top‑K SAE Clean/Denoise (trained Sparse Autoencoder)

**Status:** Ready for implementation handoff  
**Date:** 2026-08-02  
**Product:** VectorLab 3D (`lsv2`)  
**Prompt companion:** [`PROMPT-sae-denoise.md`](./PROMPT-sae-denoise.md)  
**Version on ship:** **MAJOR `2.0.0`**  
**Reference:** Top‑K SAE from the predecessor tool (“grandmother”) — `TopKSAE` / `SAEManager` / train + encode API (see §0.2).

> **Do not re-ask closed decisions** below.  
> **Supersedes** the earlier draft that used deterministic sinusoidal “SAE-style” projection. That approach is **rejected**.  
> Supersedes archived non-goal “NO SAE” in `roadmap/archivo/big-picture.md`.

---

## 0. Goal (one sentence)

Add **Clean/Denoise (SAE)** as a 50/50 toggle beside Calculate / Visualize that runs a **trained Top‑K Sparse Autoencoder** (768D → 8192 sparse features, default K=32), **replaces** all Arithmetic/Compare vectors used for 3D + metrics while ON, with train/encode/status on the backend, UI params, `localStorage`, and batch progress — shipped as **v2.0.0**.

---

## 0.1. Closed decisions (authoritative)

| ID | Topic | Decision |
| :--- | :--- | :--- |
| **U1** | Button layout | Same row, **50/50**: Arithmetic `[ CALCULATE VECTOR \| Clean/Denoise (SAE) ]`; Compare `[ VISUALIZE SEQUENCE (3D) \| Clean/Denoise (SAE) ]`. |
| **U2** | Label | Exact: **`Clean/Denoise (SAE)`**. |
| **U3** | Interaction | **Toggle** (`aria-pressed`). |
| **U4** | Persistence | `localStorage` prefix `vl3d.sae.` (enabled + UI params). |
| **U5** | Params UI | Expose at least **Top‑K** (and optionally hidden_dim if already trained — prefer read-only from `/sae/status` after train). Train hyperparams in a small panel or modal (hidden_dim, k, epochs, lr, batch_size). |
| **M1** | Semantics | **Replace (6A)**: SAE ON → 3D + Top-10/cosine use **SAE activations** (8192D sparse). OFF → restore cached **raw 768D**. |
| **M2** | Scope | **All** vectors: Arithmetic A/B/C/res/top1; Compare every item embedding. |
| **A1** | Algorithm | **Real Top‑K SAE** (PyTorch `nn.Module`), **not** L1-penalty SAE, **not** sinusoidal fixed projection. |
| **A2** | Why Top‑K | Avoids L1 shrinkage bias; exactly ≤K latents active per vector; magnitudes of survivors preserved. |
| **A3** | Dims | Default **input_dim=768**, **hidden_dim=8192**, **k=32** (overridable at train time; encode uses checkpoint config). |
| **A4** | Encode path | Center by `b_dec` → `ReLU(x_c @ W_enc + b_enc)` → **Top‑K in FP32** → scatter back (dead-neuron / overflow stability). |
| **A5** | Decode | Untied `W_dec` with **unit-norm rows**; `decode` used in **training** (MSE recon). Inference for viz uses **`encode` activations** (sparse 8192D), matching grandmother `encode_vectors`. |
| **A6** | Viz space | SAE ON → threads length **`hidden_dim`** (sparse peaks). RAW → 768. |
| **A7** | Metrics (runtime) | From activations batch: L0 / sparsity / active feature count; from checkpoint: train MSE, dead features % (show via status). |
| **B1** | Runtime | Backend FastAPI + PyTorch (`uv`). |
| **B2** | Lazy load | **9A**: load checkpoint on first encode/status that needs weights. |
| **B3** | Batch + progress | Encode/train always communicate progress (step text + current/total). Train = background (`asyncio.to_thread` / task) + poll status or WS — grandmother used async train; port that pattern. |
| **B4** | API surface (mirror grandmother) | At minimum: `GET /api/sae/status`, `POST /api/sae/train`, `POST /api/sae/encode`. Optional later: relief-matrix style helper if needed — VectorLab can encode inline batches instead. |
| **B5** | Train data | Train on the project **vocabulary embedding matrix** (already in backend RAM / `vocab`) unless blocked — document path. Do **not** require PDF chunk pipeline from grandmother. |
| **B6** | Checkpoint | e.g. `backend/artifacts/sae_weights.pt` (gitignore large binaries; ship empty dir + README; train produces file). |
| **F1** | Feature id collision | If any client dict keys dims: RAW `raw_{i}`, SAE `sae_{i}` (grandmother isolation). |
| **X1** | Out of scope v1 | Gemini/LLM auto-label of features; click-peak concept browser; sinusoidal fake SAE; dual simultaneous RAW+SAE meshes; Neuronpedia UI. |
| **V1** | Version | **`2.0.0`** MAJOR. |

### 0.2. Normative model (from grandmother — port faithfully)

```text
TopKSAE(input_dim=768, hidden_dim=8192, k=32)
  b_dec ∈ R^{D}
  W_enc ∈ R^{D×H}, b_enc ∈ R^{H}
  W_dec ∈ R^{H×D}   # untied; rows L2-normalized after each train step

encode(x):
  x_c = x - b_dec
  pre = ReLU(x_c @ W_enc + b_enc)
  acts = TopK(pre, k) in FP32  # exactly k nonzeros (or fewer if ties/zeros)
  return acts ∈ R^{H}

decode(acts):
  return acts @ W_dec + b_dec

forward(x) → (reconstruction, acts)
train: Adam + MSE(reconstruction, x); after each step make_decoder_weights_unit_norm()
```

Port `TopKSAE`, `SAEManager`, `train_sae` into `backend/sae/` with tests. Adapt imports/paths to this repo; keep numerical behavior.

### 0.3. UI parameters

| Control | Default | Notes |
| :--- | :--- | :--- |
| Toggle SAE | off | Needs trained checkpoint; else CTA → prompt to train or disable with message |
| Top‑K (infer override?) | use checkpoint `k` | v1: **inference K = checkpoint K** (simpler). Optional later: override K at encode if model supports it |
| Train: hidden_dim | 8192 | |
| Train: k | 32 | |
| Train: epochs | 50 | |
| Train: lr | 1e-3 | |
| Train: batch_size | 64 | |

**Train entry point:** button/link near SAE controls: `Train SAE` (only when needed). Progress: epoch i/N + loss.

### 0.4. Progress contract

**Encode batch (N vectors):**  
`Loading SAE…` → `Encoding (i/N)…` → `Updating 3D + metrics…`

**Train:**  
`Preparing vocab matrix…` → `Epoch e/E (loss=…)` → `Saving checkpoint…` → `Ready`

Always show label + step index/total (+ bar if slow).

---

## 1. Product copy (EN)

| UI | Copy |
| :--- | :--- |
| Toggle | `Clean/Denoise (SAE)` |
| Train | `Train SAE` |
| Status empty | `SAE not trained — train on vocabulary first` |
| Metrics | `L0`, `Sparsity`, `Active features`, `Train MSE`, `Dead features` |

---

## 2. UX / layout

```
Arithmetic:
  [ CALCULATE VECTOR | Clean/Denoise (SAE) ]
  [ Train SAE ]   + compact train params (or modal)
  metrics strip when trained / when SAE on
  Top-10 …

Compare:
  [ VISUALIZE SEQUENCE (3D) | Clean/Denoise (SAE) ]
  same train/status/metrics pattern
```

- No data yet + SAE ON → “Calculate / Visualize first”.
- Not trained + SAE ON → “Train SAE first” (don’t crash).

---

## 3. Technical design

### 3.1. Backend

| Module | Role |
| :--- | :--- |
| `backend/sae/sae_model.py` | `TopKSAE`, `SAEManager` (lazy load, `encode_vectors`) |
| `backend/sae/train_sae.py` | `train_sae(...)` + metrics (MSE, sparsity, dead features) |
| `backend/routers/sae.py` | `/api/sae/status`, `/train`, `/encode` |
| `backend/artifacts/` | checkpoint path; gitignore `*.pt` |
| Tests | `backend/tests/test_sae_model.py` (encode shape, top‑k count, unit-norm dec); train smoke on tiny synthetic matrix |

Wire router under `/api` (Vite proxy §6.1).

### 3.2. Frontend

| Module | Role |
| :--- | :--- |
| `saeControlsDefaults.js` | localStorage + defaults |
| Sidebar / ComparePanel | 50/50 CTA + train + progress |
| `RemoteProvider` | `saeStatus`, `saeTrain`, `saeEncode` |
| App state | raw vs sae caches; `featureSpace: 'RAW' \| 'SAE'` |
| Instancer | variable dim (768 vs 8192) already OK if embeddings replaced |

### 3.3. Data flow

```
Boot → GET /sae/status
Train (optional) → progress → checkpoint
Calculate/Visualize → cache RAW 768
Toggle SAE ON → POST /sae/encode(all vectors) → replace → refreshRender + lists
Toggle OFF → restore RAW
```

### 3.4. Versioning

Ship **`2.0.0`**. CHANGELOG must say: trained Top‑K SAE; sparse feature space when ON; not L1 SAE.

---

## 4. Files likely touched

`backend/sae/*`, `backend/routers/sae.py`, `backend/server.py`, `backend/tests/test_sae_*.py`, `backend/artifacts/.gitkeep`, `.gitignore`, `src/ui/Sidebar.js`, `ComparePanel.js`, `RemoteProvider.js`, `main.js`, `style.css`, `saeControlsDefaults.js`, `CHANGELOG`, `CONTEXT`, `lessons-learned`, `manifest`/`package`/Navbar.

---

## 5. CONTEXT terms to add

- **Top‑K SAE:** Trained sparse autoencoder with exactly K active latents per input (no L1 shrinkage).
- **Clean/Denoise (SAE):** Toggle replacing raw 768D embeddings with SAE sparse activations for 3D and metrics.
- **SAE Feature Space:** Expanded latent dimension (default 8192) used while SAE is ON.
- **Dead Features:** Latents that never activated on the train set (reported in train metrics).

---

## 6. Test plan

### Backend
- [ ] Top‑K → ≤K nonzeros per row; FP32 topk path.
- [ ] Decoder rows unit-norm after `make_decoder_weights_unit_norm`.
- [ ] Encode shape `(N, hidden_dim)`; empty input OK.
- [ ] Train on tiny random `(N,768)` writes checkpoint; status `is_trained`.
- [ ] Encode 404/clear error if not trained.

### Frontend
- [ ] 50/50 markup; localStorage round-trip.
- [ ] Toggle without train → friendly message.
- [ ] After encode, thread point count = hidden_dim; OFF restores 768.

### Smoke
- [ ] Train on vocab (or subset in dev) with progress.
- [ ] Arithmetic + Compare replace/restore.
- [ ] Reload persists toggle; status shows metrics.

---

## 7. Acceptance criteria

- [ ] Real Top‑K SAE port (encode/decode/train/manager) + API status/train/encode.
- [ ] UI 50/50 toggle + train + progress; replace-all; localStorage.
- [ ] 3D in 8192 sparse space when ON; metrics strip; raw cache restore.
- [ ] pytest + vitest green; CONTEXT + lessons; **v2.0.0**.
- [ ] No sinusoidal fake SAE; no Gemini labeling (X1).
- [ ] Approval gate before push/merge.

---

## 8. Out of scope v1

- LLM/Gemini feature naming; click-peak browsers.
- Sinusoidal / fixed non-trained “SAE-style” projection.
- Dual RAW+SAE layers at once.
- Training on arbitrary user PDFs (grandmother relief matrix) — VectorLab trains on **vocab embeddings**.

---

## 9. Stages

| Stage | Deliverable |
| :--- | :--- |
| **A** | `sae_model` + `train_sae` + pytest + artifacts path |
| **B** | FastAPI status/train/encode + progress plumbing |
| **C** | UI 50/50 + train + encode replace pipeline |
| **D** | Docs + **2.0.0** |
| **Gate** | Smoke → OK → merge |

---

## 10. Open residual

- If full-vocab train is too heavy on CPU-only laptops: allow **train on random vocab subset** (e.g. 2k–10k rows) via query param — implement if needed without asking unless product wants full-vocab only.
- GPU optional: `device` from env `SAE_DEVICE=cpu|cuda|mps`.
