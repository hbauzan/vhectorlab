# GUI & Art v25 — VHectorLab-3D (parallel skin + layout)

**Estado:** en curso (Fase 1 scaffold lista para review)  
**Marca:** siempre **VHectorLab-3D** (nunca “Quantum Vector Lab”)  
**Protocolo:** `.agents/skills/dev-protocol/` (ciclo completo + approval gate)  
**HF Space:** **fuera de esta etapa** (otra entrega, con OK explícito)  
**Prompt agente (fase a fase):** [`PROMPT-gui-art-v25.md`](./PROMPT-gui-art-v25.md)

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
- **Riesgos abiertos:** SemVer PATCH `2.2.1` al merge (humano); `main` local ahead 1 (Fase 0) aún sin push.
- **Archivos tocados (alto nivel):** `v25/index.html`, `src/v25/main.js`, `vite.mpa.js`, `vite.config.js`, `backend/static_dist.py`, `backend/server.py`, tests + roadmap/CHANGELOG/lessons.

### Fase 2 — Tokens + skin base
- **Hacer:** `src/v25/tokens.css` (+ import en `style.css` v25) con paleta adaptada (§1 Q5), tipografía (load font display + mono), utilities: `.lab-panel`, `.lab-btn`, focus states.
- **No hacer:** componentes de feature.
- **DoD:** `/v25/` se siente dark-fluo lab; contraste texto OK.
- **Branch:** `feat/v25-tokens`.
- **TDD:** helper puro opcional `contrastRatio` / token map snapshot si aporta; si no, CSS review checklist en hand-off.

### Fase 3 — Layout shell
- **Hacer:** grid/flex 5 regiones; mobile: stack o docks *placeholders* (pueden ser `div` fijos sin collapse aún).
- **DoD:** resize desktop + phone DevTools: las 5 zonas visibles/accesibles; canvas host `flex:1` / full-bleed área central.
- **Branch:** `feat/v25-shell`.
- **No:** lógica de negocio.

### Fase 4 — Header
- **Hacer:** brand **VHectorLab-3D**, version-tag (leer manifest o constante sync luego), selectors MODE/VIEW/RENDER como UI state (pueden no conectar engine), badge ONLINE.
- **Invariante copy:** EN.
- **DoD:** tabs usables visualmente; pressable; no rompen layout mobile.
- **Branch:** `feat/v25-header`.

### Fase 5 — Left Arithmetic chrome
- **Hacer:** form Word A/B/C, CTA “Calculate” (o copy EN actual del legado — **no inventar nombres de producto**), tabla Top-10 vacía con scroll container preparado (contrato lessons §4.1).
- **DoD:** scroll area no “corta” lista en mobile MQ; botón pressable.
- **Branch:** `feat/v25-arithmetic-chrome`.

### Fase 6 — Right + HUD chrome
- **Hacer:** sliders skin (thumb fluo, track “fluido”), viz settings chrome, footer coords placeholders.
- **DoD:** sliders operable nativo; look lab; footer pegado/safe-area.
- **Branch:** `feat/v25-right-hud-chrome`.

### Fase 7 — Wire Arithmetic API
- **Hacer:** reusar `RemoteProvider` (import desde `src/core`); wire Calculate → resultados Top-10 reales; errores vía modal v25 o reusar `CustomModal` adaptado.
- **DoD:** mismo flujo happy-path que legado Arithmetic **sin** exigir canvas.
- **Tests:** mocks provider si aplica; no flaky network en CI.
- **Branch:** `feat/v25-arithmetic-wire`.

### Fase 8 — Canvas + engine
- **Hacer:** montar engine existente en `MainVisualizationCanvas` host; startup `ARITHMETIC | ANALYSIS | POINTS` (`appViewDefaults`).
- **Leer:** lessons §1 WebGL completo.
- **DoD:** threads visibles tras calculate; hover telemetría mínima al footer si el wiring lo permite sin scope creep.
- **Branch:** `feat/v25-canvas-wire`.

### Fase 9 — Sliders live
- **DoD:** Spacing/Distance/Amplitude/Length/Thickness afectan geometría (in-situ buffers).
- **Branch:** `feat/v25-spatial-wire`.

### Fase 10 — Compare
- **DoD:** Compare sequence + cosine vs first; grupos si el legado los tiene.
- **Branch:** `feat/v25-compare`.

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
| 1 | ✅ scaffold (pending merge) | `feat/v25-scaffold` | 2026-08-07 | MPA `/v25/` hello; ver hand-off abajo |
| 2 | ☐ | | | |
| 3 | ☐ | | | |
| 4 | ☐ | | | |
| 5 | ☐ | | | |
| 6 | ☐ | | | |
| 7 | ☐ | | | |
| 8 | ☐ | | | |
| 9 | ☐ | | | |
| 10 | ☐ | | | |
| 11 | ☐ | | | |
| 12 | ☐ | | | |
| 13 | ☐ | | | |
| 99 | ☐ bloqueado | | | HF / cutover |

---

## 11. Relación con `gui-art.md`

Este doc **especializa** el epic GUI & Art con la estrategia `/v25/`.  
Las decisiones A1–A6 del epic genérico quedan **suplantadas** aquí por §1 para el trabajo v25.  
Mantener [`gui-art.md`](./gui-art.md) como índice del norte; el trabajo operativo de agentes es **este archivo + prompt**.
