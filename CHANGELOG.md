# Changelog

All notable changes to VectorLab 3D will be documented in this file.

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
- **Divergent Activation Shading (`roadmap/Shading Divergente por Activación.md`)**:
  - Solid Circular Point GLSL Shader (`src/visualizer/DivergentShading.js`) rendering crisp, solid circular points with 1-pixel anti-aliasing edges instead of blurred halos.
  - Dual Multi-Stop Color Ramps (`src/visualizer/DivergentShading.js`): Positive range ($0 \rightarrow +1$) transitions Negro $\rightarrow$ Rojo $\rightarrow$ Naranja $\rightarrow$ Amarillo. Negative range ($0 \rightarrow -1$) transitions Negro $\rightarrow$ Verde $\rightarrow$ Azul $\rightarrow$ Violeta.
  - Full integration in `MeshFactory.js` and `Instancer.js` connecting all 3D thread vector points with continuous ribbon lines.
  - Integration with `ThreadFactory.js` buffer attributes (`intensity`, `color`) and `frustumCulled = false` invariant.
  - Real-time spatial control sliders (`src/ui/ThreadSliders.js`) updated with specified ranges ($X \in [0.1, 10.0]$, $Z \in [0.1, 5.0]$, Grosor Puntos $\in [0.1, 1.0]$ con valor por defecto $0.3$).
  - TDD unit test suite (`tests/DivergentShading.test.js`) verifying multi-stop color ramp math.

- **Thread Geometry & Spatial Sliders 3D (`roadmap/sliders.md`)**:
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
