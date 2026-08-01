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
