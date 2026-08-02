# English UI audit — Stage A

> **Date:** 2026-08-02  
> **Branch:** `docs/english-ui-audit`  
> **Method:** ripgrep (accents, voseo, known ES UI keywords) + manual read of UI modules. Live `npm run dev` smoke checklist below (static coverage complete; visual pass recommended before merge of Stage C).  
> **Scope:** `src/**`, `index.html`, `tests/**`, `backend/**` (user/API msgs). Excludes `roadmap/**` (except this file), `.agents/**`, `node_modules/**`.  
> **Glossary base:** `roadmap/english-ui-i18n.md` §0.1 + D6–D8.

---

## Smoke UI checklist (surfaces walked in source)

| Surface | File(s) | ES found? |
|---|---|---|
| Navbar MODE / VISTA / RENDER | `Navbar.js` | Yes — VISTA label + ANÁLISIS / NAVEGACIÓN |
| Arithmetic panel | `Sidebar.js` | Yes — CALCULAR VECTOR only (rest EN) |
| Compare panel | `ComparePanel.js` | Yes — submit, cosine subtitle, empty, sort, placeholder, ES vocab |
| Spatial sliders | `ThreadSliders.js` | Yes — title, 5 labels, 5 titles |
| Landscape gate | `LandscapeGate.js` | Yes — h2, copy, dismiss |
| Docks / touch / HUD / modals | `CollapsibleDock.js`, `TouchControls.js`, `HUD.js`, `CustomModal.js`, `main.js` | No ES (already EN) |
| ThreadLabels 3D | `threadLabelFormat.js` | No — Arithmetic short EN; Compare = raw tokens (§4.6) |
| `index.html` / backend HTTP msgs | `index.html`, `backend/routers/*` | Clean (EN) |

**Live smoke (Stage C):** `npm run dev` + backend → walk MODE / VISTA / RENDER, slider titles, Compare empty + sort tooltips, landscape gate (phone portrait or narrow+tall), presets show EN tokens.

---

## NEW terms (not in §0.1) — confirm once

| Current | Suggested EN | Notes |
|---|---|---|
| `VISTA:` | `VIEW:` | Navbar group label; Spanish for “view”. Keys `data-view` stay. |
| `Mejor en horizontal` | `Better in landscape` | LandscapeGate `<h2>`; copy body already in §0.1. |
| `Entendido` | `Got it` | LandscapeGate dismiss button. |

If OK, append to §0.1 during Stage C. No other new user-facing terms found.

---

## Inventory

Classes: `user-facing` | `demo-vocab` | `test-title` | `comment` | `false-positive`

### User-facing

| file:line | current | suggested EN | class |
|---|---|---|---|
| `src/ui/Navbar.js:31` | `VISTA:` | `VIEW:` | user-facing (**NEW**) |
| `src/ui/Navbar.js:32` | `ANÁLISIS` | `ANALYSIS` | user-facing |
| `src/ui/Navbar.js:33` | `NAVEGACIÓN` | `NAVIGATION` | user-facing |
| `src/ui/ThreadSliders.js:23` | `📐 Control Espacial 3D` | `📐 3D Spatial Controls` | user-facing |
| `src/ui/ThreadSliders.js:28` | `Separación (X):` | `Spacing (X):` | user-facing |
| `src/ui/ThreadSliders.js:31` | `title="Doble clic: restaurar default"` | `title="Double-click: restore default"` | user-facing |
| `src/ui/ThreadSliders.js:37` | `Distancia Vectores (Y):` | `Vector Distance (Y):` | user-facing |
| `src/ui/ThreadSliders.js:40` | `title="Doble clic: restaurar default"` | (same EN title) | user-facing |
| `src/ui/ThreadSliders.js:46` | `Amplitud (Y):` | `Amplitude (Y):` | user-facing |
| `src/ui/ThreadSliders.js:49` | `title="Doble clic: …"` | (same EN title) | user-facing |
| `src/ui/ThreadSliders.js:55` | `Longitud (Z):` | `Length (Z):` | user-facing |
| `src/ui/ThreadSliders.js:58` | `title="Doble clic: …"` | (same EN title) | user-facing |
| `src/ui/ThreadSliders.js:64` | `Grosor Puntos:` | `Point Thickness:` | user-facing |
| `src/ui/ThreadSliders.js:67` | `title="Doble clic: …"` | (same EN title) | user-facing |
| `src/ui/Sidebar.js:35` | `⚡ CALCULAR VECTOR` | `⚡ CALCULATE VECTOR` | user-facing |
| `src/ui/Sidebar.js:78` | `⚡ CALCULAR VECTOR` (setLoading) | `⚡ CALCULATE VECTOR` | user-facing |
| `src/ui/ComparePanel.js:88` | `placeholder="e.g. rueda, motor, freno, …"` | EN sample tokens (D6), e.g. `e.g. wheel, engine, brake, steering, clutch...` | user-facing |
| `src/ui/ComparePanel.js:98` | `🔍 VISUALIZAR SECUENCIA (3D)` | `🔍 VISUALIZE SEQUENCE (3D)` | user-facing |
| `src/ui/ComparePanel.js:109` | `SIMILITUD COSENO vs —` | `COSINE SIMILARITY vs —` | user-facing |
| `src/ui/ComparePanel.js:111` | `title="Mayor → menor"` / `aria-label="Ordenar de mayor a menor"` | `Highest → lowest` / `Sort descending` | user-facing |
| `src/ui/ComparePanel.js:112` | `title="Menor → mayor"` / `aria-label="Ordenar de menor a mayor"` | `Lowest → highest` / `Sort ascending` | user-facing |
| `src/ui/ComparePanel.js:116` | `Visualizá una secuencia para ver similitud vs el ancla...` | `Visualize a sequence to see similarity vs the anchor...` | user-facing |
| `src/ui/ComparePanel.js:237` | `🔍 VISUALIZAR SECUENCIA (3D)` (setLoading) | `🔍 VISUALIZE SEQUENCE (3D)` | user-facing |
| `src/ui/ComparePanel.js:255` | `SIMILITUD COSENO vs —` (clear) | `COSINE SIMILARITY vs —` | user-facing |
| `src/ui/ComparePanel.js:256` | empty-state Visualizá… (clear) | (same EN empty) | user-facing |
| `src/ui/ComparePanel.js:269` | `` SIMILITUD COSENO vs «${anchorWord}» `` | `` COSINE SIMILARITY vs "${anchorWord}" `` (or keep em-dash style) | user-facing |
| `src/ui/LandscapeGate.js:88` | `Mejor en horizontal` | `Better in landscape` | user-facing (**NEW**) |
| `src/ui/LandscapeGate.js:89` | `Girá el teléfono… Podés seguir en vertical…` | `Rotate your phone for a better experience. You can stay in portrait if you prefer.` | user-facing |
| `src/ui/LandscapeGate.js:90` | `Entendido` | `Got it` | user-facing (**NEW**) |

### Demo vocab (D6)

| file:line | current | suggested EN | class |
|---|---|---|---|
| `src/ui/ComparePanel.js:7–44` | `AUTO_MANUAL_VOCAB_ES` (~ES auto parts) | Rename → `AUTO_MANUAL_VOCAB_EN` / drop `_ES`; EN lexicon (`wheel`, `engine`, `brake`, …) | demo-vocab |
| `src/ui/ComparePanel.js:47` | `AUTO_MANUAL_UNIQUE_ES` | `AUTO_MANUAL_UNIQUE_EN` (or drop suffix) | demo-vocab |
| `src/ui/ComparePanel.js:53–57` | `COMPARE_AUTO_PRESETS` uses ES unique list + `sample5` ES | Wire to EN unique; `sample5` → EN tokens | demo-vocab |
| `src/ui/ComparePanel.js:4–5` | JSDoc ES (“Vocabulario típico…”) | EN JSDoc (“Typical auto-manual lexicon…”) | comment (+ demo) |
| `src/ui/ComparePanel.js:18–42` | Section comments ES (Refrigeración, Eléctrico, …) | EN section comments (Cooling, Electrical, …) | comment |

### Test titles (D7)

| file:line | current | suggested EN | class |
|---|---|---|---|
| `tests/CompareMode.test.js:6` | `debe procesar e instanciar secuencias…` | `processes and instantiates token sequences from 1 to 1024` | test-title |
| `tests/CompareMode.test.js:32` | `debe retornar lista vacía…` | `returns an empty list when compare response is null or empty` | test-title |
| `tests/CompareMode.test.js:41` | `debe soportar secuencias grandes…` | `supports large sequences (e.g. 50 tokens)` | test-title |
| `tests/CompareMode.test.js:62` | `debe reordenar hilos 3D…` | `reorders 3D threads with in-place tween (reuse meshes, new sequenceIndex)` | test-title |
| `tests/ThreadLabels.test.js:71` | `debe inicializar el contenedor…` | `initializes the labels overlay container` | test-title |
| `tests/ThreadLabels.test.js:76` | `debe registrar tarjetas…` | `registers label cards for each thread` | test-title |
| `tests/ThreadLabels.test.js:90` | `debe limpiar las etiquetas…` | `clears registered labels` | test-title |
| `tests/ThreadLabels.test.js:104` | `debe actualizar origins…` | `updates origins in-place during reorder tween` | test-title |
| `tests/LayoutEngine.test.js:5` | `debe calcular la coordenada X…` | `computes X from index and interval` | test-title |
| `tests/LayoutEngine.test.js:12` | `debe escalar las posiciones Z…` | `scales Z positions by width factor` | test-title |
| `tests/LayoutEngine.test.js:20` | `debe instanciar LayoutEngine…` | `constructs LayoutEngine with defaults and updates positions` | test-title |
| `tests/LayoutEngine.test.js:25` | `debe mapear puntos 3D en modo ANÁLISIS…` | `maps 3D points in ANALYSIS mode aligned at Z=0 with vertical Y stack` | test-title |
| `tests/LayoutEngine.test.js:38` | `debe ajustar dinámicamente la separación…` | `dynamically adjusts vertical Y spacing when spacingY changes` | test-title |
| `tests/DivergentShading.test.js:5` | `debe mapear valores positivos pico…` | `maps peak positive (+1.0) to incandescent yellow` | test-title |
| `tests/DivergentShading.test.js:13` | `debe mapear valores positivos intermedios…` | `maps mid positive (+0.5) to orange` | test-title |
| `tests/DivergentShading.test.js:20` | `debe mapear el valor cero…` | `maps zero to black with minimum opacity (~0.05)` | test-title |
| `tests/DivergentShading.test.js:28` | `debe optimizar y mapear valores…` | `short-circuits \|t\| < 0.01 to black with minimum opacity` | test-title |
| `tests/DivergentShading.test.js:36` | `debe mapear valores negativos intermedios…` | `maps mid negative (-0.5) to electric blue` | test-title |
| `tests/DivergentShading.test.js:43` | `debe mapear valores negativos pico…` | `maps peak negative (-1.0) to neon violet` | test-title |

### Comments / JSDoc (D7)

| file:line | current | suggested EN | class |
|---|---|---|---|
| `src/ui/Navbar.js:2` | JSDoc mentions `ANÁLISIS \| NAVEGACIÓN` | `ANALYSIS \| NAVIGATION` | comment |
| `src/ui/spatialSliderDefaults.js:2` | `Control Espacial 3D` | `3D Spatial Controls` | comment |
| `src/ui/spatialSliderDefaults.js:33` | `ANÁLISIS` / `Control Espacial` / `framing dulce` | `ANALYSIS` / `Spatial Controls` / `sweet-spot framing` | comment |
| `src/engine/Navigation.js:167` | `ANÁLISIS` | `ANALYSIS` | comment |
| `src/engine/Navigation.js:175` | `Separación` / `Amplitud` | `Spacing` / `Amplitude` | comment |
| `src/main.js:155` | `dulce point` | `sweet spot` | comment |
| `src/visualizer/DivergentShading.js:37–38,49,59,72,109–110,126,137,146` | Mixed ES color names / Optimización / Positivo / Negativo | EN: Black, Orange, Yellow, Electric Blue, Neon Violet; “Computational short-circuit…” | comment |
| `tests/ThreadSliders.test.js:30` | comment `Amplitud Y keeps…` | `Amplitude Y keeps…` | comment |
| `tests/spatialSliderDefaults.test.js:63` | title mentions `Amplitud 40` | `Amplitude 40` | test-title (minor) |

### Clean / false positives

| Item | Notes | class |
|---|---|---|
| `data-view="ANALYSIS"` / `data-view="NAVIGATION"` | Internal keys — **keep** (D2) | false-positive |
| `threadAmplitudeY` / CSS / JS identifiers | Internal — **keep** | false-positive |
| CollapsibleDock / TouchControls / HUD / CustomModal / Sidebar empty states (non-button) | Already EN | false-positive |
| `index.html` `lang="en"` + meta | Already EN | false-positive |
| `backend/**` API/user messages | No ES found (uv.lock accent hashes ignored) | false-positive |
| Historical `CHANGELOG.md` Spanish | Out of scope (D8) — leave | doc-out-of-scope |
| `.agents/**`, `roadmap/archivo/**` | Out of scope (D3) | doc-out-of-scope |
| UI-copy Vitest asserts | None pine Spanish labels today; Stage C still update if any added | false-positive |

---

## Counts

| class | ~rows |
|---|---|
| user-facing | 28 (+ 3 NEW) |
| demo-vocab | vocab block + presets + symbol rename |
| test-title | 19 `debe…` + 1 minor Amplitud |
| comment | ~20 sites across Navbar / sliders defaults / Navigation / main / DivergentShading / ComparePanel |
| backend ES | 0 |

---

## Stage A criteria

- [x] Inventory covers user-facing surfaces (Navbar, docks content, Arithmetic, Compare, sliders, landscape, modals/HUD via read)
- [x] NEW glossary terms listed once (VISTA / Mejor en horizontal / Entendido)
- [x] No translation code in this stage — docs only

**Next:** Approval gate → merge this audit to `main` → Stage C+D on `feat/english-user-facing-copy` (apply glossary + NEW terms + D6–D8).
