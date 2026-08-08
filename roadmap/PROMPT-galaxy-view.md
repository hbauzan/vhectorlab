# Prompt — agente Galaxy VIEW (UMAP)

Copiá y pegá el bloque siguiente en una sesión **nueva**.  
Roadmap: [`galaxy-view.md`](./galaxy-view.md) (2026-08-08).

**Modo de trabajo:** **serial** — una sesión / un slice. No lanzar agentes en paralelo.  
Empezá por **Slice 1** salvo que el humano diga otro.

---

```text
Usando dev-protocol, ejecutá el roadmap Galaxy VIEW (UMAP word universe).

## Contexto
Repo: VectorLab 3D / VHectorLab (Python/uv + Vite/Three.js).
Base: `main` actualizado (git pull first si aplica).
Roadmap canónico — leelo COMPLETO antes de cualquier código:
  `roadmap/galaxy-view.md`
Lecciones: `.agents/skills/dev-protocol/lessons-learned.md`
Arquitectura API: `architecture_spec.md`
UI legacy only: `src/main.js`, `src/ui/*`, `src/visualizer/*`
PROHIBIDO: tocar cualquier archivo bajo `src/v25/` (proyecto aparte).

## Decisiones YA CERRADAS (no re-preguntar)
- VIEW nuevo: GALAXY (junto a ANALYSIS | NAVIGATION).
- En Galaxy: MODE fijo COMPARE, RENDER fijo POINTS; tabs MODE/RENDER locked.
- Cósmico 3D ahora (UMAP n_components=3). 2D VIEW = epic futuro (documentado).
- DR 100% backend: POST /project; default method=umap.
- Bajo el control GALAXY: chips chicos UMAP | PCA | t-SNE; PCA y t-SNE grisados.
- Bootstrap: GROUP_it_core (100 IT EN del roadmap §4) + GROUP_1 + GROUP_2 demo actual.
- Clusters visuales = GROUP_*; badges + hover labels.
- Botón K-means + info tip claros ahora; implementación después.
- SAE aplica (embeddings transformados → /project).
- Progress UI obligatorio: status + barra + paso k/n.
- Token Comparison panel: mismo comportamiento (cosine, reorder, sort rules).
- Orquestación v1: client-driven steps (compare → SAE? → project → build).

## Slice a ejecutar en ESTA sesión
Slice 1 — Backend POST /project (UMAP only).

Si el humano indica otro slice del roadmap §6, hacé SOLO ese.
No adelantar slices siguientes “por si acá”.

### Definition of Done — Slice 1
1. `uv add umap-learn` (y lo que uv resuelva); sync OK.
2. Endpoint `POST /project` según roadmap §3.1 (umap + n_components 2|3; seed; params).
3. method pca/tsne → error claro (400 o 501); umap sole green path.
4. Tests `uv run pytest` para validación + smoke proyección (n chico, seed fijo).
5. Nota en `architecture_spec.md` del contrato.
6. Branch `feat/galaxy-view` (o `feat/galaxy-project-api` si preferís stage branch).
7. APPROVAL GATE: reportá cómo probar con curl/httpie; ESPERÁ OK antes de push/merge.

### Slices siguientes (NO implementar ahora; solo contexto)
2 Navbar Galaxy + locks + chips
3 Bootstrap corpus IT+G1+G2
4 Layout/Instancer 1 punto/token
5 Pipeline + progress k/n
6 K-means stub
7 Polish/docs

## Estilo
No-fluff; TDD; módulos profundos; no expandir scope.
Ante duda de contrato: preguntá — no adivines.
Seguí `.agents/skills/dev-protocol/SKILL.md`
(clarify → branch → implement → verify → docs → approval gate → git delivery con OK).
```

---

## Prompt — Slice 2 (pegar en la sesión siguiente, cuando Slice 1 esté mergeado/OK)

```text
Usando dev-protocol, continuá Galaxy VIEW — SOLO Slice 2.

Roadmap: `roadmap/galaxy-view.md` §6 Slice 2 + §2.1 chrome.
PROHIBIDO: `src/v25/**`.

DoD:
- Tab VIEW GALAXY en Navbar legacy.
- Sub-chips UMAP (activo) | PCA | t-SNE (grisados + title/info “coming next”).
- Entrar a Galaxy fuerza COMPARE + POINTS y deshabilita MODE/RENDER.
- Salir de Galaxy restaura triad previa / re-habilita tabs.
- Tests UI/chrome donde el repo ya testeé Navbar/defaults.
- APPROVAL GATE; no push/merge sin OK.
```

---

## Prompt — Slice 3

```text
Usando dev-protocol, continuá Galaxy VIEW — SOLO Slice 3.

Roadmap: `roadmap/galaxy-view.md` §4 corpus + §6 Slice 3.
PROHIBIDO: `src/v25/**`.

DoD:
- Bootstrap Compare = GROUP_it_core (exactamente 100 tokens del §4) + GROUP_1 + GROUP_2 demos existentes.
- getCompareBootstrap / presets actualizados; tests de parse/count/group ids.
- ORDER: it_core primero (REF dentro del núcleo salvo edición user).
- APPROVAL GATE.
```

---

## Prompt — Slice 4

```text
Usando dev-protocol, continuá Galaxy VIEW — SOLO Slice 4.

Roadmap: `roadmap/galaxy-view.md` §5.2 layout + §6 Slice 4.
Depende de /project (Slice 1) disponible.
PROHIBIDO: `src/v25/**`.

DoD:
- Layout Galaxy: 1 punto por token desde positions[3].
- Group badges en centroides; hover token labels.
- Camera framed al centroide de GROUP_it_core (fallback bbox all).
- Sin ribbons dim-axis en Galaxy.
- Tests de helpers de layout.
- APPROVAL GATE.
```

---

## Prompt — Slice 5

```text
Usando dev-protocol, continuá Galaxy VIEW — SOLO Slice 5.

Roadmap: `roadmap/galaxy-view.md` §2.2 progress + §6 Slice 5.
PROHIBIDO: `src/v25/**`.

DoD:
- Pipeline client-driven: encode → SAE? → UMAP /project → build galaxy.
- UI: status text + progress bar + paso k/n siempre visible durante el trabajo.
- Visualize y toggle SAE disparan pipeline con feedback.
- Reusar cache /compare si texts no cambiaron (si ya existe patrón).
- APPROVAL GATE + smoke roadmap §8 pasos 3–5.
```

---

## Prompt — Slice 6

```text
Usando dev-protocol, continuá Galaxy VIEW — SOLO Slice 6.

Roadmap: `roadmap/galaxy-view.md` §2.3 + §6 Slice 6.
PROHIBIDO: `src/v25/**`.

DoD:
- Botón K-means (disabled / coming soon) + info tip claro en inglés de producto.
- No implementar clustering.
- APPROVAL GATE.
```

---

## Prompt — Slice 7

```text
Usando dev-protocol, cerrá Galaxy VIEW — SOLO Slice 7 (polish/docs).

Roadmap: `roadmap/galaxy-view.md` §7–§10.
PROHIBIDO: `src/v25/**` (verificar `git diff -- src/v25` vacío).

DoD:
- CONTEXT.md términos Galaxy/UMAP/galactic core.
- CHANGELOG EN (MINOR si human confirma).
- lessons-learned (layout ≠ threads; progress; umap seed).
- architecture_spec ya tiene /project; completar si faltó.
- Smoke §8 completo en el reporte.
- APPROVAL GATE → esperar OK → git delivery según protocol.
```

---

## Notas para el humano

1. Trabajá **un prompt de slice por sesión**. Empezá por Slice 1.
2. Después de cada APPROVAL GATE, dale OK explícito antes de push/merge.
3. Epics futuros (PCA, t-SNE, 2D VIEW, K-means real) no van en estos prompts.
4. Si un slice necesita decisión menor (¿400 vs 501 para pca?, ¿dónde vive la barra de progreso?), el agente debe preguntar — son detalles no bloqueantes del plan.
