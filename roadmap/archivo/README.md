# Archivo de roadmaps

> **Archivado:** 2026-08-02 (índice; entradas individuales llevan su propia fecha)  
> Documentos de planificación ya ejecutados o superados. Cada archivo lleva al inicio la fecha de archivo y las ramas / versiones implementadas.

No editar salvo corrección histórica. Para trabajo nuevo, crear un roadmap vivo fuera de esta carpeta o un issue/PR.

**Reciente (2026-10-26):**
- `structural-noise-engine-manager.md` + prompts 1 a 5 — Universal Structural Noise & LLM Engine Manager: detección dinámica de canales saturados/planos, API REST y caché de perfiles, panel Amiga Workbench docked al HUD, Outlier Pruning Shield en métricas de coseno y Spectral Quorum, shaders WebGL in-situ (`aNoiseMask`, `uShieldEnabled`), cinta Dual-Path `#FFA997` y telemetría de HUD $L_2^2$ (shipped **v4.1.0**, commits `9426d3c` a `cae738d`).
- `hardware-aware-model-selector-benchmark.md` + prompts — Selector inteligente de embeddings consciente de hardware (CPU/RAM/MPS/CUDA), micro-benchmark local y soft-gate en `setup.sh` Opción 11 (commits `9c02602` a `5650cca`).
- `spectral-quorum-determinism.md` — Spectral Quorum Determinista: separabilidad bidireccional $S_d$, calibración nula Westfall-Young maxT ($M=1000$), Float64 exacto y exportación auditable alineada con DDI-FW (shipped **v3.4.0**, commits `8f9668d` a `9c3d0f7`).

**Histórico previo (2026-09-19):**
- `multillm/` — Catálogo multi-embedding, perfiles y `setup.sh` opción 11 (implementado/cerrado para v1).
- `HANDOFF-shared-noise.md`, `shared-noise-omit-common.md`, `open-shared-noise-knob.md` — Ciclo de investigación de ruido compartido y drafts de omit-common archivados en favor de la nueva arquitectura dimensional.
- `multiplatform-setup.md`, `PROMPT-multiplatform-setup.md` — Setup Linux/Windows archivado / en parking.
- `shared-noise-coverage-knobs.md` + prompt — Shipped **2.4.3** (token-batch Shared noise + A/mA knobs). Predecessor parcial: `shared-noise-common-mode.md`.
