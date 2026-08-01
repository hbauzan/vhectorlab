# Changelog

All notable changes to VectorLab 3D will be documented in this file.

## [0.1.0] - 2026-08-01

### Added
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
