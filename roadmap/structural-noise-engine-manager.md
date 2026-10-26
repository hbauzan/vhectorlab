# Roadmap: LLM Engine Manager & Universal Structural Noise Shield (v4.0.0)

**Version:** 4.0.0 (MAJOR RELEASE)  
**Status:** APPROVED FOR IMPLEMENTATION  
**Date:** 2026-10-26  
**Look & Feel:** MagicWB AGA 1993 (Martin Huttenloher 8-Pen + 3D Chiseled Bevels)  
**Area:** `backend/`, `src/ui/`, `src/visualizer/`, `src/theme/`, `tests/`  
**Reference:** `.agents/skills/dev-protocol/SKILL.md` (Principal Architect Role, Verification-First, Zero Fluff)

---

## 1. Executive Summary & Problem Statement

In transformer-based continuous semantic embeddings (e.g., `BAAI/bge-m3`, `all-mpnet-base-v2`, `MiniLM`), the representation space is strictly non-isotropic. Due to LayerNorm dynamics, residual streams, and sequence mean pooling, a minute fraction of coordinates (<1% of the total dimension count) develops permanent DC saturation offsets or becomes completely inert.

This phenomenon—cataloged in literature as **Outlier / Rogue Dimensions** (*Timkey & van Schabbroeck, 2021*) and **Anisotropy / Cone Degeneration** (*Ethayarajh, 2019*)—creates severe artifacts in VHectorLab 3D:
1. **Geometric Cone Bias:** Pairwise cosine similarity between semantically disjoint words shares an artificial background floor of $\approx 0.50$ purely because rogue coordinates pull in the same direction.
2. **3D Visual Distortion (Analysis Mode):** Rogue coordinates (e.g., Dim 386 in `bge-m3`) form permanent vertical spikes across every single token, dwarfing genuine semantic variance.
3. **Ghost Quorum Interferences:** Common-mode DC noise can corrupt inter-group separability ($S_d$) in Spectral Quorum.

### Core Solution (v4.0.0 Paradigm Shift)
Implement the **LLM Engine Manager**: an interactive, collapsible workbench dock anchored at the bottom-left (symmetrically opposite to *Visualization Controls* at the bottom-right). Styled with authentic **MagicWB AGA 3D chiseled bevels**, users can inspect the active model's hardware/tensor state, run the **Universal Structural Noise Detector** on-demand, toggle the **Outlier Pruning Shield** in real-time across metrics and 3D WebGL shaders, and inspect noise energy telemetries.

---

## 2. Empirical Grounding & Evidence (Level 1)

Every assertion in this specification is grounded in direct empirical measurements over the project's actual tensors.

### 2.1. Calibration on Active Model: `BAAI/bge-m3` (10,338 words × 1024-D)
Evaluated on `public/vocab_embeddings.npz`:
* **General Space:** Mean absolute coordinate $\bar{E} = 0.0234$, mean coordinate standard deviation $\bar{\sigma} = 0.0220$.
* **Rogue Outlier Coordinates (High Saturation, $Z_E \ge 3.0$):**
  * `Dim 386`: $\mu = +0.2867$, $\sigma = 0.0243$, mean energy $0.2867$, $Z_E = 19.74$ (**Energy Rank #1 / 1024**, $12.2\times$ average).
  * `Dim 297`: $\mu = -0.1738$, $\sigma = 0.0193$, mean energy $0.1738$, $Z_E = 11.28$ (**Energy Rank #2 / 1024**, $7.4\times$ average).
  * `Dim 780`: $\mu = -0.1670$, $\sigma = 0.0226$, mean energy $0.1670$, $Z_E = 10.76$ (**Energy Rank #3 / 1024**, $7.1\times$ average).
  * `Dim 376`: $\mu = +0.1286$, $\sigma = 0.0217$, mean energy $0.1286$, $Z_E = 7.89$ (**Energy Rank #4 / 1024**).
  * `Dim 65`, `Dim 404`, `Dim 80`, `Dim 58`, `Dim 577`, `Dim 549`, `Dim 38`: All exceed $Z_E \ge 3.0$ (Rank #5 to #11 in energy).
* **Dead / Inert Channels (`RUIDO_PLANO`, $\sigma \le 0.010$):**
  * `Dim 329`: $\mu = -0.0029$, $\sigma = 0.0094$ (**Energy Rank #1023 / 1024**).
  * `Dim 616`: $\mu = +0.0064$, $\sigma = 0.0047$ (**Energy Rank #1024 / 1024**, lowest variance in model).
* **Macroscopic Impact:**
  * **$L_2$ Energy Monopoly:** The 13 isolated coordinates ($\mathcal{D}_{\text{noise}} = \{38, 58, 65, 80, 297, 329, 376, 386, 404, 549, 577, 616, 780\}$, 1.27% of dimensions) concentrate **19.80% of the total squared $L_2$ norm** of all 10,338 words.
  * **Anisotropic Cosine Floor:** Mean pairwise cosine on a sample of 500 random words drops from **0.4981** (RAW) to **0.3829** (PRUNED), a background drop of $\Delta = -0.1152$.

### 2.2. Empirical Validation on Alternate Models in Catalog
* **`sentence-transformers/all-mpnet-base-v2` (768-D):**
  * **Absolute Dead Channels:** Dims 756, 555, 688, 34 have $\mu = 0.0000$ and $\sigma = 0.0000$ (exact zeros).
  * **Saturated Outliers:** Dims 99, 225, 51 have $>2.5\times$ average energy.
* **`paraphrase-multilingual-MiniLM-L12-v2` (384-D):**
  * **Saturated Outliers:** Dims 239, 195, 53 have $>2.3\times$ average energy.
  * **Inert Channels:** Dims 34, 326, 25 have minimum variance.

> **Architectural Invariant:** Hardcoding coordinate sets (e.g. `(292, 297, ...)`) in application code is strictly forbidden. Coordinate detection must be **model-aware and dynamic**.

---

## 3. Mathematical Formulation: Dual Pruning Protocol

Let $\mathbf{X} \in \mathbb{R}^{N \times D}$ be the embedding matrix (either the precomputed vocabulary or a calibration deck of $N \ge 100$ tokens).

### 3.1. Criterion A: Universal Saturation Outliers
Compute the mean absolute energy for each coordinate $d \in \{0, \dots, D-1\}$:
$$E_d = \frac{1}{N}\sum_{i=1}^N |x_{i,d}|$$
Compute the global energy mean $\bar{E} = \frac{1}{D}\sum_{d=0}^{D-1} E_d$ and standard deviation $\sigma_E = \sqrt{\frac{1}{D}\sum_{d=0}^{D-1}(E_d - \bar{E})^2}$.
A coordinate meets Criterion A if its standardized energy exceeds the threshold:
$$Z_E(d) = \frac{E_d - \bar{E}}{\sigma_E} \ge \theta_{\text{sat\_z}} \quad (\text{Default: } \theta_{\text{sat\_z}} = 3.0)$$

### 3.2. Criterion B: Thematic Indifference / Flat Channels
Compute the standard deviation of each coordinate:
$$\sigma_d = \sqrt{\frac{1}{N}\sum_{i=1}^N (x_{i,d} - \mu_d)^2}, \quad \mu_d = \frac{1}{N}\sum_{i=1}^N x_{i,d}$$
A coordinate meets Criterion B if its standard deviation is near zero:
$$\sigma_d \le \theta_{\text{flat}} \quad (\text{Default: } \theta_{\text{flat}} = 0.010 \text{ or } \sigma_d \le 0.35 \cdot \bar{\sigma})$$

### 3.3. Coordinate Taxonomy
| Classification | Mathematical Condition | Action |
| :--- | :--- | :--- |
| `RUIDO_AMBOS` | Meets Criterion A ($Z_E \ge 3.0$) AND Criterion B ($\sigma_d \le \theta_{\text{flat}}$) | Hard pruned |
| `RUIDO_SATURADO` | Meets Criterion A only ($Z_E \ge 3.0$) | Hard pruned (dominates $L_2$ norm) |
| `RUIDO_PLANO` | Meets Criterion B only ($\sigma_d \le \theta_{\text{flat}}$) | Hard pruned (zero entropy / dead channel) |
| `TRIGO_CANDIDATO`| Fails both noise criteria | Retained for genuine semantic representation |

### 3.4. Pruning Operator
For any vector $\mathbf{v} \in \mathbb{R}^D$ and noise index set $\mathcal{D}_{\text{noise}} = \text{saturated} \cup \text{flat}$:
$$\mathbf{v}^* = \mathbf{v} \odot \mathbf{m}_{\text{shield}}, \quad \mathbf{m}_{\text{shield}}[d] = \begin{cases} 0 & \text{if } d \in \mathcal{D}_{\text{noise}} \\ 1 & \text{if } d \notin \mathcal{D}_{\text{noise}} \end{cases}$$
Renormalized for metric calculation:
$$\hat{\mathbf{v}} = \frac{\mathbf{v}^*}{\|\mathbf{v}^*\|_2}$$

---

## 4. UI Architecture & Look & Feel (MagicWB AGA 3D Chiseled Bevels)

### 4.1. Visual Identity & Color System
The visual style for **v4.0.0** is rooted strictly in **Commodore Amiga / MagicWB AGA 1993** (Martin Huttenloher 8-Pen palette), rejecting generic modern AI tropes in favor of authentic microcomputing workstation heritage:

* **MagicWB 8-Pen Palette Integration:**
  * **Surface Background (`--amiga-bg`):** Darkened Graphite `#222222` / `#2A2A2A`.
  * **Window Titlebars & Main Accent (`--mwb-blue`):** MagicWB Cobalt Blue `#3B67A2`.
  * **Saturated Noise Accent (`--mwb-peach`):** MagicWB Peach `#FFA997` (used for outlier pills and cable line).
  * **Flat/Dead Noise Accent (`--mwb-tan`):** MagicWB Copper/Tan `#AA907C` (used for inert pills and secondary indicators).
  * **3D Highlights (`--mwb-white`):** Pure White `#FFFFFF` on top/left edges.
  * **3D Shadows (`--mwb-halfshadow` / `--mwb-black`):** `#1A1A1A` and `#000000` on bottom/right edges.

### 4.2. 3D Bevel Physics & Gadget Ergonomics
* **Raised 3D Bevels (Docks, Windows, Buttons):**
  ```css
  border-top: 3px solid #FFFFFF;
  border-left: 3px solid #FFFFFF;
  border-right: 3px solid #000000;
  border-bottom: 3px solid #000000;
  box-shadow: 2px 2px 0px rgba(0,0,0,0.85);
  ```
* **Inset 3D Sunken Wells (Metrics, Sliders, HUD Well):**
  ```css
  border-top: 2.5px solid #1A1A1A;
  border-left: 2.5px solid #1A1A1A;
  border-right: 2.5px solid #FFFFFF;
  border-bottom: 2.5px solid #FFFFFF;
  background: rgba(0,0,0,0.5);
  ```
* **Tactile Depress Feedback:** Buttons and gadgets shift 1px down-right on `:active` with reversed borders, providing physical tactile feedback.
* **Window Gadgets:** Square close and zoom/depth boxes in window titlebars.

### 4.3. Dual-Wing Dock Architecture
* **Bottom-Right:** `#visualization-controls-container` (`.viz-panel`) anchored at `right: var(--hud-pad)`, `bottom: calc(var(--hud-bottom) + var(--hud-height) - 1px)`. Handles optics, hex colors, and sign filtering.
* **Bottom-Left:** `#engine-manager-container` (`.engine-panel`) anchored at `left: var(--hud-pad)`, `bottom: calc(var(--hud-bottom) + var(--hud-height) - 1px)`. Handles model context, structural noise audit, outlier shield, and dual-path ribbon controls.
* **Z-Index & Collision:** `z-index: 45`. Both panels rest on the HUD top seam without overlapping. When collapsed, dock tabs stay parked on the HUD seam.

### 4.4. Visual Wireframe
```
┌────────────────────────────────────────────────────────┐
│ [■] ▼ LLM ENGINE MANAGER               [BAAI/bge-m3] [■]│
├────────────────────────────────────────────────────────┤
│ ┌─ SUNKEN METRICS WELL ──────────────────────────────┐ │
│ │ [⚡ RUN STRUCTURAL NOISE AUDIT]                     │ │
│ │ Energy Concentration: 15.90% L2 Norm               │ │
│ │ Baseline Anisotropy:  0.4981 → 0.4069 (Δ -0.0912)   │ │
│ │ ISOLATED OUTLIER AXES (3D BEVELED PILLS):          │ │
│ │ [386] [297] [780] [404] [577] [292] [308] (PEACH)  │ │
│ │ [329] [616]                                (TAN)    │ │
│ └────────────────────────────────────────────────────┘ │
│ [✓] Outlier Pruning Shield [3D ON]                     │
│ [ ] Dual-Path Ribbon (Ghost Raw vs Pure Semantic)      │
└────────────────────────────────────────────────────────┘
```

---

## 5. Execution Slices (TDD Workflow)

### Slice 1: Version Bump (v4.0.0) & Backend Core Math (`backend/structural_noise.py`)
* **Goal:** Immediate version promotion to **v4.0.0** across the stack, paired with the pure deterministic detection module.
* **Version Promotion Manifest:**
  - `manifest.json`: `"version": "4.0.0"`
  - `package.json`: `"version": "4.0.0"`
  - `backend/pyproject.toml`: `version = "4.0.0"`
  - `backend/server.py`: `version="4.0.0"`
  - `src/ui/Navbar.js`: `APP_VERSION = 'v4.0.0'`
  - `tests/navbarVersion.test.js`: Assert `v4.0.0`
  - `CHANGELOG.md`: Initialize `## [4.0.0] - 2026-10-26`
* **Core Math Files:**
  - `backend/structural_noise.py` (new)
  - `backend/tests/test_structural_noise.py` (new)
* **Contract:**
  ```python
  @dataclass(frozen=True, slots=True)
  class ModelNoiseProfile:
      model_name: str
      embedding_dim: int
      noise_indices: tuple[int, ...]
      saturated_indices: tuple[int, ...]
      flat_indices: tuple[int, ...]
      energy_ratio: float
      cosine_delta: float
      timestamp_utc: str

  def detect_structural_noise(
      embeddings: np.ndarray,
      model_name: str,
      sat_threshold_z: float = 3.0,
      flat_threshold_sigma: float = 0.010,
  ) -> ModelNoiseProfile: ...
  ```
* **TDD Unit Tests:**
  1. Version check: all manifests and navbar tests pass under `4.0.0`.
  2. Synthetic data with 3 synthetic spikes ($Z_E > 5$) and 2 zeroed columns ($\sigma = 0$) correctly isolates exact indices.
  3. Degenerate inputs ($N=1$, identical rows) fail-closed safely without NaN/division-by-zero.
  4. Real verification on `public/vocab_embeddings.npz`: isolates the 13 dimensions for `bge-m3` with `energy_ratio = 0.1980` and `cosine_delta = 0.1152`.
  5. Real verification on `all-mpnet-base-v2` isolates flat dimensions $\{34, 555, 688, 756\}$.

### Slice 2: Backend API & State Persistence (`backend/routers/engine.py`)
* **Goal:** Expose model status and noise profile endpoints, with automatic RAM/disk caching.
* **Files to create/modify:**
  - `backend/routers/engine.py` (new)
  - `backend/server.py` (bind `engine_router` with prefix `/api`)
  - `backend/state.py` (attach `noise_profile` cache to `AppState`)
  - `backend/tests/test_engine_router.py` (new)
* **Endpoints:**
  - `GET /api/engine/status`: `{ model_name, embedding_dim, accelerator, has_cached_profile }`
  - `POST /api/engine/detect-structural-noise`: Runs detection over `state.vocab_embeddings` (or encoded 500-deck if vocab is not loaded) and returns `ModelNoiseProfile`.
  - `GET /api/engine/noise-profile`: Returns cached JSON profile from `backend/artifacts/noise_profiles/{model_safe_id}.json`.
* **TDD Unit Tests:**
  1. `client.get("/api/engine/status")` returns HTTP 200 with matching model metadata.
  2. `client.post("/api/engine/detect-structural-noise")` returns HTTP 200 in $<150$ ms.
  3. Cache writes and reads round-trip cleanly without precision loss.

### Slice 3: Frontend Panel Scaffold & MagicWB AGA Styling (`src/ui/EngineManager.js`)
* **Goal:** Collapsible UI panel dock positioned at bottom-left above the HUD with heavy 3D chiseled bevels.
* **Files to create/modify:**
  - `src/ui/EngineManager.js` (new)
  - `src/ui/engineManagerDefaults.js` (new)
  - `src/theme/chrome.css` (MagicWB AGA 3D bevels, window titlebars, gadgets)
  - `src/style.css` (layout, dock-tab positioning)
  - `src/main.js` (mount `#engine-manager-container`, wire collapse)
  - `tests/EngineManager.test.js` (new Vitest)
* **Contract:**
  - Container: `#engine-manager-container.engine-panel.amiga-raised-box`
  - Tab: `.engine-panel-tab.dock-tab`
  - Storage key: `vl3d.engine.panelCollapsed`
  - Emits: `onAuditRequest()`, `onShieldToggle(enabled)`, `onDualPathToggle(enabled)`.
* **TDD Unit Tests:**
  1. Markup renders with accessible `aria-expanded`, window gadgets, and correct model info.
  2. Clicking `.engine-panel-tab` toggles `.is-collapsed` and writes to `localStorage`.
  3. Status updates render 3D chiseled noise pills (MagicWB Peach for saturated, MagicWB Tan for flat).

### Slice 4: Real-time Pruning Shield in Metrics (`src/ui/compareCosine.js`)
* **Goal:** In-memory subspace cosine re-calculation when Outlier Shield is active.
* **Files to create/modify:**
  - `src/ui/compareCosine.js`
  - `src/visualizer/spectralQuorum.js` (exclude $\mathcal{D}_{\text{noise}}$ from candidate pool)
  - `src/ui/CompareMode.js`
  - `tests/compareCosineNoiseShield.test.js` (new Vitest)
* **Functionality:**
  - When Shield is `ON`, pairwise cosine masks out `noise_indices` before dot-product.
  - Cosine list in Compare panel displays the pure cosine with a badge showing $\Delta$ (e.g. `0.4120 (-0.0861)`).
  - Spectral Quorum marks noise dimensions as `PRUNED_STRUCTURAL_NOISE` and forces $S_d = 0.0$.
* **TDD Unit Tests:**
  1. Cosine similarity of two vectors sharing a large constant offset decreases upon shield activation.
  2. Shield activation does not mutate the raw vector cache (`RAW` remains pristine).
  3. Spectral Quorum candidate set size equals $D - |\mathcal{D}_{\text{noise}}|$.

### Slice 5: WebGL 3D Shaders, Dual-Path Ribbon & Telemetry HUD
* **Goal:** Visual representation of noise in the 3D scene and instant hover readouts.
* **Files to create/modify:**
  - `src/visualizer/DivergentShading.js`
  - `src/visualizer/MeshFactory.js`
  - `src/visualizer/Instancer.js`
  - `src/ui/HUD.js`
  - `tests/shaderNoiseMask.test.js` (new Vitest)
* **Functionality:**
  - Shaders: Vertex attribute `aNoiseMask` (0.0 for noise axes, 1.0 for valid axes). When Shield is `ON`, the vertex position amplitude $Y$ for noise dimensions is flattened to zero, removing the "skyscraper" artifacts.
  - **Dual-Path Ribbon:** When enabled in Compare mode, renders a ghosted semi-transparent ribbon along the raw trajectory alongside the pure semantic trajectory.
  - **HUD Hover Telemetry:** Hovering over any 3D point resolves `resolveHoverTelemetry` and displays `NOISE: 15.9%` indicating the instantaneous ratio $\frac{\|e_{\text{noise}}\|_2}{\|e\|_2}$.
* **TDD Unit Tests:**
  1. Geometry vertex attributes `aNoiseMask` allocate correct length ($N \times D$).
  2. HUD telemetry correctly formats noise ratio percentage.
  3. 60 FPS performance maintained without geometry re-allocations on toggle.

---

## 6. Pre-flight Assumptions Audit & Discrepancy Checks

Before execution begins, the following technical assumptions have been verified against the codebase:

| Assumption | Verified Status | Verification Evidence |
| :--- | :--- | :--- |
| **API Proxy** | ✅ VERIFIED | `vite.config.js` proxies `/api` $\to$ `:8000`. Adding `/api/engine/*` requires zero frontend proxy changes. |
| **HUD Position** | ✅ VERIFIED | `--hud-pad` and `--hud-bottom` allow symmetrical docking at `left: var(--hud-pad)` without HUD collision. |
| **Model Agnosticism** | ✅ VERIFIED | `bge-m3` has 9 noise dims, `all-mpnet-base-v2` has 4 dead zeros (756, 555, 688, 34) and 3 outliers. Must not hardcode. |
| **In-Memory Embeddings** | ✅ VERIFIED | `state.vocab_embeddings` in `backend/state.py` holds $(10338, D)$ in RAM. Detection takes $<20$ ms on CPU/MPS. |
| **WebGL Shaders** | ✅ VERIFIED | `DivergentShading.js` already features `aCancel` attribute pipeline. `aNoiseMask` fits the exact same pattern. |
| **No regressions** | ✅ VERIFIED | 140/140 Python tests and 426/426 Vitest tests are green on `main`. |

---

## 7. Acceptance & Delivery Criteria

1. **Version Alignment:** Complete codebase, tests, manifests, and navbar reflect **v4.0.0** from the very first change.
2. **Deterministic Accuracy:** Running detection on `bge-m3` isolates $\{38, 58, 65, 80, 297, 329, 376, 386, 404, 549, 577, 616, 780\}$ with $19.80\% \pm 0.1\%$ energy ratio and $\Delta_{\cos} = 0.1152$.
3. **Speed:** Detection on 10,338 words completes in $<100$ ms on Apple Silicon / CPU.
4. **Zero Mutation:** Activating or deactivating the shield in UI leaves raw embeddings strictly unmutated.
5. **Clean UI State:** Collapsing and expanding `#engine-manager-container` preserves form and slider states. Mobile viewport collapses by default.
6. **Authentic 3D Bevels:** All docks, buttons, inputs, and pills exhibit 1993 MagicWB 3D chiseled bevel physics and active depression feedback.
7. **Suite Green:** 100% of existing tests (140 Python + 426 Vitest) plus all new tests pass without regressions.
