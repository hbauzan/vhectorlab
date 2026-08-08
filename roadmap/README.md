# Roadmap

Documentos de planificación **activos** viven en esta carpeta. Históricos en **[`archivo/`](./archivo/)**.

| Doc | Tema | Estado |
|---|---|---|
| [`galaxy-view.md`](./galaxy-view.md) | VIEW **Galaxy**: UMAP backend, 1 punto/token, COMPARE+POINTS locked, IT core×100 | **Activo (plan)** |
| [`PROMPT-galaxy-view.md`](./PROMPT-galaxy-view.md) | Prompt serial por slice (1→7) para agentes Galaxy | **Activo** |
| [`PROMPT-galaxy-view-continue.md`](./PROMPT-galaxy-view-continue.md) | Continuación Galaxy (post Slice 4) | **Activo** |
| [`hf-space-cpu-demo.md`](./hf-space-cpu-demo.md) | HF Space Docker cpu-basic: packaging, setup 7+8, badge CPU/GPU, ARITHMETIC persistente | **Implementado** |
| [`compare-group-contrast-viz.md`](./compare-group-contrast-viz.md) | Legibilidad contraste GROUP_* (Amplitude, SAE z-score dust, dim sort) | Implementado (v2.1.0) |
| [`PROMPT-compare-group-contrast-viz.md`](./PROMPT-compare-group-contrast-viz.md) | Prompt para agente (pregunta D1–D12 → implementa) | Archivable |
| [`english-ui-i18n.md`](./english-ui-i18n.md) | English-only UI / product strings | **Implementado** |
| [`PROMPT-english-ui.md`](./PROMPT-english-ui.md) | Prompt EN UI | Archivable |
| [`visualization-sign-filters-colors.md`](./visualization-sign-filters-colors.md) | Filtro All/+/− + anclas de color | **Implementado** |
| [`PROMPT-visualization-controls.md`](./PROMPT-visualization-controls.md) | Prompt viz controls | Archivable |
| [`sae-denoise.md`](./sae-denoise.md) | Top‑K SAE Clean/Denoise → v2.0.0 | **Implementado** |
| [`PROMPT-sae-denoise.md`](./PROMPT-sae-denoise.md) | Prompt SAE | Archivable |
| [`archivo/`](./archivo/) | Epics retirados: mobile/MESH, **v25**, **/amiga` MPA**, GUI-art paralelo, release 1.0 | Archivado |

Fuente de verdad del código: `CHANGELOG.md`, `CONTEXT.md`, `main` @ SemVer en `manifest.json`.

**UI default (2.4.1+):** una sola app en `/` con chrome Magic Workbench (`src/theme/`). Rutas `/v25/` y `/amiga/` **retiradas**.
