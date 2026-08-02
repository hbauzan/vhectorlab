# Roadmap: English-only product surface (UI + in-scope code)

> **Estado:** cerrado / merged a `main` (2026-08-02).  
> **Base:** `main` + lecciones `.agents/skills/dev-protocol/lessons-learned.md`.  
> **Entrega:** A→D completadas (`docs/english-ui-audit` + `feat/english-user-facing-copy`).  
> **Idioma objetivo:** **English** en todo lo que ve el usuario y en strings/tests del producto.  
> **Fuera de alcance explícito:** `roadmap/archivo/**`, `.agents/**` skills (salvo lesson i18n nueva), handoffs de agentes. Este roadmap + audit + prompt **sí** se actualizan.

---

## 0. Decisiones cerradas

| # | Tema | Decisión |
|---|---|---|
| D1 | **Idioma UI** | Inglés únicamente (navbar, paneles, sliders, modals, landscape gate, aria/titles, placeholders). |
| D2 | **Identifiers internos** | Keys JS (`ANALYSIS`, `NAVIGATION`, `threadAmplitudeY`, CSS classes) **no** se renombran salvo que el string visible lo exija. |
| D3 | **Exclusiones** | No tocar: `roadmap/**` salvo este epic / audit, `.agents/**` skills (salvo lesson **nueva** de i18n si aparece invariante), archivos en `roadmap/archivo/**`. |
| D4 | **Backend API errors** | Ya en inglés en su mayoría — auditar y alinear si queda ES. |
| D5 | **Shipping** | Etapas A→D; no un mega-PR opaco. |
| D6 | **Compare vocab presets** | **EN** — reemplazar `AUTO_MANUAL_VOCAB_ES` por lexicon EN de auto parts (`wheel`, `engine`, `brake`, …). Renombrar símbolos (`AUTO_MANUAL_VOCAB_EN` / dropear `_ES`). Placeholder del textarea en EN. |
| D7 | **Tests + comments ES** | **Sí** — renombrar `it('debe…')` → EN; traducir comments ES en `src/` y `backend/` a EN en Etapa D (o junto con C si conviene). |
| D8 | **Docs de producto** | **CHANGELOG histórico: dejar en español** (que se note el pasado). Solo entradas **nuevas / Unreleased** en EN. `README.md` / `CONTEXT.md` ya EN o alinear sin reescribir historia del CHANGELOG. |

### 0.1 Glosario UI cerrado (2026-08-02)

| ES (antes) | EN (aplicar) |
|---|---|
| ANÁLISIS | ANALYSIS |
| NAVEGACIÓN | NAVIGATION |
| Control Espacial 3D | 3D Spatial Controls |
| Separación (X) | Spacing (X) |
| Distancia Vectores (Y) | Vector Distance (Y) |
| Amplitud (Y) | Amplitude (Y) |
| Longitud (Z) | Length (Z) |
| Grosor Puntos | Point Thickness |
| Doble clic: restaurar default | Double-click: restore default |
| CALCULAR VECTOR | CALCULATE VECTOR |
| VISUALIZAR SECUENCIA (3D) | VISUALIZE SEQUENCE (3D) |
| SIMILITUD COSENO vs — | COSINE SIMILARITY vs — |
| Visualizá una secuencia… | Visualize a sequence to see similarity vs the anchor… |
| Mayor → menor / Ordenar… | Highest → lowest / Sort descending \| ascending |
| Girá el teléfono… | Rotate your phone for a better experience. You can stay in portrait if you prefer. |
| VECTOR ARITHMETIC / MODE / RENDER / POINTS / WORD_A / RES / TOP1 | keep (already EN) |
| VISTA: | VIEW: |
| Mejor en horizontal | Better in landscape |
| Entendido | Got it |

> **GATE B:** glosario y D6–D8 **cerrados**. El agente puede pasar A → C/D sin re-preguntar salvo términos nuevos del audit.

---

## 1. Invariantes a respetar

1. **No romper paneles** (§4.1–4.3): `fit-content`, overflow, docks, COMPARE sync.
2. **No renombrar** contratos API / `data-view` / `data-mode` values internos sin migración.
3. **Spatial defaults / dblclick** (§4.5): strings de `title=` sí; lógica intacta.
4. **ThreadLabels** (§4.6): Arithmetic corto EN ya; Compare = token crudo (no forzar TOPn).
5. **Tests verdes** tras cada etapa que toque copy asertado.

---

## 2. Mapa de superficie (sonda previa — no exhaustiva)

| Superficie | ES detectado (muestra) | Archivos típicos |
|---|---|---|
| Navbar VISTA | ANÁLISIS, NAVEGACIÓN | `src/ui/Navbar.js` |
| Sliders | Control Espacial, Separación, Distancia, Amplitud, Longitud, Grosor, Doble clic | `src/ui/ThreadSliders.js` |
| Arithmetic | CALCULAR VECTOR (resto mix EN) | `src/ui/Sidebar.js` |
| Compare | VISUALIZAR SECUENCIA, SIMILITUD COSENO, empty-state voseo, sort titles, vocab ES, placeholder | `src/ui/ComparePanel.js` |
| Landscape gate | Girá el teléfono… | `src/ui/LandscapeGate.js` |
| Modals / boot | mayormente EN | `src/main.js` |
| Thread labels 3D | ya EN cortos (Arithmetic) / tokens (Compare) | `threadLabelFormat.js`, Instancer |
| Backend HTTP | EN | `backend/routers/*.py` |
| Tests | títulos `debe …` | `tests/*.test.js` |
| Comments | ES en shading / comments UI | `DivergentShading.js`, etc. |

`index.html` ya `lang="en"`. `CONTEXT.md` ya EN.

---

## Etapa A — Auditoría exhaustiva (read-only deliverable)

**Objetivo:** inventario completo de strings ES (o mixtos) **en scope**, sin implementar aún.

### A.1 Scope de búsqueda
- **Incluir:** `src/**`, `index.html`, `tests/**` (si asertan o nombran ES), `backend/**` (mensajes user/API), `.env.example` si hay copy, `package.json` description si aplica.
- **Excluir:** `roadmap/**`, `.agents/**`, `node_modules/**`, `roadmap/archivo/**`, agent transcripts.

### A.2 Método
1. Ripgrep acentos / voseo / keywords ES conocidas + pase manual UI (`npm run dev`): Navbar, docks, Arithmetic, Compare, sliders, landscape (resize), modals offline, ThreadLabels Análisis.
2. Clasificar cada hallazgo: `user-facing` | `test-title` | `comment` | `demo-vocab` | `doc-out-of-scope`.
3. Entregar tabla en el PR/comentario de etapa: `file:line | current | suggested EN | class`.

### A.3 Criterios
- [x] Cero superficies user-facing omitidas en el inventario (smoke UI documentado).
- [x] Lista de dudas de glosario actualizada (§0.1) si aparecen términos nuevos.
- [x] **No** merge de código de traducción en A (solo doc de auditoría: puede vivir como sección append en este roadmap o `roadmap/english-ui-audit.md`).

**Rama sugerida:** `docs/english-ui-audit` (o sección en este archivo + commit docs).

---

## Etapa B — Glosario (CERRADO 2026-08-02)

Humano confirmó D6–D8 + tabla §0.1. **No re-preguntar** salvo strings nuevos del audit A.

### B.1 Criterios
- [x] Checklist §0.1 respondido.
- [x] Agente listo para Etapa C (+ D en la misma o siguiente rama).

---

## Etapa C — User-facing English (producto)

**Objetivo:** todo lo que ve / oye el usuario en inglés.

### C.1 Trabajo
- Aplicar glosario a Navbar, Sidebar, ComparePanel, ThreadSliders, LandscapeGate, CollapsibleDock aria-labels, titles/tooltips, placeholders, empty states, sort aria, submit buttons.
- Compare vocab según D6.
- Actualizar tests que pineen copy UI.
- `CHANGELOG` Unreleased corto; lesson § nueva solo si hay invariante (“product copy = EN; identifiers stay”).

### C.2 Criterios
- [x] Smoke UI: ninguna cadena ES visible en Arithmetic / Compare / Análisis / Navegación / POINTS·MESH·RIBBONS / landscape gate.
- [x] Vitest verde; asserts de copy actualizados.
- [x] Approval gate → merge.

**Rama:** `feat/english-user-facing-copy`

---

## Etapa D — Developer-facing hygiene (D7 + D8)

**Objetivo:** tests titles + comments EN; **no** reescribir CHANGELOG histórico.

### D.1
- Renombrar `it('debe…')` → EN (D7).
- Comments ES→EN en `src/` / `backend/` (D7).
- CHANGELOG: solo **Unreleased / entradas nuevas** en EN; dejar secciones históricas en español (D8).

### D.2 Criterios
- [x] D7/D8 cumplidos; exclusiones D3 intactas.
- [x] Suite verde; approval gate → merge.

**Rama:** puede ir en `feat/english-user-facing-copy` si el agente hace C+D juntos, o `feat/english-dev-strings`.

---

## 3. Verificación final (post C o D)

1. `npm test` + smoke `npm run dev` (+ backend).
2. Grep residual en `src/` de acentos / voseo / keywords ES de UI (lista del audit).
3. Confirmar que `data-view="ANALYSIS"` etc. siguen iguales (solo labels visibles cambiaron).

---

## 4. Prompt del agente

Ver [`PROMPT-english-ui.md`](./PROMPT-english-ui.md).
