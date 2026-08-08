# Changelog

All notable changes to VHectorLab 3D will be documented in this file.

## [Unreleased]

### Added
- **Group contrast (Visualization panel)**: Compare ≥2 groups — Shared noise (same-sign → black by similarity %, ZC-style) + Sign conflict (opposite-sign highlight color × |Δ|, plus conflict coverage to black). Paint-only; gated until groups exist. Panel densified (~300px).
- **Public lab release hygiene**: MIT `LICENSE` (© 2026 Hector Bauzan); root README frames VHectorLab as a study/laboratory tool (not SaaS), links the live HF Space demo, and documents shared cpu-basic limits; `backend/README.md` aligned in English.

### Fixed
- **v25 Compare left layout**: `[data-panel]{display:flex}` overrode `[hidden]` and left a black flex gap above Compare; force-hide inactive slot. COMPARE now prefers NAVIGATION framing (usable with ~130 group tokens).

### Added
- **v25 SAE + viz filters** (Fase 11): live sign filter / color anchors / labels (LS); Compare Train SAE + Clean/Denoise encode/restore with filter bridge.
- **v25 Compare MODE** (Fase 10): header MODE switches Arithmetic↔Compare; Visualize → `/compare`; cosine-vs-REF list with reorder/sort; GROUP_* parse + legend + 3D group badges; bootstrap groups demo. No SAE.
- **v25 spatial sliders live** (Fase 9): Spacing/Distance/Amplitude/Length/Thickness rebuild canvas threads from cached Arithmetic payload (no new API); dblclick restores context defaults.
- **v25 canvas + engine wire** (Fase 8): mount existing `SceneSetup` / `Instancer` / `Navigation` / `Interaction` in `[data-zone="canvas"]`; startup `ARITHMETIC|ANALYSIS|POINTS`; threads after Calculate; hover → footer telemetry. Sliders still chrome-only (Fase 9).
- **v25 Arithmetic API wire** (Fase 7): Calculate → `RemoteProvider` `/arithmetic`; Top-10 list live; lab modal errors; ONLINE from `/health` (canvas still stub).
- **v25 right + HUD chrome** (Fase 6): spatial sliders (fluo thumb), viz filter/colors/labels, footer telemetry placeholders with safe-area.
- **v25 Arithmetic chrome** (Fase 5): Word A/B/C form, CALCULATE VECTOR CTA, Top-10 list host with §4.1 scroll floor (no API yet).
- **v25 header chrome** (Fase 4): brand VHectorLab-3D, version tag, MODE/VIEW/RENDER UI tabs, ONLINE badge (local state only).
- **v25 layout shell** (Fase 3): 5-zone grid (header / left / canvas / right / footer); mobile stack via legacy `MOBILE_MQ`.
- **v25 design tokens** (Fase 2): dark/fluo lab `:root`, Oxanium + IBM Plex Mono, `.lab-panel` / `.lab-btn` pressable utilities, WCAG contrast checks via `contrastRatio`.

## [2.4.0] - 2026-08-08

### Added
- **`/amiga/` MPA scaffold** (Slice 1): Magic Workbench skin — self-hosted Topaz (`Topaz_a1200`), serrucho (no AA), 8-pen MagicWB tokens; Vite MPA entry + `/amiga` → `/amiga/` redirect. Parallel to legacy `/` and `/v25/` (neither skin touched). Plan: `roadmap/amiga-workbench.md`.
- **Amiga colors via `.env`**: `VITE_AMIGA_PEN_0`…`_7`, `VITE_AMIGA_BG` / `_FG` / `_ACCENT` override CSS vars at boot (`resolveAmigaColors`); documented in `.env.example`.

## [2.3.0] - 2026-08-08

### Added
- **Galaxy VIEW** (in progress): new VIEW tab with UMAP/PCA/t-SNE chips (PCA/t-SNE grayed); entering Galaxy locks MODE=COMPARE + RENDER=POINTS.
- **`POST /project`**: backend UMAP projection of precomputed embeddings (`umap-learn`); pca/tsne → 501.
- **Bootstrap corpus**: `GROUP_it_core` (100 IT tokens) + existing `GROUP_1` / `GROUP_2` demos (REF inside IT core).
- **Galaxy layout**: one point per token from UMAP positions; group badges at centroids; camera frames IT core; no dim-axis ribbons.
- **Galaxy pipeline + progress**: client-driven encode → SAE? → UMAP → build with status text, progress bar, and step **k/n**; Visualize + SAE toggle in Galaxy; reuse `/compare` cache when texts unchanged.

## [2.2.1] - 2026-08-07

### Added
- **`/v25/` MPA scaffold** (Fase 1): `v25/index.html` + `src/v25/main.js` hello shell; Vite multi-page via `getViteInputs()`; FastAPI `resolve_dist_file` serves nested `dist/v25/index.html` (directory index). Legacy `/` unchanged.
- **GUI & Art v25 plan** (`roadmap/gui-art-v25.md` + `PROMPT-gui-art-v25.md`); epic index `gui-art.md` points agents at `/v25/` phases.

## [2.2.0] - 2026-08-07

### Added
- **Field-info tips ("i")** on every editable control (Arithmetic, Compare, SAE params, Spatial sliders, Visualization): short English tap tips, mobile-safe popover (not hover-only `title`).
- **HF Space cpu-basic demo path** (`feat/hf-space-cpu-demo`): Docker torch CPU (`UV_TORCH_BACKEND=cpu`), vocab embeddings NPZ at image build, `/health.device`, navbar `ONLINE (model · device)`, ARITHMETIC `localStorage` persistence (`vl3d.arithmetic.*`), setup option 7 smoke-run + option 8 `hf` create Space (docker / cpu-basic) + push, README Space YAML frontmatter.

### Changed
- **Repo / local folder slug**: GitHub + working copy **`vhectorlab`** (was `VHectorLab-3D`). Product name **VHectorLab 3D** unchanged; npm/manifest id stays `vhectorlab-3d`.
- **Landscape gate retired**: no more “Better in landscape” cartel — phone portrait is preferred.
- **Arithmetic Top-10**: list scrolls with a **120px floor** (`max(120px, min(…, dvh))`); on short viewports (≤560px) the whole Arithmetic panel scrolls so neighbors stay reachable. Mobile MQ also matches short landscape phones (`max-height: 500px` + `hover: none`) so touch chrome does not drop off.
- **Startup chrome**: default is **ARITHMETIC | ANALYSIS | POINTS** (was NAVIGATION).

### Fixed
- **`setup.sh` option 8**: defaults from `.env` (`HF_SPACE_ID`, `HF_SPACE_FORCE_PUSH=1`); skip create if Space exists; force-push to Space remote only (not GitHub) so Enter×N publishes over divergent predecessor history.
- **`setup.sh` idempotent start**: options 1/2 probe process + health before launch; skip bounce when already healthy; refuse when sick; restart both only on partial stack. README + lessons §8.7.
- **`setup.sh` Ctrl+C**: pauses log follow / exits panel without stopping services; only option 10 stops. Menu banner OS line removed.
- **`setup.sh` process group**: enable `set -m` so backend/vite are not in the panel PGID (Ctrl+C was killing the stack). Healthy path also skips tests.
- **`setup.sh` detached session**: replace `set -m` with `start_new_session` launch (Vite was freezing at STAT T / sick). Option 1 recycles sick stacks instead of aborting.
- **Offline modal**: no longer hardcodes `127.0.0.1:8000` (works for local setup + HF Space).
- **Uvicorn reload**: off by default when `HOST=0.0.0.0` or `UVICORN_RELOAD=0` (Docker/HF).

## [2.1.1] - 2026-08-03

### Changed
- **Rebrand**: product name **VectorLab 3D** → **VHectorLab 3D** (UI, docs, package manifest).

### Fixed
- **HUD ACTIVATION stuck at 0.0000**: resolve hover from `pointsData[index]` / ribbon `activations`; adaptive precision up to 32 decimals (shrink / scientific / `ACT:` on narrow mobile slots).

## [2.1.0] - 2026-08-02

### Added
- **COMPARE group contrast visibility** (`feat/compare-group-contrast-viz`):
  - Amplitude default **16** for `COMPARE|ANALYSIS|POINTS` and RIBBONS twin (was floor `1.0`).
  - SAE ON auto-sets Visualization filter to **+ Only**; SAE OFF restores the previous filter.
  - Soft Y gap (+1× Dist Y) between contiguous `GROUP_*` blocks in ANALYSIS.
  - Toggle **Sort dims by group contrast** (session-only, OFF default; visible when ≥2 groups) — permutes X by max pairwise `|Δmean|`.
  - Cosine ▲/▼ disabled while groups are active (preserves block layout).

### Changed
- Roadmap decisions D1–D12 closed (pack 1: L1+L2; L3 deferred; SemVer MINOR).

## [2.0.0] - 2026-08-02

### Added
- **Top‑K SAE Clean/Denoise** (`feat/topk-sae-denoise`): trained Sparse Autoencoder (PyTorch), **not** L1 SAE and **not** sinusoidal fake projection.
  - Defaults: 768 → 8192 latents (cap), K=32; **train on current Compare/Arithmetic scope** (not full vocab); **ephemeral in-RAM** session model; `suggest_sae_dims` auto-scales for small N; clear on Visualize/Calculate.
  - API: `GET /api/sae/status`, `POST /api/sae/train` (embeddings + async poll), `POST /api/sae/encode` (**Top‑K sparse** `indices`/`values` + `ORJSONResponse`; client densifies), `POST /api/sae/clear`.
  - UI: Compare-only 50/50 CTA `[ VISUALIZE | Clean/Denoise (SAE) ]`, Train SAE + params, progress, metrics strip. **No SAE in Arithmetic.**
  - Semantics: SAE ON **replaces** all Arithmetic/Compare vectors used for 3D + cosine with sparse activations; OFF restores cached raw 768D. Preference in `localStorage` (`vl3d.sae.*`). Scope change invalidates the session SAE.
  - Encode I/O: wire format is `[N, K]` indices+values (not dense `[N, hidden]`); model singleton stays in RAM after first `load_model()`.
- **Zero coverage %** (carried onto this branch): Visualization panel slider expands how much of |t| stays at the zero/black color before blending to ±1 (cap 90%); `vl3d.viz.zeroCoverage`.
- **Hide/Show labels** in Visualization panel: toggles floating thread/group badges; persists `vl3d.viz.labelsVisible`.
- **SAE camera framing**: on Clean/Denoise toggle ON, dim-axis pitch scales so sparse features keep ~RAW wall width; camera soft-lerps to content bounds (ANALYSIS front / NAVIGATION angled). OFF restores Length + context pose with lerp. Empty train hyperparams no longer clamp to 32/k=1.

## [1.8.0] - 2026-08-02

### Added
- **Visualization Controls** (`feat/visualization-sign-color-controls`): right-dock panel under 3D Spatial Controls.
  - Sign filter: `All | + Only | − Only` on **normalized** activations (ε=0.01); hides opposite sign and near-zero for ± only.
  - Applies to POINTS (shader discard) and RIBBONS / continuity lines (index omission) in ARITHMETIC + COMPARE.
  - Three hex color anchors (+1 / 0 / −1) replace the fixed mid-stop divergent ramp; defaults `#FFE600` / `#000000` / `#9900E6`.
  - POINTS shader uniforms `uColorPos` / `uColorNeg` / `uColorZero`; live update + `localStorage` (`vl3d.viz.*`) + Reset.
  - Edge collapse tab (dock-tab affordance) slides the Visualization card to a thin strip; persists `vl3d.viz.panelCollapsed`.

## [Unreleased]

### Changed
- **Defaults COMPARE|ANALYSIS|POINTS** (`feat/compare-analysis-points-defaults`):
  - Sliders: Spacing `1.45`, Dist Y `1.0`, Amp `1.0`, Length `0.2`, Thickness `0.01`.
  - Camera: `POS (-150.3, 0.7, 276.6)` / `ROT (-0.5, 0.9, 0)`.

### Fixed
- **Defaults COMPARE|NAVIGATION|RIBBONS + fog off for RIBBONS** (`feat/compare-nav-ribbons-defaults-no-fog`):
  - Sliders: Spacing `1.55`, Dist Y `10`, Amp `7`, Length `0.057`, Thickness `0.05`.
  - Camera: `POS (-575.8, 43.8, 237.9)` / `ROT (-22.4, -35.7, 0)`.
  - `setFogForRenderMode('RIBBONS')` clears scene fog; POINTS keeps soft FogExp2.
  - Compare+RIBBONS no longer mounts the POINTS cloud (square dots on strips).
- **RIBBONS dark rectangle through translucent strips** (`fix/remove-ribbons-base-plane`): stop mounting `createBasePlaneForThreads` under wide ribbons (Arithmetic + Compare). Factory helpers retained unused.
- **Remove floor GridHelper** (`fix/remove-scene-grid`): no reference grid under the 3D scene (cleaner RIBBONS/COMPARE views).
- **Scene fog too dense for far RIBBONS** (`fix/soften-scene-fog`): `FogExp2` density `0.008` → `0.0008` so ribbons stay readable at COMPARE-scale camera distance; avoids distance “creeping” darkening. POINTS unaffected (custom shader).

### Changed
- **Spacing (X) range → `[0.4, 2.0]`** (`feat/spacing-range-center-compare`): same track for all MODE|VIEW|RENDER; COMPARE default `0.7` unchanged. Other combo defaults unchanged (Amp/Thickness ranges untouched).
- **Length (Z) range → `[0.001, 0.2]`** step `0.001`, label 3 decimals: never reaches 0; COMPARE `0.1` ≈ mid; global/Analysis `0.2` at max.
- **Defaults COMPARE|NAVIGATION|POINTS** (`feat/compare-nav-points-defaults`):
  - Sliders: Spacing `0.7`, Vector Distance `10`, Amplitude `4.9`, Length `0.1`, Thickness `0.01`.
  - Camera: `POS (-106.5, 20.4, 390.2)` / `ROT (-3.9, -8.4, 0)` via `cameraViewDefaults.js`.
  - Camera poses now resolve per MODE|VIEW|RENDER (VIEW fallbacks + overrides); applied with sliders on context change.
  - First COMPARE entry loads full EN auto-manual lexicon (`COMPARE_AUTO_PRESETS.default`), not `sample5`.
- **English-only product UI** (`feat/english-user-facing-copy`): Navbar VIEW/ANALYSIS/NAVIGATION, spatial slider labels, Arithmetic/Compare buttons, Compare empty/sort/copy + EN auto-parts presets, landscape gate. Internal `data-view` / mode keys unchanged. Test titles and in-scope `src/` comments translated to EN; historical CHANGELOG entries left in Spanish.
- **Docs: English-only UI roadmap** — glossary + D6–D8 closed (EN Compare vocab; EN test titles/comments; keep historical CHANGELOG in Spanish). See `roadmap/english-ui-i18n.md` + `roadmap/PROMPT-english-ui.md`.
- **ThreadLabels cortas** (`feat/short-thread-labels` + `fix/compare-labels-full-tokens`):
  - Arithmetic 3D: `WORD_A` / `WORD_B` / `WORD_C` / `RES` / `TOP1` (sin badge de tipo).
  - Compare 3D: token completo ingresado (sin `TOPn` / sin truncar) — todos los items de la secuencia.
- **Defaults ARITHMETIC|ANALYSIS|POINTS** (`feat/arithmetic-analysis-points-defaults`):
  - Sliders: Separación `0.4`, Distancia Y `10`, Amplitud Y `40`, Longitud Z `0.2`, Grosor `0.05` (override en `spatialSliderDefaults.js`).
  - Cámara Análisis: `POS (-75.2, -0.8, 62.5)` / `ROT (0, 0, 0)`.
  - Al cambiar MODE/VISTA/RENDER se reaplica el preset resuelto + sync de sliders.
- **Grosor Puntos mid → 0.05** (`feat/thickness-mid-0.05`):
  - Default/mid `0.05` ∈ `[0.01, 0.09]` step `0.01` (simétrico lineal).
- **Amplitud (Y) max → 40** (`feat/amplitude-y-max-40`):
  - Rango `[1.0, 40.0]` step `0.1`; default sigue en `7.0` (asimétrico — sin regresión del punto dulce al load).
- **Control Espacial 3D — dblclick reset** (`feat/spatial-slider-dblclick-reset`):
  - Doble clic en un slider restaura solo ese valor al default del contexto MODE/VISTA/RENDER (hoy = global mid; overrides listos en `spatialSliderDefaults.js`).
- **Control Espacial 3D — finer steps** (`feat/finer-spatial-slider-steps`):
  - Gradual intermediate values: Separación step `0.05` (2 dec), Distancia/Amplitud Y step `0.1` (1 dec), Longitud/Grosor step `0.01` (2 dec). Min/max/mid unchanged.
- **Control Espacial 3D — ranges re-centrados** (`feat/recenter-spatial-slider-ranges`):
  - Defaults (punto dulce) son el mid lineal de cada slider: Separación X `0.4` ∈ `[0.1, 0.7]`, Distancia Y `10` ∈ `[1, 19]`, Amplitud Y `7` ∈ `[1, 13]`, Longitud Z `0.2` ∈ `[0.1, 0.3]`, Grosor `0.10` ∈ `[0.05, 0.15]`.
  - Corrige Distancia Y y Grosor pegados al mínimo al load.

### Added
- **Ngrok / phone dev access** (`feat/ngrok-dev-access`):
  - Vite `allowedHosts` + `/api` proxy to `127.0.0.1:8000` (prefix proxy — not per-route).
  - `VITE_API_BASE_URL=/api` enabled in `.env` / `.env.example`; `RemoteProvider` honors it.
  - Lesson §6.1: new backend routes under `/api` need no Vite remap.

## [1.7.0] - 2026-08-02

### Added
- **COMPARE groups** (`feat/compare-group-labels`): parse `GROUP_name = tokens…` in the textarea; concatenate groups into the sequence; floating `GROUP_*` badges at member centroids. Preset **2 Groups**. Anchor remains global #1; cosine sort is global (may break contiguity). When groups are active, overlay shows group badges only (token cards hidden — still listed in cosine panel); label layer z-index above docks so badges stay visible.

### Fixed
- **COMPARE group badges never appeared** (`feat/compare-group-labels`): `ComparePanel` → `handleCalculateCompare` callback dropped `tokenMeta`, so `groupId` never reached Instancer/ThreadLabels (token stack stayed, no `GROUP_*`).

## [1.6.0] - 2026-08-02

### Removed
- **RENDER: MESH** (`chore/remove-render-mesh`): surface heightfield mode retired from navbar and runtime. Supported modes: POINTS | RIBBONS. `normalizeRenderMode` maps legacy `"MESH"` → POINTS. Deleted `createSurfaceMesh` / `updateSurfaceMeshPositions` and `tests/MeshSurface.test.js`.

## [1.5.0] - 2026-08-01

### Added
- **RENDER: RIBBONS + base plane (Etapa E)**:
  - `MeshFactory.createWideRibbonMesh` / `createBasePlane` — real-width quad strips + translucent ground (no Line linewidth).
  - `Instancer` mutually exclusive branch for `RIBBONS` (Arithmetic + Compare); compare reorder updates wide ribbons in-situ.
  - Vitest: `tests/MeshRibbons.test.js`.

## [1.4.0] - 2026-08-01

### Added
- **RENDER: MESH surface (Etapa D)**:
  - `MeshFactory.createSurfaceMesh` — indexed quad heightfield (threads × dims), divergent colormap.
  - `Instancer` branches on `renderMode === 'MESH'` (no Points); Arithmetic + Compare; compare reorder updates surface in-situ.
  - Vitest: `tests/MeshSurface.test.js`.

## [1.3.0] - 2026-08-01

### Added
- **Mobile touch navigation (Etapa C)**:
  - Virtual joystick (move) + canvas finger-drag look + ▲/▼ (Q/E) via `TouchControls` → `Navigation.setMoveAxes` / `applyLookDelta` / `setVertical`.
  - UI touches on docks/HUD/navbar do not steal look; desktop WASDQE path unchanged (`lerp` §3.1).
  - Vitest: `tests/TouchControls.test.js`.

## [1.2.0] - 2026-08-01

### Added
- **Responsive phone layout + landscape-first gate (Etapa B)**:
  - Soft portrait overlay (`LandscapeGate`) with dismiss → `sessionStorage`; tablet/desktop unaffected; render loop never pauses.
  - `@media (max-width: 768px)`: compact navbar, ≥44px targets, ≥16px inputs, safe-area insets, docks as overlay drawers.
  - Vitest coverage in `tests/LandscapeGate.test.js`.

## [1.1.0] - 2026-08-01

### Added
- **Collapsible side docks (Etapa A)**:
  - `CollapsibleDock` (`src/ui/CollapsibleDock.js`): left/right docks with edge tabs, ~250ms `transform` slide, no DOM unmount, `aria-expanded` on the tab.
  - **Left dock**: hosts Arithmetic *or* Compare (MODE). Shared collapsed state across MODE switches (same `localStorage` key `vl3d.dock.left.collapsed`).
  - **Right dock**: spatial sliders + `AxisGizmo` (D1). Key `vl3d.dock.right.collapsed`.
  - Desktop persists collapsed in `localStorage`; mobile probe (`max-width: 768px`) defaults collapsed and skips persist (D4 hook for Etapa B).
  - Bottom telemetry HUD remains always visible (D3).
  - Vitest coverage in `tests/CollapsibleDock.test.js`.

## [1.0.0] - 2026-08-02

### Added
- **COMPARE Cosine-vs-Anchor List + 3D Reorder Tween**:
  - `/compare` response enriched with `anchor` and per-item `cosine_vs_first` (dot product vs L2-normalized first token).
  - `ComparePanel` scrollable similarity list under ACTIVE SEQUENCE METRICS (`SIMILITUD COSENO vs «…»`), REF badge on #1, per-row ▲/▼ reorder, and header ▼/▲ sort (desc/asc by score, REF stays #1) without camera focus.
  - Default COMPARE presets use Spanish auto-manual vocabulary (`rueda`, `motor`, `freno`, `volante`, `embrague`, carrocería, fluidos, …); buttons 5/20/50 slice that lexicon.
  - In-memory score recompute on reorder (no backend re-call); `Instancer.animateCompareReorder` lerps thread layout slots (~320ms ease-out) while reusing ribbon/points meshes; `ThreadLabels.updateOrigins` follows during the tween.
  - Panel scrollbar invariant preserved: scroll only inside `.compare-cosine-list`.
- **Camera Pose Overlay (`VITE_SHOW_CAM_POSE`)**: Optional live `POS`/`ROT` HUD for capturing default navigation views. Gated by Vite env var; default `false` (see `.env.example`).
- **Square / Cube Point GLSL Shader (`src/visualizer/DivergentShading.js`)**:
  - Replaced circular disc discard in `divergentFragmentShader` with axis-aligned square box distance calculation (`max(coord.x, coord.y)`).
  - Crisp 1-pixel anti-aliased square bounding edge using `smoothstep(0.44, 0.49, maxDist)` for sharp 3D point cloud rendering.
- **Vertical Origin Baseline in Analysis Mode (`src/visualizer/Instancer.js` & `MeshFactory.js`)**:
  - Vertical reference baseline mesh connecting thread origins at $X = \text{startX}$ in Analysis mode.
  - Rendered with subtle cyan/gold glass opacity (`opacity: 0.6`, `transparent: true`, `frustumCulled: false`).
- **Dual Workspace Mode Selector (`MODE: [ ARITHMETIC | COMPARE ]`)**:
  - Navbar top selector buttons `MODE: [ ARITHMETIC | COMPARE ]`.
  - `ComparePanel` sidebar component (`src/ui/ComparePanel.js`) supporting sequence inputs of **1 to 1024 tokens**.
  - Fast-loading preset buttons (5, 20, 50 tokens).
  - Multi-sequence 3D WebGL layout engine in `Instancer.js` (`renderCompareData`).
- **Backend Batch Compare Endpoint (`/compare`)**:
  - Pydantic `CompareRequest` accepting 1 to 1024 text/token items.
  - Fast batch encoding and L2 normalization in `AppState.perform_compare`.
  - Full Pytest coverage in `backend/tests/test_backend.py`.

### Changed
- **Default Navigation Camera Pose (`src/engine/Navigation.js`)**: Startup `NAVEGACIÓN` view locked to captured corridor pose `POS (-178.3, 13.5, 52.2)` / `ROT (-5.4°, -51.5°, 0°)` with matching spatial slider defaults (Separación `0.4`, Amplitud `7.0`).
- **Top-10 UI Space Optimization (`src/ui/Sidebar.js` & `src/style.css`)**:
  - Removed Top-K dropdown selector from sidebar.
  - Locked `top_k` parameter to `10` across form inputs and API calls.
  - Compact Top-10 rows (tighter padding/gap) so the Vector Arithmetic panel fits without a scrollbar; panel uses `height: fit-content` + `overflow: hidden`.

## [0.2.0] - 2026-08-02

### Added
- **Vista de "Análisis" 3D con Encuadre Frontal y Cartelitos (`src/ui/ThreadLabels.js` & `src/visualizer/LayoutEngine.js`)**:
  - Vista por defecto al iniciar la app con cámara frontal (`Z=360`) encuadrando todos los hilos vectoriales de frente sin necesidad de desplazarse.
  - Selector en la Navbar superior: `VISTA: [ ANÁLISIS | NAVEGACIÓN ]` junto al selector de RENDER.
  - Apilamiento vertical en el eje $Y$ con separación constante para los hilos `word_a`, `word_b`, `word_c` y `res`, manteniendo activaciones $+1$ (hacia arriba) y $-1$ (hacia abajo).
  - Sliders de control espacial 3D ampliados (`src/ui/ThreadSliders.js`): **Distancia Vectores (Y)** (distancia entre baselines de los 5 hilos) y **Amplitud (Y)** (escalado de la altura de picos $+1$ y valles $-1$ con rango ampliado de $1.0$ a $240.0$).
  - Inclusión del 5.º hilo `#1 COS VECTOR` posicionado debajo de RESULT VECTOR.
  - Cartelitos flotantes Glassmorphic vinculados en tiempo real a la proyección 3D del inicio de cada hilo.
  - Tests unitarios en `tests/ThreadLabels.test.js` y `tests/LayoutEngine.test.js`.

### Changed
- **Simplificación de Rampas Cromáticas Divergentes por Activación 3D (`src/visualizer/DivergentShading.js`)**:
  - Eliminación de pasos intermedios de colores Rojo (rango positivo) y Verde (rango negativo) para transicionar directamente desde Negro/Transparente.
  - Nueva rampa positiva ($0 \rightarrow +1$): Negro (`vec3(0.0)`) $\rightarrow$ Naranja (`#FF8000`) $\rightarrow$ Amarillo Incandescente (`#FFE600`).
  - Nueva rampa negativa ($0 \rightarrow -1$): Negro (`vec3(0.0)`) $\rightarrow$ Azul Eléctrico (`#0040FF`) $\rightarrow$ Violeta Neón (`#9900E6`).
  - Optimización computacional GPU/GLSL y CPU para $|t| < 0.01$: retorno directo de opacidad mínima ($\alpha \approx 0.05$) evitando operaciones de interpolación no necesarias.
  - Cobertura de tests unitarios en `tests/DivergentShading.test.js` actualizada y extendida.

## [0.1.0] - 2026-08-01

### Added
- **Divergent Activation Shading (`roadmap/archivo/Shading Divergente por Activación.md`)**:
  - Solid Circular Point GLSL Shader (`src/visualizer/DivergentShading.js`) rendering crisp, solid circular points with 1-pixel anti-aliasing edges instead of blurred halos.
  - Dual Multi-Stop Color Ramps (`src/visualizer/DivergentShading.js`): Positive range ($0 \rightarrow +1$) transitions Negro $\rightarrow$ Rojo $\rightarrow$ Naranja $\rightarrow$ Amarillo. Negative range ($0 \rightarrow -1$) transitions Negro $\rightarrow$ Verde $\rightarrow$ Azul $\rightarrow$ Violeta.
  - Full integration in `MeshFactory.js` and `Instancer.js` connecting all 3D thread vector points with continuous ribbon lines.
  - Integration with `ThreadFactory.js` buffer attributes (`intensity`, `color`) and `frustumCulled = false` invariant.
  - Real-time spatial control sliders (`src/ui/ThreadSliders.js`) updated with specified ranges ($X \in [0.1, 10.0]$, $Z \in [0.1, 5.0]$, Grosor Puntos $\in [0.1, 1.0]$ con valor por defecto $0.3$).
  - TDD unit test suite (`tests/DivergentShading.test.js`) verifying multi-stop color ramp math.

- **Thread Geometry & Spatial Sliders 3D (`roadmap/archivo/sliders.md`)**:
  - Synthetic 3D vector thread data factory (`src/visualizer/ThreadFactory.js`) generating buffer geometries for 3D lines and point nodes.
  - In-situ GPU Float32Array buffer mutator (`updateAllThreadPositions` in `src/visualizer/LayoutEngine.js`) ensuring zero re-creation of geometries and zero memory leaks.
  - Interactive spatial control UI panel (`src/ui/ThreadSliders.js`) with real-time 60fps sliders for lateral separation ($X$), longitudinal scale ($Z$), and node thickness.
  - Pure layout math functions (`executeLayoutMath`) with Vitest test coverage (`tests/LayoutEngine.test.js`).
  - WebGL scene manager (`src/engine/Scene.js`) with perspective camera, lights, and reference grid at $Y=0$.

- **Backend Core (Phase 1)**:
  - FastAPI server with lifespan lazy-loading of SentenceTransformer (`all-mpnet-base-v2`).
  - Pre-computed vocabulary embedding matrix in RAM for fast cosine similarity lookup.
  - Core API endpoints: `/health`, `/embed`, `/tokenize`, and `/arithmetic` ($A - B + C$).
  - Vocabulary generator script `scripts/generate_vocab.py` with custom word count and URL source support.
  - Heartbeat test runner `backend/perform_tests.py`.
  - Full unit test suite with `pytest`.

- **WebGL 3D Engine & Shaders (Phase 2)**:
  - Fixed WASD camera flight controller (`src/engine/Navigation.js`) with linear velocity interpolation (`lerp`) and input safety (ignoring keys when focused on UI form inputs and clearing inputs on window blur).
  - Custom GLSL point shader with glowing incandescent halos and anti-aliased radial smoothing (`src/engine/Shaders.js`).
  - Three.js 3D scene orchestrator with dark background (`#050505`), fog, and reference grid (`src/engine/SceneSetup.js`).
  - Inertial flight camera controller with WASDQE, mouse drag look, and Shift turbo acceleration (`src/engine/Navigation.js`).
  - Raycaster mouse picking for 3D vector points (`src/engine/Interaction.js`).
  - Spatial 3D layout mapper for vector dimension coordinates $X, Y, Z$ (`src/visualizer/LayoutEngine.js`).
  - GPU instancing and Mesh factory enforcing `frustumCulled = false` invariant (`src/visualizer/MeshFactory.js` & `Instancer.js`).
  - Corner 3D orientation axis gizmo (`src/visualizer/AxisGizmo.js`).
  - Vitest test suite (`npm test`).

- **Control Panel & Hugging Face Deployment (Phase 4)**:
  - Interactive CLI control panel (`setup.sh`) supporting dev mode, bare-metal server, heartbeat, vitest, pytest, vocabulary management, and HF Spaces deployment.
  - Custom vocabulary management allowing custom file loads or generation of N words.
  - Monolithic production Dockerfile for Hugging Face Spaces serving FastAPI on port `7860`.
  - Static files serving integration in `backend/server.py` for bundled `dist/` production assets.
