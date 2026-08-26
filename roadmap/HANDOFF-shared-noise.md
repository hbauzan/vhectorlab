# Handoff — Shared noise / Zero coverage (2026-08-26)

Pegá esto en el chatbot nuevo. Pedile que lea también:

- `.agents/Por acá va la bocha.md` (estilo)
- `roadmap/shared-noise-omit-common.md` (fuente de verdad del acuerdo, draft)
- `current-research/DISCOVERY-shared-noise-embedding-geometry.md` (evidencia Arctic@256 vs mpnet@768 — knob “muerto” ≠ wiring roto)
- `.agents/skills/dev-protocol/lessons-learned.md` §8.9
- **No implementar** hasta que el humano lo pida explícito.

Repo: `vhectorlab`. Branch de trabajo al corte: `main` @ producto **3.0.0**. UI: COMPARE / ANALYSIS / POINTS, chrome Workbench.

---

## Qué se pidió al inicio

Auditar commits recientes de **Zero coverage** y **Shared noise**. Sospecha de regresión. Ser crítico: podía ser percepción.

## Qué hay en `main` (hechos)

Línea shipped:

1. **8 ago `af73265`:** Shared noise = medias **G1↔G2**. Zero coverage On/Off + piso 30%.
2. **26 ago `3564719` / 2.4.3:** Shared noise = **min/max de todos los tokens** (`groupId` ignorado). Techo coverage **100%**. Paint hacia negro. Un outlier **veta** toda la dim (D4).
3. **Knobs A/mA + 3.0.0:** misma matemática; drag DAW; mA 5 decimales. No toca el motor de contraste.

Tests verdes al auditar: `groupDimContrast` / `coverageAmKnobs` / `visualizationControls`.

**No está en `main`:** rama `feat/shared-noise-per-word` (`d47e370`, `258361d`) — agujeros per-word sobre `t` normalizado. Nunca mergeó.

**2.4.3 no es un bug de merge.** Es un retarget. En el bootstrap Compare (~3 grupos, muchos tokens) min/max casi no dispara → el knob “no hace nada”. Zero coverage 30% sí se ve (low-cut sobre `|t|`). Las dos fórmulas se llaman Coverage/Similarity pero **no miden lo mismo**.

Paint-only: el palito **sigue ondulando**. El humano después dijo que eso **no** sale de la visión.

Captura típica del síntoma: COMPARE + ANALYSIS + POINTS, **SAE ON**, n≈230, Zero coverage ~61%, Shared noise Similarity ~77%, franjas **amarillas** cruzando grupos. Eso es z-score de features SAE compartidas y grandes, no “Shared noise roto en el shader”.

---

## Hipótesis de producto (texto original del humano)

Dentro de cada modelo hay dims con valores muy parecidos **cualquier token**. ON/OFF + control (antes slide, ahora **knobs**): ir de **menos a más** — primero ocultar número y signo más parecidos, después más, hasta que queden las dims que diferencian tokens. Después, leer patrones semánticos **dentro de grupos**. Grupos = lectura, no la métrica.

**Vocabulario:** **ruido** = lo **compartido** (el pack). El humano se corrigió: no llamar ruido a lo distintivo.

Cada token = un thread. Cada punto = float de esa dim. Y = valor. Color = rampa +1 amarillo / 0 negro / −1 violeta.

---

## Decisiones cerradas (no reabrir)

| ID | Qué |
| :--- | :--- |
| L1 | Unidad = **punto** (token × dim). No borrar la columna entera. `groupId` no decide el hide. |
| L2 | **229 iguales + 1 distinto:** ese **1 queda**. El pack se oculta con el knob. |
| L3 | Pack: **fuera de la visión** (geometría, no solo paint). X **no** se compacta. El punto distinto **conserva** Y y color. |
| L4 | Gradual milimétrico: umbral de “parecido” sobre el **float nativo** visualizado (float32 / lo que dé el modelo). No ε de colormap `0.01`. No un % grosero que tire dígitos. |
| L5 | UI: **Shared noise** / **Similarity**. OFF = no oculta. |
| L6 | **Zero coverage** = colormap (banda del 0). Otro control. |
| L7 | Sign conflict / Group hue = lectura. |
| L8 | **SAE Top‑K de este lab es la capa equivocada** para esta cacería. Primera lectura en **RAW**, SAE OFF. No “arreglar” entrenando más el SAE. |

**Anulado (draft intermedio):** omitir la **columna completa** para todos los tokens. Eso mataba al único punto de interés.

**Cercano en código, no es copy-paste:** `feat/shared-noise-per-word` (stick `t`, agujeros duros). Acá: float nativo + hide gradual del pack.

---

## SAE (para no mezclar instrumentos)

Lab SAE = diccionario entrenado en el **batch actual** + Top‑K **más grandes** por token para **reconstruir**. No es “mostrá lo único vs el resto”. Lo común y grande sobrevive. Lo único y chico el K lo tira. Las franjas amarillas = diccionario útil, no wiring roto.

Cazar “este float32 difiere en dim k” → embedding **RAW**. Un SAE tipo IDF / penalizar latents frecuentes sería **otro epic**.

---

## Abierto

**Dos packs sin un “uno”:** 50 tokens a `+0.8` y 50 a `−0.7`. Si “se parece a alguien → se oculta”, **los dos bloques se van** y no ves el concepto de grupo. Si el humano todavía quiere ver bloques de grupo, hace falta otra regla (Keep / solo sacar la pared global). **No cerrado.** El caso 229+1 **sí**.

Opcional a confirmar: primer demo = COMPARE + RAW + SAE OFF.

---

## Qué no hacer

- No implementar todavía.
- No volver Shared noise a medias G1↔G2.
- No “arreglar” con más precisión de knobs A/mA solos (3.0.0): no ocultan geometría del pack.
- No compactar X.
- No tratar Zero coverage y Shared noise como el mismo gesto.

---

## Archivos

| Path | Rol |
| :--- | :--- |
| `roadmap/shared-noise-omit-common.md` | Acuerdo vivo |
| `roadmap/open-shared-noise-knob.md` | Parking knob-feel; superseded |
| `roadmap/archivo/shared-noise-coverage-knobs.md` | 2.4.3 paint + token-batch |
| `src/visualizer/groupDimContrast.js` | Métrica/paint actuales |
| `src/ui/coverageAmKnobs.js` | Knobs A/mA |
| `src/ui/visualizationControlsDefaults.js` | Zero coverage remap, persist `vl3d.viz.*` |

---

## Estado de la conversación

Hablando. Roadmap actualizado. El humano puede seguir en otro chat desde este handoff + `shared-noise-omit-common.md`. Siguiente útil: cerrar el caso dos packs, o pedir implementación (dev-protocol, rama, TDD) **después** de OK explícito.
