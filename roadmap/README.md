# Roadmap

Documentos de planificación **activos** viven en esta carpeta. Históricos en **[`archivo/`](./archivo/)**.

| Doc | Tema | Estado |
|---|---|---|
| [`multillm/`](./multillm/) | Multi-embedding catalog + profiles + `setup.sh` option 11 (local; HF deferred) | **Activo (plan)** |
| [`HANDOFF-shared-noise.md`](./HANDOFF-shared-noise.md) | Handoff 2026-08-26 (auditoría + acuerdo Shared noise) | **Para pegar en otro chat** |
| [`../current-research/DISCOVERY-shared-noise-embedding-geometry.md`](../current-research/DISCOVERY-shared-noise-embedding-geometry.md) | Evidencia: Shared noise vivo en Arctic@256 vs “muerto” en mpnet@768 (misma UI) | **Research** (no ticket) |
| [`shared-noise-omit-common.md`](./shared-noise-omit-common.md) | Shared noise: ocultar el pack, dejar el punto distinto (float nativo); SAE capa dudosa | **Draft (hablando — no implementar)** |
| [`multiplatform-setup.md`](./multiplatform-setup.md) | Linux/Windows setup (`setup-linux` / `setup.ps1`); opción A–D pendiente | **Parking (después de lo importante)** |
| [`PROMPT-multiplatform-setup.md`](./PROMPT-multiplatform-setup.md) | Kickoff: revalidar §3 → re-mostrar opciones → esperar elección | **Para pegar cuando se reabra** |
| [`open-shared-noise-knob.md`](./open-shared-noise-knob.md) | Parking knob-feel — sucedido por el draft de omit | **Superseded** |
| [`archivo/`](./archivo/) | Epics ya ejecutados o superados | Archivado |

Fuente de verdad del código: `CHANGELOG.md`, `CONTEXT.md`, `main` @ SemVer en `manifest.json`.

**UI default (2.4.1+):** una sola app en `/` con chrome Magic Workbench (`src/theme/`). Rutas `/v25/` y `/amiga/` **retiradas**.

Para una aventura nueva: agregá `roadmap/<slug>.md` (+ `PROMPT-…` si hace falta) y una fila en esta tabla.
