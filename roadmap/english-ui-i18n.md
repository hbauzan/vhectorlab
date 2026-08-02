# Roadmap: English-only product surface (UI + in-scope code)

> **Estado:** listo para ejecutar (2026-08-02).  
> **Base:** `main` + lecciones `.agents/skills/dev-protocol/lessons-learned.md`.  
> **Entrega:** por etapas (A→D), rama `feat/…` + approval gate por etapa.  
> **Idioma objetivo:** **English** en todo lo que ve el usuario y en strings/tests del producto.  
> **Fuera de alcance explícito:** `roadmap/**`, `.agents/**`, skills, módulos del protocolo, handoffs de agentes.

---

## 0. Decisiones cerradas / abiertas

| # | Tema | Decisión |
|---|---|---|
| D1 | **Idioma UI** | Inglés únicamente (navbar, paneles, sliders, modals, landscape gate, aria/titles, placeholders). |
| D2 | **Identifiers internos** | Keys JS (`ANALYSIS`, `NAVIGATION`, `threadAmplitudeY`, CSS classes) **no** se renombran salvo que el string visible lo exija. |
| D3 | **Exclusiones** | No tocar: `roadmap/`, `.agents/`, `dev-protocol` skills/lessons (salvo lesson **nueva** de i18n si el agente descubre invariante), archivos de archivo histórico. |
| D4 | **Backend API errors** | Ya en inglés en su mayoría — auditar y alinear si queda ES. |
| D5 | **Shipping** | Etapas A→D; no un mega-PR opaco. |
| D6 | **Compare vocab presets** | ❓ **ABIERTA** — ver §0.1 |
| D7 | **Tests / comments ES** | ❓ **ABIERTA** — ver §0.1 |
| D8 | **Docs de producto** | ❓ **ABIERTA** — `README.md` / `CHANGELOG` histórico / `CONTEXT.md` |

### 0.1 Preguntas de traducción (GATE — no codear Etapa C hasta OK humano)

Contestar antes de Etapa C:

1. **Compare auto-manual lexicon** (`AUTO_MANUAL_VOCAB_ES` en `ComparePanel.js`): ¿reemplazar por vocabulario EN de auto parts (`wheel`, `engine`, `brake`, …) o dejar tokens ES como *dataset de demo* (UI en EN, palabras ES a propósito)?
2. **Glosario UI (propuesta — confirmar o corregir):**

| ES (hoy) | EN propuesto |
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
| Mayor → menor / Ordenar… | Highest → lowest / Sort descending|ascending |
| Girá el teléfono… | Rotate your phone for a better experience. You can stay in portrait if you prefer. |
| VECTOR ARITHMETIC (ya EN) | keep |
| MODE / RENDER / POINTS… | keep (already EN) |
| WORD_A / RES / TOP1 | keep |

3. **Tests** (`debe …` en `tests/*.test.js`): ¿renombrar títulos a inglés en la misma pasada, o dejar nombres ES (solo fallan si asertan copy UI)?
4. **Comments JS/Python en español**: ¿traducir en scope, o solo strings runtime?
5. **CHANGELOG histórico / README**: ¿solo entradas nuevas en EN + Unreleased, o reescribir historial?

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
- [ ] Cero superficies user-facing omitidas en el inventario (smoke UI documentado).
- [ ] Lista de dudas de glosario actualizada (§0.1) si aparecen términos nuevos.
- [ ] **No** merge de código de traducción en A (solo doc de auditoría: puede vivir como sección append en este roadmap o `roadmap/english-ui-audit.md`).

**Rama sugerida:** `docs/english-ui-audit` (o sección en este archivo + commit docs).

---

## Etapa B — Glosario + OK humano (GATE)

**Objetivo:** cerrar §0.1 y congelar el glossary table.

### B.1
- Publicar glosario final (tabla ES→EN).
- Resolver D6–D8.
- Si el humano no responde un ítem, **parar** (no adivinar copy de marca).

### B.2 Criterios
- [ ] Checklist §0.1 respondido en el hilo / anexo al roadmap.
- [ ] Agente listo para Etapa C.

---

## Etapa C — User-facing English (producto)

**Objetivo:** todo lo que ve / oye el usuario en inglés.

### C.1 Trabajo
- Aplicar glosario a Navbar, Sidebar, ComparePanel, ThreadSliders, LandscapeGate, CollapsibleDock aria-labels, titles/tooltips, placeholders, empty states, sort aria, submit buttons.
- Compare vocab según D6.
- Actualizar tests que pineen copy UI.
- `CHANGELOG` Unreleased corto; lesson § nueva solo si hay invariante (“product copy = EN; identifiers stay”).

### C.2 Criterios
- [ ] Smoke UI: ninguna cadena ES visible en Arithmetic / Compare / Análisis / Navegación / POINTS·MESH·RIBBONS / landscape gate.
- [ ] Vitest verde; asserts de copy actualizados.
- [ ] Approval gate → merge.

**Rama:** `feat/english-user-facing-copy`

---

## Etapa D — Developer-facing hygiene (opcional según D7/D8)

**Objetivo:** alinear tests titles / comments / docs de producto si el humano lo pidió en B.

### D.1
- Renombrar `it('debe…')` → EN si D7 = sí.
- Comments ES→EN en `src/` / `backend/` si D7 = sí.
- README / Unreleased-only vs full CHANGELOG según D8.

### D.2 Criterios
- [ ] Scope D7/D8 cumplido; sin tocar exclusiones D3.
- [ ] Suite verde; approval gate → merge.

**Rama:** `feat/english-dev-strings` (o merge en C si el humano pidió “todo junto” en B).

---

## 3. Verificación final (post C o D)

1. `npm test` + smoke `npm run dev` (+ backend).
2. Grep residual en `src/` de acentos / voseo / keywords ES de UI (lista del audit).
3. Confirmar que `data-view="ANALYSIS"` etc. siguen iguales (solo labels visibles cambiaron).

---

## 4. Prompt del agente

Ver [`PROMPT-english-ui.md`](./PROMPT-english-ui.md).
