# Prompt — continuar Galaxy VIEW (post Slice 4 / v2.3.0)

**Modo:** **serial** — una sesión / un slice. No agentes en paralelo.  
Empezá por **Slice 5** (hay WIP parcial en rama). No re-litigar decisiones cerradas.

---

```text
Usando dev-protocol, continuá el roadmap Galaxy VIEW desde donde quedó.

## Estado YA en main (NO rehacer)
Repo: VHectorLab 3D / vhectorlab (Python/uv + Vite/Three.js).
Versión producto: **2.3.0** (línea **2.3.x** de acá en más — PATCH para el resto del epic salvo que el humano diga otro MINOR).
Base: `main` actualizado (`git pull`).

Hecho y mergeado:
- Slice 1: `POST /project` UMAP (`backend/projection.py`, `umap-learn==0.5.12`, tests, `architecture_spec.md`)
- Slice 2: VIEW GALAXY + chips UMAP|PCA|t-SNE (gris) + locks COMPARE+POINTS (`src/ui/galaxyChrome.js`, Navbar, main)
- Slice 3: bootstrap `GROUP_it_core` (100) + GROUP_1 + GROUP_2 (`src/ui/itCoreCorpus.js`, ComparePanel)
- Slice 4: layout 1 punto/token, badges centroides, camera IT core, sin ribbons (`src/visualizer/galaxyLayout.js`, `Instancer.renderGalaxyData`, `RemoteProvider.projectEmbeddings`, `main.ensureGalaxyProjection`)

Roadmap canónico (leelo COMPLETO antes de código):
  `roadmap/galaxy-view.md`
Lecciones: `.agents/skills/dev-protocol/lessons-learned.md` — **§6.0d obligatorio**:
  **PROHIBIDO tocar `src/v25/**` salvo que el humano lo diga explícitamente.**
  Antes de merge: `git diff -- src/v25` vacío.
UI legacy only: `src/main.js`, `src/ui/*`, `src/visualizer/*`

## Decisiones CERRADAS (no re-preguntar)
- VIEW GALAXY; MODE fijo COMPARE; RENDER fijo POINTS.
- DR 100% backend `/project`; default UMAP; PCA/t-SNE 501 / chips gray.
- Cósmico 3D (n_components=3). 2D = epic futuro.
- SAE aplica (vectores SAE → /project).
- Progress UI obligatorio: status + barra + paso k/n.
- Orquestación v1: client-driven steps.
- Token Comparison panel: comportamiento actual (cosine, reorder, sort rules).
- SemVer: seguir en **2.3.x** (PATCH) para Slices 5–7 salvo indicación contraria. No bump 2.4 por cada slice.

## WIP local (rama / working tree)
Puede existir rama `feat/galaxy-pipeline-progress` con trabajo a medias de Slice 5:
- `src/ui/galaxyPipeline.js` + `tests/galaxyPipeline.test.js` (helpers steps/fingerprint/cache)
- `ComparePanel`: markup `#galaxy-progress` + `setGalaxyProgress` / `clearGalaxyProgress`
- `CHANGELOG.md` reordenado (Unreleased vs [2.3.0])
- `lessons-learned.md` §6.0d (v25 off-limits)

`main.js` todavía usa `ensureGalaxyProjection` (sin progress k/n ni pipeline SAE completo).

Acción al arrancar:
1. `git status` / checkout o recreá `feat/galaxy-pipeline-progress` desde `main`.
2. Si el WIP es útil, reusalo; si está podrido, descartá y reimplementá limpio sobre `main`.
3. Completá **SOLO Slice 5** en esta sesión.

## Slice 5 — DoD (ESTA sesión)
Roadmap §2.2 progress + §6 Slice 5.

1. Pipeline client-driven: encode → SAE? → UMAP `/project` → build galaxy.
2. UI: status text + progress bar + paso **k/n** siempre visible mientras trabaja.
3. Visualize y toggle SAE (en Galaxy) disparan pipeline con feedback.
4. Reusar cache `/compare` si texts no cambiaron (`compareTextsFingerprint` / `canReuseCompareCache` si ya existen).
5. Tests verdes (`npm test` + lo que toques).
6. Sin `src/v25/**`.
7. APPROVAL GATE: cómo probar (smoke roadmap §8 pasos 3–5); ESPERÁ OK antes de push/merge.
8. Tras OK: commit → push → merge a `main` (protocol git-workflow). Versión: PATCH **2.3.1** si el humano quiere tag ahora, o dejar 2.3.0 y documentar en CHANGELOG Unreleased/2.3.0 — **preguntá solo si hay duda**; default razonable: append a sección `[2.3.0]` o Unreleased sin bump hasta Slice 7, salvo que el humano diga bump.

### Slices siguientes (NO implementar ahora; solo contexto)
6 — Botón K-means disabled + info tip EN (no clustering).
7 — Polish/docs: CONTEXT.md Galaxy/UMAP; CHANGELOG; lessons (layout≠threads, progress, umap seed); smoke §8 completo; verificar `git diff -- src/v25` vacío.

## Estilo
No-fluff; TDD; módulos profundos; no expandir scope.
Ante duda de contrato: preguntá.
Seguí `.agents/skills/dev-protocol/SKILL.md`
(clarify → branch → implement → verify → docs → approval gate → git delivery con OK).
```

---

## Prompt — Slice 6 (sesión siguiente, tras Slice 5 OK)

```text
Usando dev-protocol, continuá Galaxy VIEW — SOLO Slice 6.

Roadmap: `roadmap/galaxy-view.md` §2.3 + §6 Slice 6.
PROHIBIDO: `src/v25/**` (§6.0d lessons-learned).
Versión: línea 2.3.x.

DoD:
- Botón K-means (disabled / coming soon) + info tip claro en inglés de producto.
- No implementar clustering.
- APPROVAL GATE; no push/merge sin OK.
```

---

## Prompt — Slice 7 (cierre)

```text
Usando dev-protocol, cerrá Galaxy VIEW — SOLO Slice 7 (polish/docs).

Roadmap: `roadmap/galaxy-view.md` §7–§10.
PROHIBIDO: `src/v25/**` (verificar `git diff -- src/v25` vacío).
Versión: confirmar con humano si cerrar como 2.3.0 completo o bump PATCH 2.3.x.

DoD:
- CONTEXT.md: Galaxy VIEW, UMAP, galactic core / GROUP_it_core.
- CHANGELOG EN actualizado.
- lessons-learned: layout ≠ dim threads; progress k/n; umap seed; §6.0d ya existe.
- architecture_spec `/project` completo si faltó algo.
- Smoke §8 completo en el reporte.
- APPROVAL GATE → OK → git delivery.
```
