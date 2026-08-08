# Amiga Workbench skin — `/amiga` (MagicWB)

**Estado:** activo — Slices 2–6 wire listos (approval gate); Slice 7 HF Space pendiente de OK  
**Protocolo:** `.agents/skills/dev-protocol/` (ciclo completo + approval gate)  
**Prompt agente:** [`PROMPT-amiga-workbench.md`](./PROMPT-amiga-workbench.md)  
**SemVer:** línea **`2.4.x`** (actual **2.4.1**)  
**HF Space público:** **solo al final** (§7 Slice final) — no en slices intermedios

---

## 0. Norte

Bandera blanca **`/amiga/`**: UI paralela con estética **Commodore Amiga Workbench 3.0 + Magic Workbench** (tipografía pixel / efecto serrucho + paleta MagicWB).

- **No** es un reskin del legado `/`.
- **No** es v25 ni continúa `gui-art` / `gui-art-v25`.
- Canvas 3D **no se toca** en este epic (clear color / shaders / POINTS / RIBBONS quedan como el engine actual cuando se cablee).
- Profundidad de este epic = **Q2-A**: tipografía + paleta + chrome mínimo legible.  
  **Q2-C** (cosplay full: iconos MagicWB, drawers, pointer, metaphors) → roadmap **aparte**, después de que `/amiga` esté usable.

---

## 1. Decisiones cerradas (Q1–Q10)

| ID | Decisión |
| :--- | :--- |
| **Q1** | Bandera blanca **`/amiga/`**. Legado `/` intacto. **`src/v25/**` y `v25/**` — PROHIBIDO tocar (explícito; ver lessons §6.0e). |
| **Q2** | **A** — tipografía pixel + paleta MagicWB (+ chrome 2D mínimo para que se lea como WB). **C** (cosplay) → epic futuro aparte. |
| **Q3** | **A** — no artear el look 3D; canvas héroe reusa engine sin “pixelizar” puntos/ribbons. |
| **Q4** | **A** — self-host Topaz (`.ttf` / `.woff2` en repo bajo `amiga/` o `src/amiga/assets/`). Sin CDN GitHub raw. |
| **Q5** | **A** — CSS estático (tokens + clase raíz). **No** inyección dinámica de `<style>` por JS. |
| **Q6** | Paleta **Magic Workbench** (8 colores canónicos + tokens semánticos). |
| **Q7** | Desktop **y** mobile desde el inicio. Si mobile se complica (legibilidad Topaz / density) → **parar y preguntar** con propuesta, no inventar. |
| **Q8** | Cero relación con `gui-art` / v25. Separación total. Lesson obligatoria. SemVer **2.4.x**. |
| **Q9** | HF Space público = **último slice** del epic (§7). |
| **Q10** | Primer slice demoable = shell `/amiga/` con Topaz + serrucho + fondo/paleta MagicWB. |

### Fuera de alcance (este epic)

- Editar `src/v25/**`, `v25/index.html`, tokens/skin v25.
- Contaminar `src/style.css` / `src/main.js` legado “para que amiga funcione”.
- Cosplay Q2-C (icon packs, drawer metaphors, Amiga pointer custom) — doc futuro.
- Cambiar contratos `/api/*` / SAE math / Galaxy.
- Publicar HF Space antes del slice final.

---

## 2. Arquitectura bandera blanca `/amiga/`

### 2.1 Layout de archivos (objetivo)

```text
amiga/index.html                 # entry MPA → /amiga/
src/amiga/
  main.js                        # bootstrap solo amiga
  style.css                      # importa tokens + skin
  tokens.css                     # :root MagicWB + Topaz
  assets/fonts/                  # TopazNew self-hosted (+ LICENSE)
  ui/                            # shell / paneles (crecer por slice)
  …                              # copy-adapt desde legado si hace falta; NO editar legado para “arreglar” amiga
```

Legado intacto: `index.html`, `src/main.js`, `src/ui/*`, `src/style.css`.  
v25 intacto: `v25/**`, `src/v25/**`.

### 2.2 Vite / serve

Extender el MPA existente (mismo patrón que v25):

- `getViteInputs` → agregar `amiga: …/amiga/index.html`.
- `mpaTrailingSlashRedirect` / `mpaTrailingSlashLocation` → incluir `'/amiga'`.
- Dev: `http://127.0.0.1:5173/amiga/` (con slash).
- Build: `dist/amiga/index.html`; FastAPI `resolve_dist_file` ya cubre `path/index.html`.
- Proxy `/api` sin cambios.

### 2.3 Reglas de convivencia

| Árbol | Política en este epic |
| :--- | :--- |
| `/` legado | **No modificar** salvo smoke check de no-regresión (idealmente `git diff` vacío en paths legado). |
| `/v25/` | **PROHIBIDO**. Verificación: `git diff -- src/v25 v25` vacío antes de approval. |
| `/amiga/` | Único lugar de trabajo nuevo. |
| `src/engine/*`, `src/visualizer/*`, `src/core/*` | Reusar por import en slices de wire (como v25); **no** fork de math/shaders. |
| Helpers puros compartidos | Preferir copy-adapt en `src/amiga/` al inicio; extraer a módulo neutro solo con test + OK humano. |

---

## 3. Norte visual (MagicWB + Topaz)

### 3.1 Tipografía

- Familia: **TopazNew** (o Topaz equivalente self-hosted).
- Tamaños en **múltiplos de 8** (base **16px**; line-height tip. **20px**).
- Sin antialiasing / efecto serrucho:

```css
-webkit-font-smoothing: none;
-moz-osx-font-smoothing: grayscale; /* o unset según plataforma; documentar en lesson si diverge */
text-rendering: optimizeSpeed;
font-smooth: never; /* non-standard; harmless where ignored */
```

- Imágenes UI (si hay): `image-rendering: pixelated` / `crisp-edges`.

### 3.2 Paleta Magic Workbench (8 pens)

Fuente canónica (Wikipedia / MagicWB docs), RGB → hex:

| Idx | Hex | Rol sugerido (token) |
| :---: | :--- | :--- |
| 0 | `#959595` | `--mwb-gray` fondo escritorio / paneles |
| 1 | `#000000` | `--mwb-black` texto |
| 2 | `#FFFFFF` | `--mwb-white` highlight / shine |
| 3 | `#3B67A2` | `--mwb-blue` acento / titlebar-ish |
| 4 | `#7B7B7B` | `--mwb-halfshadow` |
| 5 | `#AFAFAF` | `--mwb-halfshine` |
| 6 | `#AA907C` | `--mwb-tan` |
| 7 | `#FFA997` | `--mwb-peach` |

Tokens semánticos mínimos (Slice 1+):

```text
--amiga-bg: var(--mwb-gray);
--amiga-fg: var(--mwb-black);
--amiga-accent: var(--mwb-blue);
--amiga-font: 'TopazNew', monospace;
--amiga-font-size: 16px;
--amiga-line-height: 20px;
```

> Nota: el gris clásico WB `#aaaaaa` / azul titlebar `#0055aa` del snippet original **ceden** a MagicWB (§Q6). Si hace falta un azul más “WB 3.0 puro” para titlebars en un slice de chrome, preguntar antes de desviarse.

### 3.3 Mobile

- Mismos tokens; tipografía 16px puede ser densa → medir portrait + landscape corto (`MOBILE_MQ` del legado como referencia).
- Si Topaz ilegible o docks imposibles: **diseñar 1–2 opciones y preguntar** (no bajar a 14px “porque sí”; múltiplos de 8 o pregunta).

---

## 4. SemVer / docs

| Entrega | SemVer | Docs |
| :--- | :--- | :--- |
| Slice 1: scaffold `/amiga/` + Topaz + tokens MagicWB visibles | **MINOR `2.4.0`** | CHANGELOG + CONTEXT término `amiga` + lessons §6.0e |
| Slices siguientes (shell, wire producto) | **PATCH `2.4.x`** | CHANGELOG Unreleased / sección 2.4.x |
| Cosplay Q2-C (otro roadmap) | a decidir | — |
| HF Space cutover / demo pública | Slice final (§7) | README/HF docs según `hf-space-cpu-demo.md` |

Versión producto en Navbar/manifest: **solo** cuando el slice de amiga lo pida en su DoD; **no** sync cortesía a v25 (§6.0d + §6.0e).

---

## 5. Invariantes que NO romper

- English-only product copy.
- Contratos API `/api/*`.
- Lecciones WebGL existentes si se cablea canvas (frustum, fog, etc.).
- `git diff -- src/v25 v25` vacío siempre en este epic.
- Preferir `git diff` vacío en legado `/` (`index.html`, `src/main.js`, `src/style.css`, `src/ui/*`) salvo cambios MPA compartidos inevitables (`vite.mpa.js`, `vite.config.js`, tests MPA).

Cambios MPA compartidos permitidos (mínimos):

- `vite.mpa.js` / `vite.config.js` — agregar entry + redirect `/amiga`.
- `tests/viteMpaInputs.test.js` (o equivalente) — cubrir `amiga`.
- FastAPI solo si hace falta test de `resolve_dist_file` con `/amiga/` (probablemente ya genérico).

---

## 6. Slices secuenciales

> **No en paralelo.** Un slice / sesión. Approval gate → OK → merge antes del siguiente.

| Slice | Nombre | DoD (testeable) | Dep | Status |
| :---: | :--- | :--- | :---: | :--- |
| **0** | Plan + prompt | Este doc + `PROMPT-amiga-workbench.md` + README roadmap + lesson §6.0e | — | ✅ 2026-08-08 |
| **1** | Scaffold MPA + Topaz + tokens | `/amiga/` carga; Topaz self-host; serrucho; fondo MagicWB; `/` y `/v25/` intactos; bump **2.4.0**; tests MPA verdes | 0 | ✅ 2026-08-08 (branch `feat/amiga-scaffold`) |
| **2** | Shell layout desktop+mobile | Zonas mínimas (header / left / canvas-host / right o equivalente) con tokens; responsive OK o pregunta si falla | 1 | ✅ 2026-08-08 |
| **3** | Chrome 2D mínimo | Paneles legibles “WB-ish” **sin** cosplay Q2-C (bordes/contraste MagicWB, no icon packs) | 2 | ✅ 2026-08-08 |
| **4** | Wire Arithmetic (o panel primario legado) | CTA real vía `/api`; lista resultados; canvas aún stub OK | 3 | ✅ 2026-08-08 |
| **5** | Canvas host + engine reuse | Montar scene existente en host amiga; POINTS startup; **sin** retocar shaders/look 3D | 4 | ✅ 2026-08-08 |
| **6** | Compare / SAE / viz (según prioridad humana) | Port vertical de superficies críticas; mobile no roto | 5 | ✅ 2026-08-08 |
| **7** | Polish + HF Space | Smoke desktop+mobile; CONTEXT/CHANGELOG; **publicar Space** con OK explícito | 6 | ⏳ polish docs; HF = ask |

### Hand-off (plantilla)

```markdown
### Hand-off — Slice N
- **Branch / commit:** …
- **Cómo probar:** `/amiga/` … ; smoke `/` y `/v25/` sin cambios visuales
- **Tests:** …
- **Hecho:** …
- **NO hecho:** …
- **Verificación aislamiento:** `git diff -- src/v25 v25` vacío; legado solo MPA shared si aplica
- **Riesgos / preguntas mobile:** …
```

---

## 7. HF Space (último)

Solo cuando Slices 1–6 cumplan DoD y el humano diga OK:

1. Confirmar qué URL es default en Space (`/` vs `/amiga/` vs link). **Preguntar** si no está cerrado.
2. Seguir proceso existente de publish (`hf-space-cpu-demo.md` / force-push Space).
3. Documentar en CHANGELOG + README cómo abrir el skin Amiga.

---

## 8. Epic futuro (no este doc)

**`amiga-workbench-cosplay.md`** (crear cuando se pida): Q2-C — iconos MagicWB/NewIcons, drawers, pointer, patterns de escritorio, gadgets pressable full. Depende de `/amiga` usable.

---

## 9. Smoke checklist (acumulativa)

1. `http://127.0.0.1:5173/` — legado igual.
2. `http://127.0.0.1:5173/v25/` — v25 igual (no tocado).
3. `http://127.0.0.1:5173/amiga/` — Topaz + MagicWB visibles.
4. `/amiga` sin slash → redirect a `/amiga/`.
5. Phone portrait + landscape corto: texto legible o issue abierto al humano.
6. Tras wire: Arithmetic/Compare no rompen contratos Top-10 / cosine.

---

## 10. Slice 0 — hecho al crear este plan

- [x] Decisiones Q1–Q10 cerradas
- [x] Este roadmap
- [x] Prompt agente
- [x] Entrada README roadmap
- [x] Lesson §6.0e aislamiento `/amiga` + v25 off-limits en este epic

### Hand-off — Slices 2–6 (wire)
- **Branch:** `feat/amiga-scaffold`
- **Cómo probar:** `npm run dev` → `http://127.0.0.1:5173/amiga/` — lab completo MagicWB; Calculate / Compare / SAE; smoke `/` y `/v25/`
- **Tests:** `npm test` (amigaShell, amigaTokens, amigaEnvColors, viteMpa…)
- **Hecho:** shell 5 zonas; chrome MagicWB overrides; AmigaApp = legado wire en zonas; canvas host-sized; SemVer **2.4.1**
- **NO hecho:** HF Space publish (Slice 7 — preguntar URL default)
- **Verificación aislamiento:** sin tocar `src/v25/**`
- **Nota:** UI modules reusan `src/ui/*` + `src/engine/*` (legado), no v25

### Hand-off — Slice 1
- **Branch / commit:** `feat/amiga-scaffold` (local; approval gate)
- **Cómo probar:** `npm run dev` → `http://127.0.0.1:5173/amiga/` (Topaz + gris MagicWB + titlebar azul + 8 swatches); smoke `/` y `/v25/` sin cambios de skin; `/amiga` sin slash → `/amiga/`
- **Tests:** `npm test` (incl. `amigaTokens`, `viteMpaInputs`)
- **Hecho:** MPA entry, tokens MagicWB, Topaz self-host GPL-FE, SemVer **2.4.0**, CONTEXT término Amiga Skin, lessons §6.0/§6.0e
- **NO hecho:** (superseded by Slices 2–6 wire)
- **Verificación aislamiento:** `git diff -- src/v25 v25` vacío; legado solo version-tag Navbar + MPA shared
- **Riesgos / preguntas mobile:** Topaz 16px en phone portrait — revisar visualmente; si ilegible, preguntar (no bajar de múltiplos de 8 a ciegas)
