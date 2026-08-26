# Roadmap

Documentos de planificación **activos** viven en esta carpeta. Históricos en **[`archivo/`](./archivo/)**.

| Doc | Tema | Estado |
|---|---|---|
| [`multillm/`](./multillm/) | Multi-embedding catalog + profiles + `setup.sh` option 11 (local; HF deferred) | **Activo (plan)** |
| [`HANDOFF-shared-noise.md`](./HANDOFF-shared-noise.md) | Handoff 2026-08-26 (auditoría + acuerdo Shared noise) | **Para pegar en otro chat** |
| [`shared-noise-omit-common.md`](./shared-noise-omit-common.md) | Shared noise: ocultar el pack, dejar el punto distinto (float nativo); SAE capa dudosa | **Draft (hablando — no implementar)** |
| [`open-shared-noise-knob.md`](./open-shared-noise-knob.md) | Parking knob-feel — sucedido por el draft de omit | **Superseded** |
| [`archivo/`](./archivo/) | Epics ya ejecutados o superados | Archivado |

Fuente de verdad del código: `CHANGELOG.md`, `CONTEXT.md`, `main` @ SemVer en `manifest.json`.

**UI default (2.4.1+):** una sola app en `/` con chrome Magic Workbench (`src/theme/`). Rutas `/v25/` y `/amiga/` **retiradas**.

Para una aventura nueva: agregá `roadmap/<slug>.md` (+ `PROMPT-…` si hace falta) y una fila en esta tabla.
