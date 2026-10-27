> **Archivado:** 2026-10-26 — prompt de ejecución de v4.1.1. Histórico. No re-ejecutar.

# Prompt — Workbench Window & UI Visual Unification (v4.1.1: Slices 2–4 End-to-End)

**Modo:** **Autónomo End-to-End** (Slices 2, 3 y 4 completos en una sola corrida).  
**Rama base:** `feat/v411-workbench-unification-slice1` (Slice 1 ya implementado en código de trabajo).  
**Destino:** Mantener en la rama feature, realizar commits por slice, **NO mergear a `main`**.

---

```text
Usando dev-protocol, completá la implementación END-TO-END de la versión 4.1.1 (Slices 2, 3 y 4).

## Contexto y Estado Inicial
- Repo: VHectorLab 3D / vhectorlab (Python/uv + Vite/vanilla Three.js + FastAPI).
- Rama actual: `feat/v411-workbench-unification-slice1`
- Slice 1 ya está implementado en el árbol de trabajo (amigaWindow.js, titlebars de los 4 paneles y tests pasando en 460/460).
- Roadmap canónico: `roadmap/v4.1.1-workbench-window-unification.md`
- Invariantes técnicas: `.agents/skills/dev-protocol/lessons-learned.md`

## Reglas de Ejecución y Autonomía
1. Tenés autonomía total para tomar decisiones de diseño e implementación dentro de las restricciones del roadmap (Amiga Workbench 3.0 / MagicWB AGA 1993, 8-pen palette, tipografía TopazNew, biseles 3D reales).
2. AISLAMIENTO: CERO mutación de matemática de embeddings, SentenceTransformers, SAE, proyección UMAP ni shaders de WebGL. CERO reintroducción de glassmorphism contemporáneo.
3. COMMITS: Commiteá cada slice de forma individual con mensajes convencionales claros en la rama `feat/v411-workbench-unification-slice1`:
   - Commit Slice 1: `feat(ui): add the Workbench window chassis to the four floating panels`
   - Commit Slice 2: `feat(ui): implement retro 3D checkboxes, Workbench sliders and action buttons`
   - Commit Slice 3: `feat(ui): unify field-info tips and Intuition EasyRequest modal dialog`
   - Commit Slice 4: `feat(ui): add retro scrollbars, standardize dock tabs and bump to v4.1.1`
4. NO MERGEAR A `main`: Todo el trabajo debe quedar en la rama feature para la auditoría final del Principal Architect.
5. CALIDAD Y SUITE VERDE: Al finalizar cada slice, `npm test` DEBE estar 100% en verde sin romper tests preexistentes. Al cierre, `uv run --directory backend pytest` debe dar 153/153 en verde.

---

## Fases de Implementación a Ejecutar:

### Paso 0: Commitear Slice 1
Staging de los archivos ya modificados por Slice 1 (`src/ui/amigaWindow.js`, `src/theme/chrome.css`, `Sidebar.js`, `ComparePanel.js`, `ThreadSliders.js`, `VisualizationControls.js`, `tests/windowChrome.test.js`) y commit.

### Paso 1: Ejecutar Slice 2 — Form Controls Retro (Checkboxes, Sliders & Botones)
- En `src/theme/chrome.css`, estilizar `input[type="checkbox"]` con `appearance: none; -webkit-appearance: none;` para que sea una caja 16x16px con bisel 3D hundido (`border-top/left: 2px solid #1A1A1A; border-right/bottom: 2px solid #FFFFFF; background: rgba(0,0,0,0.5);`) y tilde `✓` en Peach (`#FFA997`) al estar `:checked`.
- En `src/theme/chrome.css`, rediseñar `input[type="range"]`: track hundido oscuro y thumb rectangular 3D con relieve físico (eliminando las cápsulas cyan).
- Homologar los botones de acción (`.btn-primary`, `.btn-preset`, `.compare-visualize-btn`, botones de export y reset) bajo la clase y física de `.amiga-gadget-btn` con traslación de 1px en `:active`.
- Crear o actualizar tests en Vitest (`tests/formControlsTheme.test.js`).
- Correr `npm test` y commitear Slice 2.

### Paso 2: Ejecutar Slice 3 — Popovers de Ayuda (fieldInfo) y Diálogo de Sistema (Modal)
- En `src/theme/chrome.css`, transformar `.field-info-btn` en un micro-gadget cuadrado (16x16px) con bisel 3D micro y texto "i" en TopazNew (adiós al botón circular 50%).
- Transformar `.field-info-tip` en una caja biselada 3D sólida (`background: #1A1A1A; border-top/left: 2px solid #FFFFFF; border-right/bottom: 2px solid #000000; box-shadow: 2px 2px 0 #000000;`) sin blur.
- En `CustomModal.js` y `chrome.css`, transformar el diálogo en un *Intuition EasyRequest* auténtico con doble marco biselado, barra azul y botones OK/Cancel biselados.
- Testear y verificar suite. Commitear Slice 3.

### Paso 3: Ejecutar Slice 4 — Pestañas de Dock, Scrollbars Retro, SemVer v4.1.1 y Docs
- En `src/theme/chrome.css`, implementar scrollbars retro con `scrollbar-color: #3D3D3D #1A1A1A;` y pseudo-elementos `::-webkit-scrollbar` con track hundido y thumb biselado.
- Homologar etiquetas de las pestañas de colapso de los docks y hojas:
  - Left Dock: `◀ ARITHMETIC` o `◀ COMPARE` según modo activo.
  - Right Dock: `SPATIAL ▶`.
  - Engine Manager: `▼ ENGINE`.
  - Visualization: `▼ VIZ`.
- Bump formal de versión a `4.1.1`:
  - `manifest.json`: `"version": "4.1.1"`.
  - `package.json`: `"version": "4.1.1"`.
  - `src/ui/Navbar.js`: `APP_VERSION = 'v4.1.1'`.
  - `CONTEXT.md`: Registrar la unificación de ventana Workbench.
  - `CHANGELOG.md`: Registrar entrada completa para v4.1.1.
- Correr `npm test` (frontend) y `uv run --directory backend pytest` (backend).
- Commitear Slice 4.

---

## Reporte Final Requerido
Al terminar, generá un reporte final estructurado y auditable que incluya:
1. Resumen de commits realizados en la rama (hashes y mensajes).
2. Mediciones reales en la app viva (`http://localhost:5173/`): dimensiones, selectores, comportamiento de checkboxes y sliders.
3. Resultados numéricos de las suites de prueba (`npm test` y `pytest`).
4. Lista de decisiones autónomas tomadas y trade-offs resueltos.
5. Confirmación explícita de que la rama `feat/v411-workbench-unification-slice1` está lista para la auditoría del Principal Architect y NO fue mergeada a `main`.
```
