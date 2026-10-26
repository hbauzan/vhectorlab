# Roadmap

Documentos de planificación **activos** viven en esta carpeta. Históricos en **[`archivo/`](./archivo/)**.

| Doc | Tema | Estado |
|---|---|---|
| **[`structural-noise-engine-manager.md`](./structural-noise-engine-manager.md)** | **LLM Engine Manager & Universal Structural Noise Shield (Detection, Pruning, 3D Dual-Path Ribbon)** | **ACTIVO (Listo para ejecución TDD)** |
| [`PROMPT-slice1-v4-structural-noise-core.md`](./PROMPT-slice1-v4-structural-noise-core.md) | Prompt de ejecución Slice 1 (Bump v4.0.0 + TDD Core Math & Outlier Isolation) | **Listo para ejecución** |
| [`archivo/`](./archivo/) | Epics ejecutados o archivados (`hardware-aware-model-selector-benchmark`, `spectral-quorum-determinism`, `multillm`, `shared-noise`, etc.) | Archivado |

---

## Cómo ejecutar el Roadmap Activo

1. Ejecutar de manera serial siguiendo TDD estricto por Slices (Slice 1 a 4).
2. Cada Slice corre pruebas unitarias e integración en verde antes del paso siguiente.
3. Fuente de verdad del código: `CHANGELOG.md`, `CONTEXT.md`, `architecture_spec.md`, `main` @ SemVer en `manifest.json`.
