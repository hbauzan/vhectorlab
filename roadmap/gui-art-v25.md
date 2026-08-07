# GUI & Art v25 — VHectorLab-3D (parallel skin + layout)

**Estado:** en curso (Fases 1–10 en `main` — siguiente: **Fase 11 SAE + viz**)  
**Marca:** siempre **VHectorLab-3D** (nunca “Quantum Vector Lab”)  
**Protocolo:** `.agents/skills/dev-protocol/` (ciclo completo + approval gate)  
**HF Space:** **fuera de esta etapa** (otra entrega, con OK explícito)  
**Prompt agente (fase a fase):** [`PROMPT-gui-art-v25.md`](./PROMPT-gui-art-v25.md)  
**HEAD tip (ops):** `main` @ `ebabbc3` (Fase 10 Compare)

---

## 0. Objetivo

Rehacer look & feel (Rick & Morty / cyberpunk dark-fluo / 90s “atado con alambre”) y layout de chrome **sin romper** la app actual:

- **Legado** sigue en `/` (operativo, sin regressiones intencionales).
- **Nuevo** vive bajo **`/v25/`** (código + URL). Se construye escalonado; se puede probar desde afuera en paralelo.
- **Funciones de producto intactas** a largo plazo: Arithmetic, Compare, SAE, POINTS/RIBBONS, docks, HUD, tips, mobile MQ — portadas/re-cableadas a v25 por fases, no reinventadas en math/backend.

---

## 1. Decisiones cerradas

| ID | Decisión |
| :--- | :--- |
| Marca | `VHectorLab-3D` |
| Q1 | Layout/chrome nuevo (importante) → **escalonado** bajo bandera blanca `/v25/` |
| Q2 | Cyber-lab suave, **dark/fluo** (no neón chillón); botones **3D pressable**; **sin** portal de fondo |
| Q3 | Empezar por **chrome 2D**; 3D look después, cuando el humano lo pida |
| Q4 | Marca intacta |
| Q5 | Adaptar triad actual (gold/cyan/magenta) → verde portal / fluo oscuro |
| Q6 | 1 familia display expresiva + mono solo números/telemetría |
| Q7 | Menos glass → chapa de lab (opaco, borde grueso, inset liviano) |
| Q8 | Pressable liviano + reducir emoji |
| Q9 | Copy **EN técnico corto** (sin slang R&M) |
| Q10 | Sin portal/fondo dedicado; escena 3D actual cuando se conecte |
| Q11 | Motion: 2–3 gestos (press, dock, tip) |
| Q12 | Opción C **con `/v25/`** (rehacer en árbol nuevo; legado vivo) |
| Q13 | **Tokens globales en v25 primero**, luego **panel-por-panel** dentro de v25 (ver §3) |
| Q14 | dev-protocol; **no HF** en esta etapa |
| Stack | **Vanilla JS + Vite MPA** (sin React/TS en v25). Mismos patrones de módulos que `src/`. Tres.js se **reutiliza** desde el engine existente cuando llegue la fase canvas — no fork de math. |
| Backend | **Sin cambios de contrato** `/api/*`. v25 consume el mismo RemoteProvider/API. |

### Q13 — resolución

Con bandera blanca `/v25/`:

1. **Fase tokens** = un solo idioma visual (`:root` v25).  
2. **Luego** slices verticales de panel (Navbar → Left Arithmetic → Canvas host vacío → Right → HUD → Compare → SAE → wire 3D…).  
Así cada agente entrega algo demoable en `/v25/` sin dejar la UI “a dos estilos” *dentro* de v25, y sin tocar `/`.

---

## 2. Arquitectura bandera blanca `/v25/`

### 2.1 Layout de archivos (objetivo)

```text
v25/index.html              # entry MPA → /v25/
src/v25/
  main.js                   # bootstrap solo v25
  style.css                 # tokens + skin v25 (no contaminar src/style.css legado)
  tokens.css                # :root design tokens (fuente de verdad visual)
  ui/                       # Header, docks, paneles, HUD (nuevos)
  …                         # ir agregando; NO borrar src/ legado
```

Legado intacto: `index.html`, `src/main.js`, `src/ui/*`, `src/style.css`.

### 2.2 Vite / serve

- Vite **multi-page**: entries `index.html` (legado) + `v25/index.html`.
- Dev: `http://localhost:5173/` = legado; `http://localhost:5173/v25/` = nuevo.
- Build: ambos en `dist/`; FastAPI ya sirve archivos existentes bajo `dist/` (`FileResponse` si existe) — verificar que `dist/v25/index.html` responda en `/v25/` y `/v25/index.html`.
- Proxy `/api` sin cambios.

### 2.3 Reglas de convivencia

- **Prohibido** en fases tempranas: cambiar comportamiento de `/` para “arreglar” v25.
- **Permitido**: extraer helpers **puros** compartidos a módulos neutros *solo si* hay test y no rompe legado (preferir copy-adapt en `src/v25/` al inicio; dedupe después).
- Imports desde v25 hacia `src/engine/*` / `src/visualizer/*` / `src/core/*`: OK en fases de wire (reutilizar), no duplicar shaders/math.
- Cada fase = **una branch** `feat/v25-<slug>` desde `main` actualizado.

---

## 3. Norte visual (no negociar sin preguntar)

- Canvas 3D es el héroe **cuando exista** en v25; hasta entonces, host vacío con clear color dark-fluo.
- Chrome = chapa de lab / cartoon-game suave, no dashboard genérico.
- Portrait-first; `MOBILE_MQ` (incl. landscape corto) se porta cuando haya docks.
- English-only; tips “i” cortos; sin landscape-gate.
- No romper contratos Top-10 / cosine / docks colapsables **cuando se porten**.

---

## 4. SemVer / docs (por fase)

| Tipo de entrega | SemVer | Docs |
| :--- | :--- | :--- |
| Solo scaffolding `/v25/` + tokens, legado intacto | **PATCH** (superficie paralela no default) o doc-only según criterio humano en approval | `CHANGELOG` + este roadmap + lessons v25 |
| v25 usable como UI alternativa con Arithmetic wireado | **MINOR** | + `CONTEXT` si hay términos nuevos (`v25`, lab chrome) |
| Cutover `/` → v25 (futuro, otra etapa) | **MINOR/MAJOR** a decidir | + HF (etapa aparte) |

**HF publish:** no forma parte de ninguna fase de este doc.

---

## 5. Hand-off obligatorio (entre agentes)

Al **cerrar cada fase**, el agente debe dejar en el PR/reporte y actualizar:

1. **Status** en la tabla §6 (☐ → ✅) + fecha.
2. Sección **Hand-off** al final de esta fase en este archivo (plantilla abajo).
3. Entrada en `.agents/skills/dev-protocol/lessons-learned.md` si hay invariante nueva (prefijo sugerido: `v25:`).
4. Bloque git metadata (dev-protocol).
5. **Approval gate**: no push/merge sin OK humano. HF no.

### Plantilla hand-off (copiar al cerrar fase)

```markdown
### Hand-off — Fase X
- **Branch / commit:** …
- **Cómo probar:** URL `/v25/` … ; legado `/` …
- **Tests:** `npm test` / comandos …
- **Hecho:** …
- **NO hecho (siguiente fase):** …
- **Lecciones:** (bullet o link a lessons-learned §…)
- **Riesgos abiertos:** …
- **Archivos tocados (alto nivel):** …
```

---

## 6. Fases secuenciales (un agente por fase)

> **No en paralelo.** La siguiente fase no empieza hasta hand-off + OK humano (o al menos merge de la fase anterior a `main` si el humano lo pidió).

| Fase | Nombre | DoD (testeable) | Dependencia |
| :---: | :--- | :--- | :--- |
| **0** | Cerrar plan + prompt | Este doc + `PROMPT-gui-art-v25.md` + README roadmap | — |
| **1** | Scaffold MPA `/v25/` | `/` legado OK; `/v25/` carga hello shell | 0 |
| **2** | Design tokens + skin base | Tokens en CSS; página vacía ya se ve “lab dark-fluo” | 1 |
| **3** | Layout shell 5 zonas | Header / Left / CanvasHost / Right / Footer **vacíos** pero grid OK desktop+mobile | 2 |
| **4** | Header chrome | Brand VHectorLab-3D, tabs modo/vista/render **UI-only** (state local), ONLINE badge | 3 |
| **5** | Left: Arithmetic form chrome | Inputs A/B/C + CTA pressable + Top-10 **mock/empty**; scroll contract | 4 |
| **6** | Right + HUD chrome | Sliders skin + viz settings chrome + footer telemetry placeholders | 5 |
| **7** | Wire Arithmetic → API | Calculate real vía `/api`; Top-10 real; **canvas aún stub** | 6 |
| **8** | Canvas host + engine reuse | Montar Scene/Instancer existente en host v25; POINTS startup | 7 |
| **9** | Spatial sliders → layout live | Controles derecha mutan threads (in-situ) | 8 |
| **10** | Compare panel port | MODE Compare en v25; grupos/cosine | 9 |
| **11** | SAE + viz filters port | Clean/Denoise + sign/colors | 10 |
| **12** | Mobile docks + tips + touch | CollapsibleDock, fieldInfo, joystick; MQ | 11 |
| **13** | Polish motion + copy pass | 2–3 gestos; emoji reducidos; EN check | 12 |
| **99** | Cutover + HF *(otra etapa)* | Decidir default `/` vs `/v25/`; HF force-publish | OK humano explícito |

Fases **1–6** = chrome (alineado a “empezar con menos esfuerzo”).  
**7+** = el humano las va pidiendo; el plan ya las deja encadenadas.

---

## 7. Detalle por fase (agente)

### Fase 0 — Plan (esta entrega de docs)
- **Hacer:** este roadmap + prompt + índice README.
- **No hacer:** código app.
- **DoD:** docs mergeables; decisiones §1 visibles.
- **Hand-off → Fase 1:** “Scaffold Vite MPA según §2”.

### Fase 1 — Scaffold `/v25/`
- **Leer:** lessons §1 WebGL (no tocar aún), §3 nav, §7 SemVer; `vite.config.js`; `backend/server.py` static.
- **Hacer:**
  - `v25/index.html` + `src/v25/main.js` mínimo (`#app` + texto “VHectorLab-3D v25”).
  - Vite `build.rollupOptions.input` multi-page.
  - Test smoke: build produce `dist/v25/index.html`; dev sirve `/v25/`.
  - Verificar FastAPI/`dist` sirve `/v25/` si `dist` existe (script o nota de verificación).
- **No hacer:** tokens pesados, layout, imports del visualizer.
- **Tests:** al menos 1 test de config helper si se extrae `getViteInputs()`; o checklist documentado + `npm run build`.
- **DoD:** `/` idéntico en smoke manual; `/v25/` carga.
- **Branch:** `feat/v25-scaffold`.

#### Hand-off — Fase 1
- **Branch / commit:** `feat/v25-scaffold` (tip; scaffold `603451f`). Fase 0 docs on `main` = `2d79175` (local ahead of origin, unpushed).
- **Cómo probar:** `npm run dev` → `http://localhost:5173/` legado; `http://localhost:5173/v25/` texto `VHectorLab-3D v25`. Prod-like: `npm run build && npm run preview` → mismos paths. Con `dist/` presente, FastAPI `resolve_dist_file` sirve `/v25` y `/v25/`.
- **Tests:** `npm test` (incl. `tests/viteMpaInputs.test.js`); `cd backend && uv run pytest tests/test_static_dist.py`; `npm run build` → `dist/v25/index.html`.
- **Hecho:** MPA Vite (main + v25); hello shell; static helper MPA-aware; sin tokens/layout/engine.
- **NO hecho (siguiente fase):** tokens + skin base (`feat/v25-tokens`).
- **Lecciones:** `v25:` MPA inputs + directory index en lessons-learned.
- **Riesgos abiertos:** ninguno para Fase 1; SemVer `2.2.1` cortado en el ship.
- **Archivos tocados (alto nivel):** `v25/index.html`, `src/v25/main.js`, `vite.mpa.js`, `vite.config.js`, `backend/static_dist.py`, `backend/server.py`, tests + roadmap/CHANGELOG/lessons.

### Fase 2 — Tokens + skin base
- **Hacer:** `src/v25/tokens.css` (+ import en `style.css` v25) con paleta adaptada (§1 Q5), tipografía (load font display + mono), utilities: `.lab-panel`, `.lab-btn`, focus states.
- **No hacer:** componentes de feature.
- **DoD:** `/v25/` se siente dark-fluo lab; contraste texto OK.
- **Branch:** `feat/v25-tokens`.
- **TDD:** helper puro opcional `contrastRatio` / token map snapshot si aporta; si no, CSS review checklist en hand-off.

#### Hand-off — Fase 2
- **Branch / commit:** `feat/v25-tokens` (tip after commit).
- **Cómo probar:** reiniciar Vite → `http://127.0.0.1:5173/v25/` (o `/v25` → redirect). Debe verse brand, panel chapa, swatches triad, botones pressable. Legado `/` intacto.
- **Tests:** `npm test` (incl. `tests/v25Tokens.test.js` WCAG contrast); `npm run build`.
- **Hecho:** `tokens.css` + `style.css`; Oxanium + IBM Plex Mono; `.lab-panel` / `.lab-btn` / focus; contrast helper + token hex snapshot.
- **NO hecho (siguiente fase):** layout shell 5 zonas (`feat/v25-shell`).
- **Lecciones:** (ninguna nueva de runtime; contrast sync `tokenValues.js` ↔ CSS).
- **Riesgos abiertos:** fonts Google CDN (offline = fallback system); SemVer PATCH opcional al merge.
- **Archivos tocados (alto nivel):** `src/v25/tokens.css`, `style.css`, `main.js`, `contrast.js`, `tokenValues.js`, `v25/index.html`, tests + roadmap.

### Fase 3 — Layout shell
- **Hacer:** grid/flex 5 regiones; mobile: stack o docks *placeholders* (pueden ser `div` fijos sin collapse aún).
- **DoD:** resize desktop + phone DevTools: las 5 zonas visibles/accesibles; canvas host `flex:1` / full-bleed área central.
- **Branch:** `feat/v25-shell`.
- **No:** lógica de negocio.

#### Hand-off — Fase 3
- **Branch / commit:** `feat/v25-shell` (tip after commit).
- **Cómo probar:** `http://127.0.0.1:5173/v25/` — desktop: header / left / canvas / right / footer. DevTools phone: stack header→canvas→left→right→footer; canvas min ~40vh. Legado `/` OK.
- **Tests:** `npm test` (incl. `tests/v25Shell.test.js`); `npm run build`.
- **Hecho:** `ui/shell.js` + `shell.css`; MQ alineado a `MOBILE_MQ` legado; placeholders vacíos.
- **NO hecho (siguiente fase):** Header chrome real (`feat/v25-header`).
- **Lecciones:** ninguna nueva.
- **Riesgos abiertos:** docks colapsables → Fase 12; header content → Fase 4.
- **Archivos tocados (alto nivel):** `src/v25/ui/shell.js`, `shell.css`, `main.js`, `style.css`, tests + roadmap/CHANGELOG.

### Fase 4 — Header
- **Hacer:** brand **VHectorLab-3D**, version-tag (leer manifest o constante sync luego), selectors MODE/VIEW/RENDER como UI state (pueden no conectar engine), badge ONLINE.
- **Invariante copy:** EN.
- **DoD:** tabs usables visualmente; pressable; no rompen layout mobile.
- **Branch:** `feat/v25-header`.

#### Hand-off — Fase 4
- **Branch / commit:** `feat/v25-header` → `main` (after ship).
- **Cómo probar:** `/v25/` — brand + `v2.2.1`, tabs MODE/VIEW/RENDER pressable (UI state only), badge ONLINE. Mobile: tabs scroll/wrap. Legado `/` OK.
- **Tests:** `npm test` (incl. `tests/v25Header.test.js`).
- **Hecho:** `ui/header.js` + `header.css` + `version.js`; defaults from `appViewDefaults`.
- **NO hecho (siguiente fase):** Left Arithmetic chrome (`feat/v25-arithmetic-chrome`).
- **Lecciones:** ninguna nueva.
- **Riesgos abiertos:** ONLINE aún no pega `/api/health` (wire después); engine no escucha tabs.
- **Archivos tocados (alto nivel):** `src/v25/ui/header.js`, `header.css`, `version.js`, `main.js`, tests + roadmap/CHANGELOG.

### Fase 5 — Left Arithmetic chrome
- **Hacer:** form Word A/B/C, CTA “Calculate” (o copy EN actual del legado — **no inventar nombres de producto**), tabla Top-10 vacía con scroll container preparado (contrato lessons §4.1).
- **DoD:** scroll area no “corta” lista en mobile MQ; botón pressable.
- **Branch:** `feat/v25-arithmetic-chrome`.

#### Hand-off — Fase 5
- **Branch / commit:** `feat/v25-arithmetic-chrome` → `main` (after ship).
- **Cómo probar:** `/v25/` left dock — king/man/woman, CALCULATE VECTOR pressable (no API yet), Top-10 empty host with §4.1 scroll. Short height ≤560px: panel scrolls. Legado `/` OK.
- **Tests:** `npm test` (incl. `tests/v25ArithmeticChrome.test.js`).
- **Hecho:** `ui/arithmeticPanel.js` + `arithmetic.css`; scroll formulas from `ARITHMETIC_TOP10_SCROLL`.
- **NO hecho (siguiente fase):** Right + HUD chrome (`feat/v25-right-hud-chrome`); API wire → Fase 7.
- **Lecciones:** ninguna nueva (reuso §4.1).
- **Riesgos abiertos:** Calculate aún no-op sin callback; tips “i” → Fase 12.
- **Archivos tocados (alto nivel):** `src/v25/ui/arithmeticPanel.js`, `arithmetic.css`, `main.js`, tests + roadmap/CHANGELOG.

### Fase 6 — Right + HUD chrome
- **Hacer:** sliders skin (thumb fluo, track “fluido”), viz settings chrome, footer coords placeholders.
- **DoD:** sliders operable nativo; look lab; footer pegado/safe-area.
- **Branch:** `feat/v25-right-hud-chrome`.

#### Hand-off — Fase 6
- **Branch / commit:** `feat/v25-right-hud-chrome` → `main` (after ship).
- **Cómo probar:** `/v25/` right dock — 5 spatial sliders update labels; viz filter/colors/labels UI-only; footer COORDS/TELEMETRY/TOKEN placeholders + safe-area. Legado `/` OK.
- **Tests:** `npm test` (incl. `tests/v25RightHudChrome.test.js`).
- **Hecho:** `ui/rightDock.js`, `ui/footerHud.js`, `rightHud.css`; defaults from `resolveSpatialDefaults` + `DEFAULT_VISUALIZATION_SETTINGS`.
- **NO hecho (siguiente fase):** Wire Arithmetic → API (`feat/v25-arithmetic-wire`). Chrome 1–6 complete.
- **Lecciones:** ninguna nueva.
- **Riesgos abiertos:** sliders/viz no mutan scene aún (Fase 8–9); SAE chrome no en right aún.
- **Archivos tocados (alto nivel):** `rightDock.js`, `footerHud.js`, `rightHud.css`, `main.js`, tests + roadmap/CHANGELOG.

### Fase 7 — Wire Arithmetic API
- **Hacer:** reusar `RemoteProvider` (import desde `src/core`); wire Calculate → resultados Top-10 reales; errores vía modal v25 o reusar `CustomModal` adaptado.
- **DoD:** mismo flujo happy-path que legado Arithmetic **sin** exigir canvas.
- **Tests:** mocks provider si aplica; no flaky network en CI.
- **Branch:** `feat/v25-arithmetic-wire`.

#### Hand-off — Fase 7
- **Branch / commit:** `feat/v25-arithmetic-wire` + fix `fix/v25-arithmetic-results-visible` → `main` @ `30fc841`.
- **Cómo probar:** backend up + `npm run dev` → `http://127.0.0.1:5173/v25/` → con ONLINE, el panel **izquierdo** auto-llena Top-10 (`10 neighbors from API`, p.ej. queen…). CALCULATE VECTOR refresca. Canvas centro sigue stub (placeholder). Legado `/` OK.
- **Tests:** `npm test` (incl. `tests/v25ArithmeticWire.test.js`).
- **Hecho:** `RemoteProvider` wire; Top-10 live; lab modal offline/error; auto-calc on healthy boot; status line visible.
- **NO hecho (siguiente fase):** Canvas + engine reuse (`feat/v25-canvas-wire`) — montar Scene/Instancer en host `data-zone="canvas"`; threads tras calculate; hover→footer opcional sin scope creep.
- **Lecciones:** `v25:` bare `/v25` redirect (§6.0); Top-10 vive en left dock, no en el canvas stub.
- **Riesgos abiertos para Fase 8:** lessons §1 WebGL (`frustumCulled`, fog, POINTS); no fork math/shaders — import desde `src/engine/*` / `src/visualizer/*`; startup `ARITHMETIC|ANALYSIS|POINTS`; no wire sliders live aún (Fase 9). Preferencias `localStorage` arithmetic aún no portadas.
- **Archivos tocados (alto nivel):** `src/v25/main.js`, `arithmeticWire.js`, `ui/arithmeticPanel.js`, `ui/labModal.js`, shell/header/right/footer chrome, tests + roadmap/CHANGELOG.

### Fase 8 — Canvas + engine
- **Hacer:** montar engine existente en `MainVisualizationCanvas` host; startup `ARITHMETIC | ANALYSIS | POINTS` (`appViewDefaults`).
- **Leer:** lessons §1 WebGL completo.
- **DoD:** threads visibles tras calculate; hover telemetría mínima al footer si el wiring lo permite sin scope creep.
- **Branch:** `feat/v25-canvas-wire`.

#### Hand-off — Fase 8
- **Branch / commit:** `feat/v25-canvas-wire` → `main` (after ship).
- **Cómo probar:** backend up + `npm run dev` → `http://127.0.0.1:5173/v25/` → ONLINE auto-calc: Top-10 left **and** POINTS threads in center canvas (ANALYSIS framing). Hover a point → footer COORDS / HOVER TELEMETRY / TOKEN. CALCULATE VECTOR refreshes both. Legado `/` OK (smoke). Prefer URL with trailing slash.
- **Tests:** `npm test` (incl. `tests/v25CanvasWire.test.js`); `npm run build` → `dist/v25/index.html` + shared engine chunk.
- **Hecho:** `mountCanvasHost` reuses `SceneSetup` / `Navigation` / `Instancer` / `Interaction` / `ThreadLabels`; resize from host (not window); startup triad; hover→footer via `resolveHoverTelemetry`.
- **NO hecho (siguiente fase):** Spatial sliders → live layout (`feat/v25-spatial-wire`); header MODE/VIEW/RENDER still UI-only; Compare/SAE/mobile docks later.
- **Lecciones:** `v25:` canvas size = container (§6.0b lessons-learned).
- **Riesgos abiertos para Fase 9:** wire `mountRightDock` slider callbacks → `spatialConfig` + `instancer.renderArithmeticData` in-situ (reuse legado `wireThreadSliders` pattern); keep ANALYSIS|POINTS framing; do not fork LayoutEngine; header RENDER/VIEW still not wired (optional thin hook if needed for fog/RIBBONS — ask if scope creep).
- **Archivos tocados (alto nivel):** `src/v25/canvasHost.js`, `canvas.css`, `main.js`, `style.css`, `shell.css`, tests + roadmap/CHANGELOG/lessons.

### Fase 9 — Sliders live
- **DoD:** Spacing/Distance/Amplitude/Length/Thickness afectan geometría (in-situ buffers).
- **Branch:** `feat/v25-spatial-wire`.

#### Hand-off — Fase 9
- **Branch / commit:** `feat/v25-spatial-wire` → `main` (after ship).
- **Cómo probar:** `http://127.0.0.1:5173/v25/` → after auto-calc, drag **Spacing / Vector Distance / Amplitude / Length / Thickness** — threads rebuild live (no new API). Dblclick a slider → context default (Amp 40). Viz filter/colors still chrome-only (Fase 11). Legado `/` OK.
- **Tests:** `npm test` (incl. `tests/v25SpatialWire.test.js`); `npm run build`.
- **Hecho:** `onSpatialChange` → `canvas.setSpatialConfig` + cached arithmetic re-paint; right dock inits with `canvasStartupContext` defaults; dblclick reset §4.5.
- **NO hecho (siguiente fase):** Compare panel port (`feat/v25-compare`); header MODE still UI-only; viz filter/colors → Fase 11.
- **Lecciones:** ninguna nueva (reuso legado refresh pattern + §4.5 dblclick).
- **Riesgos abiertos para Fase 10:** port Compare MODE + cosine list; keep Arithmetic path intact; do not wire SAE yet.
- **Archivos tocados (alto nivel):** `canvasHost.js` (`mergeSpatialConfig` / `setSpatialConfig`), `rightDock.js`, `main.js`, tests + roadmap/CHANGELOG.

### Fase 10 — Compare
- **DoD:** Compare sequence + cosine vs first; grupos si el legado los tiene.
- **Branch:** `feat/v25-compare`.

#### Hand-off — Fase 10
- **Branch / commit:** `feat/v25-compare` → `main` (after ship).
- **Cómo probar:** `/v25/` → MODE **COMPARE** → auto Visualize groups demo (GROUP_1/GROUP_2) → cosine list vs REF + group chips + 3D group badges. ▲/▼ reorder animates threads. Presets 5/20/50/Groups. MODE **ARITHMETIC** restores Top-10 + arithmetic threads. Sliders still live for active mode. Legado `/` OK. No SAE.
- **Tests:** `npm test` (incl. `tests/v25CompareWire.test.js`, `v25ComparePanel.test.js`); `npm run build`.
- **Hecho:** left host Arithmetic⊕Compare; header MODE wires panels + canvas `setWorkspaceMode`; `fetchCompareResults` + Instancer compare/reorder; groups parse/meta/legend/overlay.
- **NO hecho (siguiente fase):** SAE + viz filters (`feat/v25-sae-viz`); VIEW/RENDER engine wire; dim-sort; mobile docks.
- **Lecciones:** `v25:` MODE toggles visibility — never wipe left host (both panels stay mounted).
- **Riesgos abiertos para Fase 11:** viz filter/colors → Instancer; SAE chrome on Compare only; keep Arithmetic path; no HF.
- **Archivos tocados (alto nivel):** `compareWire.js`, `ui/comparePanel.js`, `compare.css`, `canvasHost.js`, `main.js`, `rightDock.js`, tests + roadmap/CHANGELOG/lessons.

### Fase 11 — SAE + viz filters
- **DoD:** Train/Clean parity razonable; sign filter + color anchors.
- **Branch:** `feat/v25-sae-viz`.

### Fase 12 — Mobile + tips + touch
- **DoD:** docks colapsables; tips tap; joystick; no regress “lista cortada” / landscape corto.
- **Branch:** `feat/v25-mobile`.

### Fase 13 — Polish
- **DoD:** motion budget; emoji reducidos; audit EN; lessons actualizadas.
- **Branch:** `feat/v25-polish`.

### Fase 99 — Cutover + HF *(NO este epic aún)*
- Requiere OK explícito aparte. Posible: redirect, o swap entries, + `HF_SPACE_FORCE_PUSH`.

---

## 8. Fuera de alcance (hasta pedido explícito)

- Renombrar producto.
- React/Vue/Tailwind rewrite.
- Backend/SAE math nuevo; MESH; landscape-gate; i18n framework.
- Portal animado de fondo.
- Publicar HF Space.
- Borrar o degradar `/` legado antes de Fase 99.

---

## 9. Definition of done (slice / fase)

- Demoable en `/v25/` según DoD de la fase.
- `/` legado no regressado (smoke).
- Tests verdes (`npm test` + los que agregue la fase).
- Hand-off + lessons si hay invariante nueva.
- Approval gate cumplido antes de push/merge.

---

## 10. Registro de avance

| Fase | Estado | Branch | Fecha | Notas |
| :---: | :--- | :--- | :--- | :--- |
| 0 | ✅ docs | `main` `2d79175` | 2026-08-07 | Plan inicial |
| 1 | ✅ merged | `feat/v25-scaffold` → `main` | 2026-08-07 | MPA `/v25/` hello; PATCH `2.2.1`; slash fix `019bdbe` |
| 2 | ✅ merged | `feat/v25-tokens` → `main` | 2026-08-07 | tokens + skin utilities |
| 3 | ✅ merged | `feat/v25-shell` → `main` | 2026-08-07 | 5-zone grid + mobile stack |
| 4 | ✅ merged | `feat/v25-header` → `main` | 2026-08-07 | brand + MODE/VIEW/RENDER UI + ONLINE |
| 5 | ✅ merged | `feat/v25-arithmetic-chrome` → `main` | 2026-08-07 | form A/B/C + Top-10 scroll host |
| 6 | ✅ merged | `feat/v25-right-hud-chrome` → `main` | 2026-08-07 | spatial sliders + viz + footer HUD |
| 7 | ✅ merged | `feat/v25-arithmetic-wire` → `main` | 2026-08-07 | Top-10 API + auto-boot; tip `30fc841`; canvas stub |
| 8 | ✅ merged | `feat/v25-canvas-wire` → `main` | 2026-08-07 | engine in canvas; POINTS; hover→footer; tip `226ac65` |
| 9 | ✅ merged | `feat/v25-spatial-wire` → `main` | 2026-08-07 | sliders → live geometry |
| 10 | ✅ merged | `feat/v25-compare` → `main` | 2026-08-07 | Compare MODE + cosine + groups |
| 11 | ☐ | | | |
| 12 | ☐ | | | |
| 13 | ☐ | | | |
| 99 | ☐ bloqueado | | | HF / cutover |

---

## 11. Relación con `gui-art.md`

Este doc **especializa** el epic GUI & Art con la estrategia `/v25/`.  
Las decisiones A1–A6 del epic genérico quedan **suplantadas** aquí por §1 para el trabajo v25.  
Mantener [`gui-art.md`](./gui-art.md) como índice del norte; el trabajo operativo de agentes es **este archivo + prompt**.
