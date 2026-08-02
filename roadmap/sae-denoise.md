# Roadmap — SAE Clean/Denoise (Sparse Projection + Top‑K)

**Status:** Ready for implementation handoff  
**Date:** 2026-08-02  
**Product:** VectorLab 3D (`lsv2`)  
**Prompt companion:** [`PROMPT-sae-denoise.md`](./PROMPT-sae-denoise.md)  
**Version on ship:** **MAJOR `2.0.0`** (SemVer §7 — new product capability + embedding/viz contract change when SAE ON)

> **Do not re-ask closed decisions** below. If something truly new appears, list once and ask; otherwise implement.  
> Supersedes the archived non-goal “NO SAE” in `roadmap/archivo/big-picture.md` for this epic.

---

## 0. Goal (one sentence)

Add a **Clean/Denoise (SAE)** toggle (50/50 beside Calculate / Visualize) that projects dense embeddings into an expanded sparse activation space (deterministic “SAE-style” projection + Top‑K), **replaces** all Arithmetic/Compare vectors used for 3D + metrics while ON, with UI params, `localStorage`, and batch progress feedback — shipped as **v2.0.0**.

---

## 0.1. Closed decisions (authoritative)

| ID | Topic | Decision |
| :--- | :--- | :--- |
| **U1** | Button layout | Same row as primary CTA, **50/50**: Arithmetic `[ CALCULATE VECTOR \| Clean/Denoise (SAE) ]`; Compare `[ VISUALIZE SEQUENCE (3D) \| Clean/Denoise (SAE) ]`. |
| **U2** | Label | Exact copy: **`Clean/Denoise (SAE)`** (EN-only §4.7). |
| **U3** | Interaction | **Toggle** (pressed/active vs off). Not one-shot. |
| **U4** | Persistence | Persist SAE on/off + UI params in **`localStorage`** (prefix e.g. `vl3d.sae.`). |
| **U5** | Params UI | Expose parameters in UI (see §0.3). Defaults documented; live or Apply-on-toggle — prefer **apply when toggling ON** and when params change while ON (with progress). |
| **M1** | Semantics | **6A Replace**: while SAE ON, Arithmetic + Compare use **only** SAE sparse vectors for 3D threads **and** Top-10 / cosine-vs-anchor. Toggle OFF restores cached **raw** embeddings (must keep both client-side or re-fetch). |
| **M2** | Scope vectors | **All** vectors: Arithmetic `A/B/C/res/top1` (and any other returned embeddings); Compare **every** item embedding. |
| **A1** | Algorithm family | **Deterministic SAE-style projection** (same family as the sibling product), **not** a trained neural SAE checkpoint in v1. Honest naming in docs/lessons: “SAE-style sparse expansion”; UI may still say SAE as product label. |
| **A2** | Expansion | Dense dim `D` (today **768**) → expanded dim `M = D * expansionFactor` (or absolute `saeDim` — pick one param; see §0.3). Fixed deterministic matrix `W ∈ R^{M×D}` built from **sinusoidal** features so the same input always yields the same peaks. |
| **A3** | Projection | For each vector `x ∈ R^D` (L2-normalize first if not already): `z_raw = W @ x` (or `W @ x + b` with `b=0`). Then non-linearity: **`z = max(0, z_raw)`** (ReLU) unless tests prefer `abs` — document choice. |
| **A4** | Sparsity | **Top‑K**: keep the **K** largest activations in `z`, set the rest to **exactly `0.0`**. Target empirical sparsity often ~85–95% (depends on `M` and `K`). |
| **A5** | Viz space | While SAE ON, 3D threads are drawn in **expanded sparse space** (`M` points per thread), not reconstructed back to `D`. Peaks = monosemantic-ish “feature needles”; valleys = zeros (flat). Matches sibling product RAW-vs-SAE topography idea. |
| **A6** | Metrics in SAE mode | Cosine / Top-10 operate on the **sparse `z` vectors** (L2-normalize `z` before cosine). Document that scores are **not comparable** to raw-768 scores across modes. |
| **B1** | Runtime | **Backend** FastAPI (`/api/...`). Frontend never builds `W` for production path (may mirror tiny helper in tests only if needed). |
| **B2** | Load | **9A Lazy**: build/cache `W` (+ any buffers) on **first** SAE request / first toggle ON. Progress step: `Loading SAE projection…`. |
| **B3** | Batch + UX | Always process in **batch** with user-visible progress: step label + current/total steps (and optional % bar). Never silent long waits. |
| **B4** | Endpoints | Prefer a dedicated router e.g. `POST /api/sae/project` (batch of vectors → sparse + metrics). Arithmetic/Compare may accept `sae: true` **or** client calls `/sae/project` after raw compute — pick one seam and keep it deep (recommend **post-process via `/api/sae/project`** so raw endpoints stay pure). |
| **X1** | Out of scope v1 | Trained neural SAE weights; train-from-UI; multi-model SAE packs; Gemini/LLM auto-label of features; click-peak → concept browser; Neuronpedia-style explorer; side-by-side dual 3D (6B); export/import feature dictionaries. |
| **V1** | Version | Ship as **`2.0.0`** (MAJOR): new surface + when SAE ON the viz/metric embedding dim/contract changes. Sync manifest / package / Navbar / CHANGELOG. |

### 0.2. Algorithm (normative sketch)

```
Given x ∈ R^D (dense embedding):
  1. x̂ ← L2Normalize(x)
  2. Ensure W ∈ R^{M×D} cached (deterministic sinusoids; seed fixed in code/config)
  3. h ← ReLU(W @ x̂)          # dense expanded activations
  4. z ← TopK(h, K)            # all but K largest → 0 exactly
  5. Return z ∈ R^M and per-vector metrics { l0, sparsity }
```

**Matrix W (deterministic):** for output row `i` and input col `j`:

```
W[i, j] = sin(α * (i+1) * (j+1) + β * i) * γ
```

(or equivalent fixed formula — implement one pure function, unit-test determinism). Do **not** use `np.random` without a fixed seed baked into the formula; prefer closed-form sinusoids so no RNG state leaks.

**Batch metrics (response aggregate):**

| Metric | Meaning |
| :--- | :--- |
| **L0** | Mean count of non-zeros per vector |
| **Sparsity rate** | Fraction of zeros across the batch matrix |
| **Active feature count** | Count of dims that were non-zero in **at least one** vector of the batch |

Expose these in API response; show a compact read-only strip in UI when SAE is ON (Arithmetic + Compare).

### 0.3. UI parameters (v1)

| Param | Control | Default (proposed) | Range (proposed) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `expansionFactor` | number / slider | `4` | `2 … 8` step 1 | `M = D * factor`. Alternative absolute `saeDim` only if factor feels wrong — **do not expose both**. |
| `topK` | number / slider | `64` | `8 … 256` | Absolute K per vector. |
| SAE toggle | button pressed state | `false` | — | `vl3d.sae.enabled` |

Optional advanced (only if cheap): `seed` constant in code, not UI.

**Placement of params:** small collapsible or inline group near the SAE button / under the CTA row — keep left dock `overflow: hidden` / no new outer scrollbar (§4.1 / §4.2). Prefer compact sliders matching Spatial Controls density.

### 0.4. Progress contract (normative)

When SAE turns ON or params change while ON:

1. Show modal or inline progress host (reuse `CustomModal` **or** a non-blocking progress strip — prefer **non-blocking strip** in the left panel so 3D stays visible; if existing modal pattern is simpler, OK).
2. Steps example (batch of `N` vectors):
   1. `Loading SAE projection…` (1/S)
   2. `Projecting vectors… (i/N)` 
   3. `Applying Top‑K sparsity…`
   4. `Updating 3D + metrics…`
3. Always show **current step text**, **step index / total**, and a bar when duration may exceed ~300ms.
4. Cancel: nice-to-have; not required in v1 (document if skipped).

---

## 1. Product copy (English-only)

| UI | Copy |
| :--- | :--- |
| Toggle button | `Clean/Denoise (SAE)` |
| Active state | `aria-pressed="true"`; visual pressed style |
| Progress examples | `Loading SAE projection…`, `Projecting vectors (3/12)…`, `Applying Top-K…`, `Updating scene…` |
| Metrics strip | `L0`, `Sparsity`, `Active features` (short labels) |
| Params | `Expansion`, `Top-K` |

---

## 2. UX / layout

```
Arithmetic left panel:
  … inputs …
  [  CALCULATE VECTOR  |  Clean/Denoise (SAE)  ]   ← 50/50
  [ Expansion …… ] [ Top-K …… ]   ← only need be visible when SAE relevant; OK always compact
  metrics strip (when SAE on)
  Top-10 …

Compare left panel:
  … textarea …
  [ VISUALIZE SEQUENCE (3D) | Clean/Denoise (SAE) ]  ← 50/50
  same params + metrics pattern
  cosine list …
```

- Shrinking primary CTA: CSS grid/flex `1fr 1fr`; keep touch targets ≥44px height on mobile (§ existing mobile CSS).
- SAE toggle does **not** replace Calculate/Visualize — user still computes raw first; SAE transforms cached results. If no data yet, SAE ON → toast/modal “Calculate / Visualize first”.

---

## 3. Technical design (recommended seams)

### 3.1. Backend (Python / `uv`)

| Module | Responsibility |
| :--- | :--- |
| `backend/sae/projection.py` | Pure: build `W`, `project_vector`, `project_batch`, Top‑K, metrics — **unit-tested** with `pytest` |
| `backend/sae/state.py` or cache on app state | Lazy singleton cache for `W` keyed by `(D, M, formula_version)` |
| `backend/routers/sae.py` | `POST /api/sae/project` body: `{ vectors: number[][], top_k, expansion_factor }` → `{ vectors, metrics, dim }` |
| Wire in `server.py` | `include_router(..., prefix="/api")` — Vite `/api` proxy already covers it (§6.1) |

**TDD:** determinism (`same x → same z`), Top‑K exact zero count `M-K`, sparsity bounds, batch metrics.

### 3.2. Frontend

| Module | Responsibility |
| :--- | :--- |
| `src/ui/saeControlsDefaults.js` | defaults, localStorage, clamp params |
| `src/ui/SaeProgress.js` (or inline) | progress strip API: `setStep({ label, current, total })` |
| Sidebar / ComparePanel | 50/50 button row + wire toggle + params |
| `RemoteProvider` | `projectSae(vectors, params)` |
| `VectorLabApp` / state | Keep `rawArithmeticData` / `rawCompareData` + `sae*` views; `refreshRender` reads active mode |

**Instancer:** already maps `embedding.length` → points; SAE ON with `M ≠ 768` just works if arrays change length. Confirm LayoutEngine + labels OK with variable dim.

### 3.3. Data flow

```
Calculate/Visualize → store RAW in state
Toggle SAE ON → progress → POST /api/sae/project(all vectors) → store SAE vectors
→ replace embeddings in working state → refreshRender + refresh lists
Toggle SAE OFF → restore RAW from cache → refreshRender
```

### 3.4. Versioning

- **`2.0.0`** MAJOR on merge to `main`.
- CHANGELOG: Added SAE-style clean/denoise; note dim change when ON; note not a trained SAE.

---

## 4. Files likely touched

| Area | Paths |
| :--- | :--- |
| Backend | `backend/sae/*` (new), `backend/routers/sae.py`, `backend/server.py`, `backend/tests/test_sae_*.py` |
| UI | `src/ui/Sidebar.js`, `src/ui/ComparePanel.js`, `src/style.css`, `src/ui/saeControlsDefaults.js` (new), progress helper |
| Core | `src/core/RemoteProvider.js`, `src/main.js`, maybe `src/core/State.js` |
| Docs | `CHANGELOG.md`, `CONTEXT.md`, `lessons-learned.md`, `manifest.json`, `package.json`, Navbar |
| Roadmap index | `roadmap/README.md` |

**Do not touch:** `roadmap/archivo/**` (except optional one-line pointer that SAE non-goal is superseded), unrelated roadmaps.

---

## 5. CONTEXT glossary terms to add

- **SAE-style Projection:** Deterministic dense→expanded sparse map (`W` sinusoids + ReLU + Top‑K) used for Clean/Denoise; product label may say “SAE”.
- **Clean/Denoise (SAE):** Toggle that replaces raw embeddings with sparse expanded activations for 3D and similarity metrics.
- **Top‑K Sparsity:** Keep K largest feature activations per vector; all others exactly zero.
- **SAE Metrics:** L0, sparsity rate, active feature count over the current batch.

---

## 6. Test plan

### Unit (backend)
- [ ] `W` deterministic for fixed `(D,M)`.
- [ ] `project_vector` ReLU + Top‑K → exactly `K` non-zeros (ties documented).
- [ ] Batch metrics: L0 / sparsity / active features formulas.
- [ ] Expansion factor clamps.

### Unit (frontend)
- [ ] localStorage round-trip for enabled + params.
- [ ] Defaults resolve.
- [ ] Button markup 50/50 present (Arithmetic + Compare).

### Integration / smoke
- [ ] Calculate → toggle SAE ON → progress visible → 3D thread length becomes `M`; peaks sparse.
- [ ] Toggle OFF → back to 768-length smooth threads.
- [ ] Compare batch N tokens → progress `i/N` → all threads sparse; cosine updates.
- [ ] Change Top‑K while ON → reproject with progress.
- [ ] Reload → toggle + params restored.
- [ ] No data + SAE ON → friendly error, no crash.

---

## 7. Acceptance criteria

- [ ] 50/50 CTAs with label `Clean/Denoise (SAE)` in Arithmetic + Compare.
- [ ] Toggle + localStorage; params Expansion + Top‑K in UI.
- [ ] Backend `/api/sae/project` batch; lazy `W`; progress with step text + remaining.
- [ ] Replace-all vectors (M1/M2); 3D in sparse `M`-space; metrics on sparse vectors.
- [ ] Deterministic sinusoid `W` + Top‑K; metrics strip when ON.
- [ ] Vitest + pytest green; CONTEXT + lessons; **version `2.0.0`**.
- [ ] No Gemini labeling / trained SAE / dual view (X1).
- [ ] Approval gate before push/merge.

---

## 8. Out of scope / non-goals (v1)

- Trained sparse autoencoder neural nets / checkpoints.
- Training UI or dataset collection in-app.
- LLM/Gemini feature naming from activating chunks.
- Click-peak concept browser.
- Dual RAW+SAE simultaneous 3D layers.
- Per-model SAE packs beyond current `D=768` (support variable `D` from health/config, but one formula).

---

## 9. Implementation stages (suggested)

| Stage | Branch sketch | Deliverable |
| :--- | :--- | :--- |
| **A** | `feat/sae-projection-backend` | Pure projection + metrics + pytest + `/api/sae/project` |
| **B** | `feat/sae-ui-toggle` | 50/50 buttons, defaults/localStorage, progress UX, RemoteProvider |
| **C** | same or `feat/sae-replace-render` | Wire replace cache in app state; Arithmetic + Compare refresh; metrics strip |
| **D** | docs | CONTEXT, lessons, CHANGELOG, bump **2.0.0** |
| **Gate** | — | Human smoke → OK → merge to `main` |

Agent may combine A–C if reviewable.

---

## 10. Open residual (only if blocked)

None expected for v1 algorithm. If Top‑K ties or `M` too large for WebGL performance on low-end phones, clamp `expansionFactor` max down and document in lessons — ask only if default `4` OOMs or drops below 30fps on a reference Compare batch of ~50 tokens.
