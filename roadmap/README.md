# Roadmap

Documentos de planificación **activos** viven en esta carpeta. Históricos en **[`archivo/`](./archivo/)**.

| Doc | Tema | Estado |
|---|---|---|
| **[`spectral-quorum-determinism.md`](./spectral-quorum-determinism.md)** | **Spectral Quorum Determinista: separabilidad bidireccional S_d, umbral de señal, Float64 y alineación DDI-FW** | **ACTIVO (En primer plano — listo para ejecución)** |
| [`../current-research/DISCOVERY-shared-noise-embedding-geometry.md`](../current-research/DISCOVERY-shared-noise-embedding-geometry.md) | Evidencia empírica de colapso geométrico y sensibilidad de signo | **Research de soporte** |
| [`archivo/`](./archivo/) | Epics ejecutados o archivados (`dual-engine-inspection`, `multillm`, `shared-noise`, `multiplatform-setup`) | Archivado |

---

## Cómo ejecutar el Roadmap Activo

1. Ejecutar de manera serial siguiendo TDD estricto por Slices (Slice 1 a 4).
2. Cada Slice corre pruebas unitarias e integración en verde antes del paso siguiente.
3. Fuente de verdad del código: `CHANGELOG.md`, `CONTEXT.md`, `architecture_spec.md`, `main` @ SemVer en `manifest.json`.
