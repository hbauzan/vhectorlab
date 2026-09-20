# Prompt — AI Agent Kickoff: Dual-Engine Deep Dimensional Inspection Integration

> **Target Epic**: [`dual-engine-inspection-integration.md`](./dual-engine-inspection-integration.md)  
> **Repo**: `vhectorlab` (Python 3.11+ / `uv` + Vite / Three.js)  
> **Protocol**: Follow `.agents/skills/dev-protocol/SKILL.md` strictly.

Copy and paste the code block below into a **NEW** session with a coding AI agent.

---

```text
Using dev-protocol, execute the roadmap for Dual-Engine Deep Dimensional Inspection Integration (DDI-Lab).

## Context & Mandatory Reading
1. Repository: VHectorLab 3D (vhectorlab).
2. Protocol: Read `.agents/skills/dev-protocol/SKILL.md` and `.agents/skills/dev-protocol/lessons-learned.md`.
3. Master Roadmap: Read `roadmap/dual-engine-inspection-integration.md` COMPLETELY before writing code.
4. Theoretical Background: `dual-engine-extended-inspection.md` and `current-research/DISCOVERY-shared-noise-embedding-geometry.md`.
5. Active Architecture Spec: `architecture_spec.md`.

## Execution Rules
- Execution Mode: Strictly SERIAL — execute EXACTLY ONE SLICE per session.
- Start at Slice 1 unless the human explicitly asks for a different slice number.
- TDD is mandatory: write unit tests first, verify red, implement, verify green.
- Environment: Exclusively use `uv` for Python (`uv run pytest`) and `npm test` for JavaScript.
- No-Fluff: Do not leave placeholder comments, `# TODO`, or partial implementations.
- APPROVAL GATE: When the slice DoD is met and tests are green, report your changes, provide exact instructions on how to test, and STOP. Wait for the human's explicit approval before any git push or merge.

## Slices Overview
- Slice 1: Backend Memory Hygiene & Sequential Cache Clearance (clear_runtime_cache, unload_model)
- Slice 2: Storage Integrity Checksums, Device Metadata & Coordinate Extrema Contract (vocab_source_sha256, device in /health, extrema in /compare)
- Slice 3: Catalog Expansion — Integrate BAAI/bge-m3 (1024-D unban, local-bge profile)
- Slice 4: Frontend Adaptive Coordinate Scaling & Extrema Ingestion (LayoutEngine & DivergentShading dynamic range)
- Slice 5: Contrast Metric — Interval Gap & Quantile Disjointness (dimContrastSort.js interval-gap)
- Slice 6: Visual Bounding Envelopes & Domain Overlap Ribbons (MeshFactory & Instancer [lo, hi] ribbons)
- Slice 7: Census CSV Ingestion & External Dimension Masking (activationFilter & drop handler for Top-500 CSV)

## Target Slice for this Session
Execute SLICE 1:
- Implement `clear_runtime_cache()` in `backend/device.py` (purging CUDA/MPS caches and running `gc.collect()`).
- Add `unload_model()` to `AppState` in `backend/state.py`.
- Call `clear_runtime_cache()` in `backend/model_swap.py` during NPZ rebuilds.
- Create unit test in `backend/tests/test_memory_hygiene.py` and ensure `uv run pytest` is green.
- Hand off at Approval Gate.
```
