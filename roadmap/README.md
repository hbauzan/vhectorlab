# Roadmap

Documentos de planificación **activos** viven en esta carpeta. Históricos en **[`archivo/`](./archivo/)**.

| Doc | Tema | Estado |
|---|---|---|
| **[`dual-engine-inspection-integration.md`](./dual-engine-inspection-integration.md)** | **Integración de Deep Dimensional Inspection: BGE-M3, memoria, hash SHA-256, brechas de intervalo y diagnóstico 3D** | **ACTIVO (En primer plano — listo para ejecución)** |
| **[`PROMPT-dual-engine-inspection-integration.md`](./PROMPT-dual-engine-inspection-integration.md)** | **Prompt ejecutable para agentes de IA (arranque en Slice 1 con dev-protocol)** | **Kickoff para sesión nueva** |
| [`../current-research/DISCOVERY-shared-noise-embedding-geometry.md`](../current-research/DISCOVERY-shared-noise-embedding-geometry.md) | Evidencia empírica de colapso geométrico y sensibilidad de signo | **Research de soporte** |
| [`archivo/`](./archivo/) | Epics ejecutados o archivados (`multillm`, `shared-noise`, `multiplatform-setup`) | Archivado |

---

## Cómo ejecutar el Roadmap Activo

1. Abrir una sesión nueva de IA con el prompt definido en **[`PROMPT-dual-engine-inspection-integration.md`](./PROMPT-dual-engine-inspection-integration.md)**.
2. Cada agente ejecuta **un solo Slice por sesión** de manera serial siguiendo TDD estricto y deteniéndose en el Approval Gate.
3. Fuente de verdad del código: `CHANGELOG.md`, `CONTEXT.md`, `architecture_spec.md`, `main` @ SemVer en `manifest.json`.
