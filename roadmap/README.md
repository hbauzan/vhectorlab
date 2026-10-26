# Roadmap

Documentos de planificación **activos** viven en esta carpeta. Históricos en **[`archivo/`](./archivo/)**.

| Doc | Tema | Estado |
|---|---|---|
| **[`hardware-aware-model-selector-benchmark.md`](./hardware-aware-model-selector-benchmark.md)** | **Selector Inteligente de Embeddings y Benchmark de Hardware Local (Hardware-Aware + Benchmark)** | **COMPLETADO (Verificado empíricamente con suite verde)** |
| [`PROMPT-slice1-hardware-inspector.md`](./PROMPT-slice1-hardware-inspector.md) | Prompt de ejecución Slice 1 (Pre-flight audit + Hardware Inspector) | Ejecutado (`9c02602`) |
| [`PROMPT-slice2-benchmark-runner.md`](./PROMPT-slice2-benchmark-runner.md) | Prompt de ejecución Slice 2 (Benchmark Runner + Persistencia JSON) | Ejecutado (`67d79fb`) |
| [`PROMPT-slice3-setup-integration.md`](./PROMPT-slice3-setup-integration.md) | Prompt de ejecución Slice 3 (Integración setup.sh + Soft-Gate + Sub-acción B) | Ejecutado |
| [`spectral-quorum-determinism.md`](./spectral-quorum-determinism.md) | Spectral Quorum Determinista: separabilidad bidireccional S_d, umbral de señal, Float64 y alineación DDI-FW | COMPLETADO (v3.4.0) |
| [`../current-research/DISCOVERY-shared-noise-embedding-geometry.md`](../current-research/DISCOVERY-shared-noise-embedding-geometry.md) | Evidencia empírica de colapso geométrico y sensibilidad de signo | Research de soporte |
| [`archivo/`](./archivo/) | Epics ejecutados o archivados (`dual-engine-inspection`, `multillm`, `shared-noise`, `multiplatform-setup`) | Archivado |

---

## Cómo ejecutar el Roadmap Activo

1. Ejecutar de manera serial siguiendo TDD estricto por Slices (Slice 1 a 4).
2. Cada Slice corre pruebas unitarias e integración en verde antes del paso siguiente.
3. Fuente de verdad del código: `CHANGELOG.md`, `CONTEXT.md`, `architecture_spec.md`, `main` @ SemVer en `manifest.json`.
