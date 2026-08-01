# Changelog

All notable changes to VectorLab 3D will be documented in this file.

## [0.1.0] - 2026-08-01

### Added
- **Divergent Activation Shading (`roadmap/Shading Divergente por Activación.md`)**:
  - Custom GLSL ShaderMaterial & CPU helper (`src/visualizer/DivergentShading.js`) mapping activation values $v \in [-1.0, 1.0]$ to Red ($v>0$), Black ($\alpha \approx 0.05$ for $v=0$), and Violet ($v<0$) with dynamic $|v|^{1.2}$ opacity.
  - Integration with `ThreadFactory.js` buffer attributes (`intensity`, `color`) and `frustumCulled = false` invariant.
  - Real-time spatial control sliders (`src/ui/ThreadSliders.js`) updated with specified ranges ($X \in [0.1, 10.0]$, $Z \in [0.1, 5.0]$, Thickness $\in [1.0, 10.0]$).
  - TDD unit test suite (`tests/DivergentShading.test.js`) verifying activation color math.

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
