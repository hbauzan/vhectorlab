# Changelog

All notable changes to VectorLab 3D will be documented in this file.

## [Unreleased]

### Changed
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
