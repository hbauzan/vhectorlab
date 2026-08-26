# Roadmap — Galaxy VIEW (UMAP word universe)

**Status:** Plan (ready to implement)  
**Date:** 2026-08-08  
**Product:** VectorLab 3D (`lsv2`) — **legacy UI only** (`/`, `src/main.js`). **Do not touch `/v25/`.**  
**Prompt companion:** [`PROMPT-galaxy-view.md`](./PROMPT-galaxy-view.md)  
**Version on ship:** likely **MINOR** (new VIEW + API). Confirm with human + SemVer rules in `lessons-learned.md` §7.

> **Goal (one sentence):** Add a **Galaxy** VIEW where each token is **one point** in a cosmic 3D space from **backend UMAP**, groups (`GROUP_*`) appear as spatial clusters, chrome locks **COMPARE + POINTS**, default corpus = **IT core (100) + existing 2 demo groups**, with always-visible **step progress (n/n)** while working.

---

## 0. Locked product decisions (do not re-litigate)

| ID | Decision |
| :--- | :--- |
| D1 | Galaxy is a new **VIEW** tab: `ANALYSIS \| NAVIGATION \| GALAXY`. |
| D2 | Entering Galaxy **forces** `workspaceMode = COMPARE` and `renderMode = POINTS`. |
| D3 | In Galaxy: **MODE** and **RENDER** controls are **disabled** (or visually locked). Leaving Galaxy restores previous triad. |
| D4 | Layout is **cosmic 3D** (UMAP → 3 dims). **2D VIEW submode** is **planned** (roadmap item), **not** in first implementation slice. |
| D5 | Dimensionality reduction runs **entirely on the backend** (`uv` / FastAPI). |
| D6 | **Default method = UMAP**. Under the Galaxy VIEW control: two/three **tiny sub-buttons** `UMAP` \| `PCA` \| `t-SNE`. **PCA and t-SNE are grayed / disabled** until a later epic. |
| D7 | Default corpus = **`GROUP_it_core` (100 EN IT terms)** + existing **`GROUP_1` / `GROUP_2`** demo (vehicles vs soft lexicon). |
| D8 | Visual clusters = **`GROUP_*` membership** (color + floating group badges). |
| D9 | **K-means** button + clear info tip in UI **now** (stub / disabled or no-op with “coming soon”); **implementation later**. |
| D10 | **SAE Clean/Denoise applies** in Galaxy (same Compare path: transform embeddings → then project). |
| D11 | **No v25 changes.** Legacy navbar / main / ComparePanel / Instancer only. |
| D12 | Interaction v1: **hover token label** + **group badges**. (Click→panel sync can ship if cheap; not required for first green.) |
| D13 | UI **always informs** what is happening: status copy + **progress bar** with **step `k/n`**. |
| D14 | Token Comparison slide/panel: **same behavior as today** (textarea, presets, cosine list, reorder/sort rules with ≥2 groups). |

---

## 1. Problem / gap vs current architecture

Today:

- **VIEW** only remaps **dim-axis threads** (ANALYSIS / NAVIGATION).
- One token ≈ one **thread** of D points along X — not one star in a galaxy.
- No PCA / UMAP / t-SNE. Explicitly listed out of scope in older projector notes.
- Bootstrap Compare = 2 groups (~130 tokens), no IT core.

Galaxy needs a **new layout path**: **1 point per token** from reduced coordinates, plus a **project** backend seam.

---

## 2. UX chrome

### 2.1 VIEW row

```
VIEW:  [ANALYSIS]  [NAVIGATION]  [GALAXY]
                              ┌─────────────────────┐
                              │ [UMAP] [PCA] [t-SNE] │  ← tiny subs under GALAXY
                              └─────────────────────┘
```

- `UMAP` active (default) when Galaxy selected.
- `PCA`, `t-SNE`: present, **disabled/gray**, `title`/info: “Coming next — PCA / t-SNE projection”.
- Selecting Galaxy:
  1. Switch `viewMode → GALAXY`
  2. Force COMPARE + POINTS; disable MODE/RENDER tabs
  3. If Compare data present: run Galaxy pipeline (or reuse last project if inputs unchanged)
  4. Camera → cosmic fit on IT core centroid (fallback: all-points bbox)

### 2.2 Progress (mandatory)

Whenever Galaxy work runs (Visualize, SAE toggle, method change when enabled):

| Step | Label (EN UI) | Typical work |
| ---: | :--- | :--- |
| 1/N | Encoding tokens… | `POST /compare` (or reuse cache if texts unchanged) |
| 2/N | Applying SAE… | Only if SAE ON; else skip and renumber, **or** keep fixed N and mark skipped |
| 3/N | Running UMAP… | `POST /project` |
| 4/N | Building galaxy… | Map positions → Instancer / labels / camera |

**Requirement:** always show **current step index / total**, short status text, and a determinate or stepped progress bar. Never leave the user without feedback during backend calls.

**Preferred orchestration (v1):** **client-driven steps** (sequential fetch + UI update between steps). No job queue required for ≤1024 tokens.

### 2.3 K-means stub

Near Visualization / Compare chrome (sensible place: under Galaxy tools or viz panel):

- Button **K-means** (disabled or “Coming soon”)
- Info tip (clear, non-jargony), e.g.:  
  **“K-means** groups points into a chosen number of clusters by closeness in the projected space. Useful to discover structure beyond your named `GROUP_*` labels. Not available yet.”

### 2.4 Token Comparison

Unchanged contract:

- Textarea flat or `GROUP_name = …`
- Cosine vs first (REF), reorder ▲/▼, sort disabled when ≥2 groups
- Presets; bootstrap becomes **3 groups** (IT + G1 + G2) — see §4

---

## 3. Backend contract

### 3.1 New endpoint: `POST /project`

**Purpose:** Project already-computed embedding vectors to 2D/3D. Does **not** re-encode text (encoding stays `/compare`).

**Request (proposed):**

```json
{
  "vectors": [[...], [...]],
  "method": "umap",
  "n_components": 3,
  "seed": 42,
  "params": {
    "n_neighbors": 15,
    "min_dist": 0.1,
    "metric": "cosine"
  }
}
```

**Constraints:**

- `method`: v1 accepts **`umap` only**. `pca` / `tsne` → `400` with clear detail *or* `501` “not implemented” (pick one; document in `architecture_spec.md`).
- `n_components`: `2 | 3` (Galaxy UI sends **3** now; **2** reserved for future 2D VIEW).
- `len(vectors)` in `1..1024`; dim must be consistent.
- Optional: accept pre-reduced width; recommend internal **PCA → 50** then UMAP when `dim > 50` (implementation detail behind the seam).

**Response (proposed):**

```json
{
  "method": "umap",
  "n_components": 3,
  "positions": [[x,y,z], ...],
  "meta": {
    "seed": 42,
    "n_neighbors": 15,
    "min_dist": 0.1,
    "metric": "cosine",
    "pre_pca_dims": 50
  }
}
```

Normalize / center positions server-side or client-side — **one place only** (prefer server: zero-mean, unit-ish scale) so camera defaults are stable.

### 3.2 Dependencies (`uv`)

- Add via `uv add`: `umap-learn` (+ transitive `scikit-learn`, etc. as resolved by uv).
- **No** `pip install`. Tests: `uv run pytest`.

### 3.3 SAE

Flow when SAE ON:

1. `/compare` → RAW embeddings  
2. Existing SAE transform (same as Compare today)  
3. `/project` on **SAE (or densified) vectors**  
4. Place galaxy points  

Progress steps must mention SAE when active.

### 3.4 Stability

- Fixed `seed=42` default.
- Same inputs → same positions (document any nondeterminism from BLAS/threads; pin where practical).

---

## 4. Default corpus

Bootstrap Compare textarea / auto-Visualize payload:

1. **`GROUP_it_core`** — 100 English IT / software terms (galactic core).  
2. **`GROUP_1`** — existing vehicles / auto-manual demo.  
3. **`GROUP_2`** — existing soft / emotional lexicon demo.

Order in textarea: **IT core first** (so REF / first token is inside the core unless user edits). Cosine-vs-first semantics unchanged.

**IT core list (canonical fixture — exactly 100 unique tokens):**

```
server, client, api, endpoint, database, sql, nosql, cache, redis, kafka,
queue, microservice, container, docker, kubernetes, devops, cicd, pipeline,
repository, git, commit, branch, merge, frontend, backend, javascript,
typescript, python, rust, golang, java, react, vue, angular, nodejs,
fastapi, django, flask, graphql, rest, json, protobuf, grpc, websocket,
http, https, oauth, jwt, auth, latency, throughput, loadbalancer, nginx,
cdn, dns, ssl, tls, certificate, firewall, vpn, cloud, aws, gcp, azure,
lambda, serverless, terraform, ansible, monitoring, logging, metrics,
tracing, prometheus, grafana, opentelemetry, unittest, integration, e2e,
agile, scrum, sprint, backlog, kanban, architecture, modularity, refactor,
debugging, profiling, optimization, concurrency, async, thread, process,
memory, cpu, gpu, storage, network, protocol, encryption
```

> Note: fixture tests must assert **len == 100** and uniqueness. Do not silently grow the list.

Camera “center of the galaxy” = **centroid of `GROUP_it_core` positions** after UMAP.

---

## 5. Frontend architecture (legacy only)

### 5.1 State / triad

| Field | Galaxy behavior |
| :--- | :--- |
| `viewMode` | `GALAXY` |
| `workspaceMode` | locked `COMPARE` |
| `renderMode` | locked `POINTS` |

Files likely touched (non-exhaustive):

- `src/ui/Navbar.js` — GALAXY tab + UMAP/PCA/t-SNE subs + locks
- `src/ui/appViewDefaults.js` — no change to global default unless human asks (startup can stay ARITHMETIC\|ANALYSIS\|POINTS)
- `src/ui/ComparePanel.js` — bootstrap 3 groups; progress UI hook
- `src/main.js` — Galaxy pipeline orchestration
- `src/visualizer/LayoutEngine.js` **or** new `galaxyLayout.js` — token→XYZ from positions
- `src/visualizer/Instancer.js` / `MeshFactory.js` — single-point-per-token path (no dim thread)
- `src/ui/ThreadLabels.js` / group badge path — hover labels + group centroids
- `src/style.css` — progress + tiny method chips
- Remote/API client module used for `/compare` — add `/project`

**Forbidden:** any edit under `src/v25/**`.

### 5.2 Layout semantics (Galaxy)

| Axis | Meaning |
| :--- | :--- |
| X/Y/Z | UMAP components (cosmic space) |
| One mesh point | One token |
| Group badge | Centroid of member points |
| Continuity ribbons | **Off** (POINTS only; no dim-axis ribbon) |

Spatial sliders: remap or disable those that only make sense for dim-threads (Amplitude / Length Z). Document chosen behavior in CHANGELOG/lessons. Prefer: **global galaxy scale / spread** if a slider must remain live.

### 5.3 Deep module seam

```text
projectGalaxy(vectors, opts) → positions   # thin API client
layoutGalaxyPoints(tokens, positions, groups) → instance buffers
runGalaxyPipeline({ texts, sae, onProgress }) → scene update
```

Progress callback: `{ step, total, label }`.

---

## 6. Implementation slices (serial — one agent / one slice)

Execute **in order**. Each slice ends green + short smoke before the next.

| Slice | Name | Deliverable |
| ---: | :--- | :--- |
| **0** | Docs lock | This file + PROMPT; README index. *(done when these land)* |
| **1** | Backend `/project` UMAP | `uv add umap-learn`; router; unit tests; architecture_spec note |
| **2** | Navbar Galaxy + locks + method chips | GALAXY tab; UMAP active; PCA/t-SNE gray; MODE/RENDER locked in Galaxy |
| **3** | Bootstrap corpus | IT×100 + GROUP_1/2; tests on parse count / group ids |
| **4** | Galaxy layout + Instancer path | 1 point/token; badges; hover labels; camera to IT centroid |
| **5** | Pipeline + progress UI | Steps n/n; status text; wire Visualize + SAE → project → build |
| **6** | K-means stub + field info | Disabled button + clear tip |
| **7** | Polish / docs | CONTEXT terms; CHANGELOG; lessons-learned; smoke §8 |

**Later epics (explicitly out of v1 code):**

| Epic | Scope |
| :--- | :--- |
| L-A | Enable **PCA** method (backend + ungated chip) |
| L-B | Enable **t-SNE** method |
| L-C | **2D VIEW** submode under Galaxy (n_components=2, flat plane, camera top-down) |
| L-D | **K-means** clustering (button already present) |

---

## 7. Acceptance criteria (v1)

- [ ] VIEW shows **GALAXY**; under it **UMAP** selectable, **PCA/t-SNE** visible but disabled.
- [ ] In Galaxy: MODE=COMPARE and RENDER=POINTS **locked**; cannot switch to Arithmetic/Ribbons without leaving Galaxy.
- [ ] Default Visualize loads **3 groups**: `it_core` (100) + `GROUP_1` + `GROUP_2`.
- [ ] 3D scene: **one point per token**; IT core forms a visible dense region; camera framed on IT centroid.
- [ ] Group badges at group centroids; hover shows token label.
- [ ] Progress UI shows **k/n** + label during encode / (SAE) / UMAP / build.
- [ ] SAE ON recomputes projection from SAE vectors with progress feedback.
- [ ] Token Comparison panel behavior preserved (cosine, reorder, sort rules).
- [ ] `POST /project` covered by backend tests; frontend unit tests for bootstrap + layout helpers.
- [ ] **No files changed under `src/v25/`.**
- [ ] K-means control present with informative tip; not required to cluster yet.

---

## 8. Smoke checklist

1. `uv sync` / backend up; `npm run dev` (legacy `/`).
2. Switch VIEW → **GALAXY** → confirm MODE/RENDER locked; UMAP chip on; PCA/t-SNE gray.
3. First paint / Visualize: progress `1/n … n/n`; galaxy appears; IT core centered.
4. Hover tokens; confirm **GROUP_it_core**, **GROUP_1**, **GROUP_2** badges.
5. Toggle SAE ON → progress includes SAE + UMAP; points reshuffle coherently.
6. Leave Galaxy → ANALYSIS or NAVIGATION; MODE/RENDER usable again; threads layout restored.
7. Confirm `/v25/` untouched (`git diff -- src/v25` empty).

---

## 9. Out of scope (v1)

- Implementing PCA / t-SNE / K-means / 2D VIEW (only stubs / roadmap hooks).
- Full-vocab Embedding Projector.
- v25 UI.
- Changing `/compare` response shape (project is additive).
- Arithmetic in Galaxy.

---

## 10. Doc-sync on ship

| Asset | Update? |
| :--- | :--- |
| `architecture_spec.md` | Yes — `/project` |
| `CONTEXT.md` | Yes — Galaxy VIEW, UMAP projection, galactic core |
| `CHANGELOG.md` | Yes — MINOR note |
| `manifest.json` | Only if version bump / schema fields |
| `README.md` | Only if new dep/run step needs first-run mention |
| `lessons-learned.md` | Yes — Galaxy layout ≠ dim threads; progress steps; umap seed |
| `src/v25/**` | **Never** in this epic |
