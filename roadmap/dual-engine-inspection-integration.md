# Roadmap — Dual-Engine Deep Dimensional Inspection Integration (DDI-Lab)

**Status**: Active / Ready for Execution  
**Target SemVer**: 3.1.0 (Minor feature expansion across Backend and Visualizer)  
**Parent Study**: [`dual-engine-extended-inspection.md`](../dual-engine-extended-inspection.md)  
**Context & Invariants**: [`.agents/skills/dev-protocol/lessons-learned.md`](../.agents/skills/dev-protocol/lessons-learned.md), [`architecture_spec.md`](../architecture_spec.md), [`CONTEXT.md`](../CONTEXT.md)

---

## 1. Executive Summary & Problem Statement

The experimental ledger in [`dual-engine-extended-inspection.md`](../dual-engine-extended-inspection.md) documented a deep dimensional inspection of 5 canonical almas (domains: `python`, `legal`, `receta`, `medicina`, `astronomia` across 110 clauses each) evaluated across two embedding backends:
1. `BAAI/bge-m3` (1024-D)
2. `Alibaba-NLP/gte-Qwen2-1.5B-instruct` (1536-D)

Two profound engineering and mathematical discoveries emerged:
1. **The Disjoint Dimensional Collapse in Raw Embeddings (`disjoint_count = 0`)**:
   Across all 10 pairwise domain comparisons, neither BGE-M3 nor Qwen2 exhibited a single naturally disjoint coordinate dimension ($[lo_d, hi_d]$ interval gap $> 0$) when using raw unpruned clauses (`--no-prune`).
   This mirrors VHectorLab's earlier discovery in [`current-research/DISCOVERY-shared-noise-embedding-geometry.md`](../current-research/DISCOVERY-shared-noise-embedding-geometry.md): **unbounded min/max operations in high-dimensional embedding spaces are destroyed by isolated outliers**. One token crossing zero vetoes a dimension; one extreme clause expands $[lo_d, hi_d]$ and obliterates separation barriers.
2. **Computational Footprint Inversion**:
   Historical roadmap assumptions in VHectorLab placed `BAAI/bge-m3` in `NO_GO_HUB_IDS` as "too heavy for local comfort". The empirical ledger disproved this:
   - `BAAI/bge-m3` consumed only **907.0 MB RSS** at **31.8 ms/clause**, fitting easily into 16 GB Mac/Space limits, without needing remote code or RoPE buffer surgery.
   - `gte-Qwen2-1.5B-instruct` consumed **4,206.3 MB RSS** (4.2 GB) at **65.5 ms/clause** with coordinate spans $[-0.45, +0.43]$ (double the amplitude of MiniLM or BGE-M3).

### Mission of this Epic
Incorporate the hardened engineering practices, metrics, and data artifacts of the Deep Dimensional Inspection into VHectorLab 3D so that VHectorLab becomes the **primary visual diagnostic instrument** for domain firewalls and dimensional separation.

---

## 2. Technical Decisions & Invariants (Closed — Do Not Re-argue)

1. **Sequential Isolation & Memory Hygiene (D1)**:
   Any model swap or heavy encoding loop must explicitly trigger PyTorch cache clearance on CUDA and MPS, followed by Python garbage collection (`gc.collect()`). No leaked tensor graphs between model swaps.
2. **Deterministic Tensor Verification via SHA-256 (D2)**:
   All precomputed vocabulary matrices (`vocab_embeddings.npz`) and batch embeddings must compute and expose an exact SHA-256 byte digest (`np.ascontiguousarray(tensor).tobytes()`). This guarantees byte-for-byte parity between local macOS environments and remote HF Spaces.
3. **Model Catalog Re-Alignment (D3)**:
   Remove `BAAI/bge-m3` from `NO_GO_HUB_IDS`. Add it as a first-class catalog model and profile (`local-bge` / `high-density-1024`). Reject `gte-Qwen2-1.5B` for default tiers due to its 4.2 GB RSS footprint.
4. **Adaptive Coordinate Scaling (D4)**:
   WebGL shaders (`DivergentShading.js`) and spatial engines (`LayoutEngine.js`) must not assume a fixed dynamic range $[-0.2, +0.2]$. The backend will expose batch coordinate extrema (`coord_min`, `coord_max`), and the frontend will adaptively scale activation amplitudes.
5. **Interval Gap & Quantile Disjointness Metric (D5)**:
   Introduce an interval-gap contrast metric in `dimContrastSort.js` that computes interval gaps between groups:
   $$\text{gap}_d = \max(0, \max(lo_{d,A}, lo_{d,B}) - \min(hi_{d,A}, hi_{d,B}))$$
   alongside a robust quantile relaxation ($P_{05} - P_{95}$ percentile barriers).
6. **Visual Bounding Envelopes (D6)**:
   In COMPARE / ANALYSIS mode, groups can render translucent bounding envelopes ($[lo_d, hi_d]$ ribbons) showing the spread of each group across dimensions.
7. **External Census / Excited Dimensions Mask Ingestion (D7)**:
   Allow dragging and dropping `{alma}_top500_dimensiones_excitadas.csv` or `press.json` into VHectorLab to isolate and highlight excited dimensions in 3D.

---

## 3. Implementation Slices (Serial Agent Execution Plan)

Each slice is a self-contained, test-driven vertical slice designed for an independent coding AI agent.
**Agents must execute ONE slice per session, starting at Slice 1, stopping at the Approval Gate.**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SLICES DEPENDENCY GRAPH                               │
│                                                                             │
│  [Slice 1: Memory Hygiene]  ───►  [Slice 2: SHA-256 & Extrema Contract]    │
│                                                   │                         │
│                                                   ▼                         │
│  [Slice 3: BGE-M3 Catalog]   ───►  [Slice 4: Adaptive Coordinate Scaling]   │
│                                                   │                         │
│                                                   ▼                         │
│  [Slice 5: Interval Gap Sort] ──►  [Slice 6: Visual Bounding Envelopes]     │
│                                                   │                         │
│                                                   ▼                         │
│                                    [Slice 7: Census CSV Drag-and-Drop]      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Slice 1: Backend Memory Hygiene & Sequential Cache Clearance

- **Goal**: Implement deterministic tensor eviction and device cache purging to guarantee zero memory leakage during model swapping or heavy batch runs.
- **Affected Files**:
  - `backend/device.py` [MODIFY]
  - `backend/state.py` [MODIFY]
  - `backend/model_swap.py` [MODIFY]
  - `backend/tests/test_memory_hygiene.py` [NEW]
- **Specification**:
  1. In `backend/device.py`: Add `clear_runtime_cache()`:
     ```python
     def clear_runtime_cache() -> None:
         """Purge CUDA/MPS device memory pools and run Python garbage collection."""
         import gc
         import torch

         if hasattr(torch, "cuda") and torch.cuda.is_available():
             torch.cuda.empty_cache()
         if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
             torch.mps.empty_cache()
         gc.collect()
     ```
  2. In `backend/state.py`:
     - Add `AppState.unload_model()`:
       Sets `self.model = None`, clears references, and calls `clear_runtime_cache()`.
     - In `load_model_and_vocab()`: If a model is already loaded, invoke `unload_model()` before initializing the new model selection.
  3. In `backend/model_swap.py`:
     - Call `clear_runtime_cache()` before and after precomputing vocabulary NPZs in Option 11.
- **Verification & Tests**:
  - Run `uv run pytest backend/tests/test_memory_hygiene.py`.
  - Assert that calling `clear_runtime_cache()` executes cleanly on both CPU and accelerator devices.
  - Assert that `AppState.unload_model()` cleans internal references and sets `is_loaded = False`.
- **DoD**:
  - Tests green. Zero regressions in `backend/tests/test_model_swap.py`.
  - Handoff at Approval Gate.

---

### Slice 2: SHA-256 Matrix Checksum & Coordinate Extrema Contract

- **Goal**: Guarantee embedding determinism between nodes (Mac vs Space) and report batch coordinate extrema for dynamic frontend scaling.
- **Affected Files**:
  - `backend/vocab_embeddings.py` [MODIFY]
  - `backend/state.py` [MODIFY]
  - `backend/routers/core.py` [MODIFY]
  - `backend/tests/test_vocab_embeddings.py` [MODIFY/NEW]
  - `backend/tests/test_core_api.py` [MODIFY]
- **Specification**:
  1. In `backend/vocab_embeddings.py`:
     - In `save_vocab_embeddings_npz()`:
       Compute SHA-256 over contiguous float32 bytes:
       ```python
       import hashlib
       tensor_bytes = np.ascontiguousarray(embeddings, dtype=np.float32).tobytes()
       sha256_hash = hashlib.sha256(tensor_bytes).hexdigest()
       ```
       Save `sha256_hash` into the `.npz` archive.
     - In `load_vocab_embeddings_npz()`:
       Read `sha256_hash` if present; if missing (legacy archive), compute it dynamically from the loaded array.
  2. In `backend/state.py` & `backend/routers/core.py`:
     - Update `/health` response schema to include:
       `"vocab_sha256": str | None`
     - Update `perform_compare(texts)` in `state.py`:
       Calculate coordinate extrema across the normalized batch:
       ```python
       coord_min = float(np.min(normalized))
       coord_max = float(np.max(normalized))
       ```
       Include `"extrema": {"min": coord_min, "max": coord_max}` in the `/compare` response JSON.
- **Verification & Tests**:
  - Run `uv run pytest backend/tests/test_vocab_embeddings.py backend/tests/test_core_api.py`.
  - Verify `/health` reports `vocab_sha256` matching the hash of `public/vocab_embeddings.npz`.
  - Verify `/compare` returns correct `extrema.min` and `extrema.max`.
- **DoD**:
  - Contract updated in `architecture_spec.md`.
  - All backend tests pass. Approval Gate.

---

### Slice 3: Catalog Expansion — Integrate `BAAI/bge-m3` (1024-D)

- **Goal**: Re-admit `BAAI/bge-m3` as a supported high-density multilingual model profile following empirical proof of its lean 907 MB RSS footprint.
- **Affected Files**:
  - `backend/model_catalog.py` [MODIFY]
  - `backend/tests/test_model_catalog.py` [MODIFY]
  - `backend/tests/test_model_swap.py` [MODIFY]
- **Specification**:
  1. In `backend/model_catalog.py`:
     - Remove `"BAAI/bge-m3"` from `NO_GO_HUB_IDS`.
     - Add `_ModelEntry`:
       ```python
       _ModelEntry(
           hub_id="BAAI/bge-m3",
           short_label="BGE-M3-1024",
           trust_remote_code=False,
           e5_mode=False,
           default_truncate_dim=None,
       )
       ```
     - Add profile `"local-bge"`:
       ```python
       "local-bge": ProfileInfo(
           id="local-bge",
           hub_id="BAAI/bge-m3",
           default_truncate_dim=None,
       )
       ```
  2. In `backend/tests/test_model_catalog.py`:
     - Update tests: `get_model("BAAI/bge-m3")` must succeed and return `short_label="BGE-M3-1024"`.
     - Assert `"BAAI/bge-m3"` is not in `NO_GO_HUB_IDS`.
  3. In `backend/tests/test_model_swap.py`:
     - Update assertions that previously tested for BGE-M3 exclusion.
- **Verification & Tests**:
  - Run `uv run pytest backend/tests/test_model_catalog.py backend/tests/test_model_swap.py`.
- **DoD**:
  - Catalog tests green. BGE-M3 selectable via env `MODEL_PROFILE=local-bge` or `MODEL_NAME=BAAI/bge-m3`.
  - Approval Gate.

---

### Slice 4: Frontend Adaptive Coordinate Scaling & Extrema Ingestion

- **Goal**: Prevent visual clipping or vertical squashing when rendering models with diverse coordinate dispersions (e.g. $[-0.19, +0.27]$ vs $[-0.45, +0.43]$).
- **Affected Files**:
  - `src/visualizer/LayoutEngine.js` [MODIFY]
  - `src/visualizer/DivergentShading.js` [MODIFY]
  - `src/main.js` [MODIFY]
  - `tests/layoutEngine.test.js` [MODIFY/NEW]
  - `tests/divergentShading.test.js` [MODIFY]
- **Specification**:
  1. In `src/visualizer/LayoutEngine.js`:
     - Add `adaptiveAmplitudeScale(extrema, baseAmplitude = 35.0)`:
       If `extrema` is provided with `min` and `max`, calculate dynamic span $S = \max(|min|, |max|)$.
       Compute normalization ratio $r = 0.25 / \max(S, 1e-4)$.
       Scale vertical displacement smoothly by $r$.
  2. In `src/visualizer/DivergentShading.js`:
     - In `calculateZScoreNormalized(values, scaleFactor = 1.2, extrema = null)`:
       When extrema are provided, anchor standard deviation clipping against true coordinate bounds.
  3. In `src/main.js`:
     - Feed `/compare` response `data.extrema` into `LayoutEngine` and `DivergentShading` updates.
- **Verification & Tests**:
  - Run `npm test tests/layoutEngine.test.js tests/divergentShading.test.js`.
  - Verify vectors with wide extrema (e.g. $\pm 0.45$) do not clip outside default camera frustum.
- **DoD**:
  - Unit tests green. Clean visual layout. Approval Gate.

---

### Slice 5: Contrast Metric — Interval Gap & Quantile Disjointness

- **Goal**: Implement interval disjointness and quantile gap sorting in `dimContrastSort.js` to allow instant identification of separating dimensions between token groups.
- **Affected Files**:
  - `src/visualizer/dimContrastSort.js` [MODIFY]
  - `tests/dimContrastSort.test.js` [MODIFY/NEW]
- **Specification**:
  1. In `src/visualizer/dimContrastSort.js`:
     - Implement `computeDimIntervalGaps(vectorsG1, vectorsG2, quantile = 0.0)`:
       For each dimension $d$:
       - If `quantile === 0.0`:
         $lo_1 = \min(G_{1,d}), hi_1 = \max(G_{1,d})$
         $lo_2 = \min(G_{2,d}), hi_2 = \max(G_{2,d})$
       - If `quantile > 0.0` (e.g. 0.05 for robust 5th-95th percentile bounds):
         Compute percentile cuts $P_{q}$ and $P_{1-q}$.
       - Calculate directional gap:
         If $lo_1 > hi_2 \implies gap_d = lo_1 - hi_2$.
         Else if $lo_2 > hi_1 \implies gap_d = lo_2 - hi_1$.
         Else $gap_d = 0$ (or negative overlap $-(\min(hi_1, hi_2) - \max(lo_1, lo_2))$).
     - Add sort modes:
       - `'interval-gap'`: Sorts dimensions by absolute positive gap descending.
       - `'quantile-gap'`: Sorts by 10% quantile gap descending.
  2. Dimensions with clean disjoint barriers bubble to the front ($Z=0$).
- **Verification & Tests**:
  - Run `npm test tests/dimContrastSort.test.js`.
  - Test synthetic datasets:
    - Fully separated distributions $\implies gap > 0$, ranked first.
    - Fully overlapping distributions $\implies gap \le 0$, ranked last.
    - Outlier-polluted distribution $\implies$ raw interval gap fails ($0$), but quantile gap detects separation.
- **DoD**:
  - Unit tests green. Approval Gate.

---

### Slice 6: Visual Bounding Envelopes & Domain Overlap Ribbons

- **Goal**: Render visual 3D bounding intervals ($[lo_d, hi_d]$) per group in COMPARE mode so users can visually diagnose where domain candados fail or succeed.
- **Affected Files**:
  - `src/visualizer/MeshFactory.js` [MODIFY]
  - `src/visualizer/Instancer.js` [MODIFY]
  - `src/ui/workbench/` or `src/ui/visualizationControls.js` [MODIFY]
  - `tests/meshFactory.test.js` [MODIFY]
- **Specification**:
  1. In `src/visualizer/MeshFactory.js`:
     - Implement `createGroupEnvelopeGeometry(dimCount, loBounds, hiBounds, layoutConfig)`:
       Builds a translucent triangle strip / quad ribbon extending along $Z$ between $Y_{lo}(d)$ and $Y_{hi}(d)$ for each dimension $d$.
  2. In `src/visualizer/Instancer.js`:
     - Maintain envelope meshes per group when `showGroupEnvelopes` is active.
     - Color envelopes according to the group hue with an alpha of $\sim 0.15$.
  3. In `src/ui/visualizationControls.js`:
     - Add checkbox toggle in Workbench: `"Group Envelopes [lo, hi]"`.
- **Verification & Tests**:
  - Run `npm test tests/meshFactory.test.js`.
  - Manual verification in browser: load Compare sample with 2 groups; enable Group Envelopes; verify transparent ribbons encompass all points for each group.
- **DoD**:
  - Visuals clean, zero shader errors in console, tests pass. Approval Gate.

---

### Slice 7: Census CSV Ingestion & External Dimension Masking

- **Goal**: Enable importing `{alma}_top500_dimensiones_excitadas.csv` or `press.json` from DDI-FW into VHectorLab to isolate and visualize excited dimensions in 3D.
- **Affected Files**:
  - `src/visualizer/activationFilter.js` [MODIFY]
  - `src/ui/workbench/censusDropHandler.js` [NEW]
  - `src/main.js` [MODIFY]
  - `tests/activationFilter.test.js` [MODIFY]
  - `tests/censusDropHandler.test.js` [NEW]
- **Specification**:
  1. In `src/ui/workbench/censusDropHandler.js`:
     - Implement drag-and-drop listener and file selector for `.csv` and `.json`.
     - Parse `{alma}_top500_dimensiones_excitadas.csv`:
       Accept headers like `dimension`, `dim_index`, `activation`, `energy`.
       Extract set of integer dimension indices `Set<number>`.
     - Parse `press.json`:
       Extract active/voted dimensions from census structure.
  2. In `src/visualizer/activationFilter.js`:
     - Implement `applyDimensionMask(maskSet)`:
       When active, dimensions not present in `maskSet` have opacity forced to $0.05$ or are collapsed to $Y=0$.
  3. Display active mask chip in Navbar or Status HUD: e.g. `"MASK: Top-500 (python)"`.
- **Verification & Tests**:
  - Run `npm test tests/censusDropHandler.test.js tests/activationFilter.test.js`.
  - Verify dropping a synthetic CSV isolates the specified dimensions and mutes others.
- **DoD**:
  - Complete end-to-end integration tested. Documentation updated. Approval Gate.

---

## 4. Verification & QA Matrix

| Stage | Automated Test Command | Manual Check |
| :--- | :--- | :--- |
| **Backend Memory** | `uv run pytest backend/tests/test_memory_hygiene.py` | Verify RSS does not climb monotonically over 5 model swaps |
| **Backend Integrity** | `uv run pytest backend/tests/test_vocab_embeddings.py` | Inspect `GET /api/health` output for `vocab_sha256` |
| **Catalog** | `uv run pytest backend/tests/test_model_catalog.py` | Run `./setup.sh` option 11; verify BGE-M3 is selectable |
| **Frontend Math** | `npm test tests/dimContrastSort.test.js` | Check console for NaN/Infinity on extreme vector inputs |
| **3D Rendering** | `npm test` | Toggle "Group Envelopes" in Compare mode; check camera frame |
| **End-to-End** | `uv run pytest` && `npm test` | Load 110-clause sample from DDI-FW; inspect interval overlap visually |

---

## 5. Documentation & Lessons Learned Sync

Upon completion of each slice:
1. Update `architecture_spec.md` with any new endpoint parameters (`vocab_sha256`, `extrema`).
2. Update `CHANGELOG.md` under `[Unreleased]` following SemVer rules.
3. Record any new technical invariants in `.agents/skills/dev-protocol/lessons-learned.md`:
   - §8.10: Memory hygiene and tensor eviction protocol.
   - §8.11: Quantile interval gap vs raw min/max bounding collapse.
