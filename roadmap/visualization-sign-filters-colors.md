# Roadmap — Visualization Filters & Color Anchors (Sign / Polarity Controls)

**Status:** Ready for implementation handoff  
**Date:** 2026-08-02  
**Product:** VectorLab 3D (`lsv2`)  
**Prompt companion:** [`PROMPT-visualization-controls.md`](./PROMPT-visualization-controls.md)

> **Do not re-ask closed decisions** below. If something truly new appears, list once and ask; otherwise implement.

---

## 0. Goal (one sentence)

Add a second glass panel under **3D Spatial Controls** (right dock) that lets the user (1) filter the 3D viz to **All / positives only / negatives only**, and (2) **replace** the divergent colormap with three user-editable hex anchors for **+1**, **−1**, and **0**, globally, with persistence and reset.

---

## 0.1. Closed decisions (authoritative)

| ID | Topic | Decision |
| :--- | :--- | :--- |
| **V1** | Placement | New panel **below** existing “3D Spatial Controls” in the **right dock**, same glass / section-card style. |
| **V2** | Modes | Visible and effective in **ARITHMETIC and COMPARE** (all workspace modes). |
| **V3** | Render modes | Applies to **POINTS and RIBBONS** only (MESH already retired). |
| **F1** | Sign / zero | Positive: raw or display activation `> 0`. Negative: `< 0`. Near-zero: `abs(v) < ε` with **ε = 0.01** (align with existing `|t| < 0.01` short-circuit in `DivergentShading`). Treat near-zero as **neutral / zero** for filter + color anchor `0`. |
| **F2** | What “only + / only −” hides | **+ only:** hide negative **and** near-zero. **− only:** hide positive **and** near-zero. |
| **F3** | Filter UI | **Radio / segmented control:** `All` \| `+ only` \| `− only`. Exactly one active. Default: `All`. |
| **F4** | Geometry filtered | **Filter all drawn geometry** for POINTS and RIBBONS: point cloud **and** continuity lines / wide ribbons (omit vertices or break strips so filtered signs disappear). Not “points-only”. |
| **C1** | Colormap | User colors **replace** the built-in dual ramp (no fixed mid Orange/Blue stops as product truth). Interpolation: **lerp between 0↔+1 and 0↔−1** using the three anchors. Alpha/opacity curve may stay similar to today (pow on \|t\|) unless tests force a tweak — document if changed. |
| **C2** | Color inputs | **Free hex** (`#RRGGBB`), with validation; invalid → ignore / revert to last good. Optional native `<input type="color">` synced to hex text is OK if it stays deep/simple. |
| **C3** | Default colors | Match **current** palette endpoints / zero: see §0.2. |
| **C4** | Persistence | Persist filter mode + three hex colors in **`localStorage`**. |
| **D1** | Context | **Global** — not per MODE\|VIEW\|RENDER. Same values everywhere. |
| **D2** | Reset | Yes — explicit **Reset** control (and/or dblclick on a control restoring that field’s default, consistent with spatial sliders lesson §4.5). Reset restores filter=`All` + default hex trio. |
| **X1** | Backend | **No API/backend changes** unless a later discovery forces it (should not). |
| **X2** | Named presets / export | **Out of scope** for v1. |

### 0.2. Default color anchors (from current ramp)

Documented in `src/visualizer/DivergentShading.js` / lessons §2.2:

| Anchor | Meaning | Default hex (approx from current ramp) | Notes |
| :--- | :--- | :--- | :--- |
| **+1** | Strong positive | `#FFE600` | Incandescent yellow at +1.00 |
| **−1** | Strong negative | `#9900E6` | Neon violet at −1.00 |
| **0** | Near-zero / neutral | `#000000` | Black at 0 (today also very low alpha ~0.05) |

Mid stops (+0.5 orange `#FF8000`, −0.5 electric blue `#0040FF`) are **not** user controls in v1; they disappear as fixed brand stops once anchors replace the ramp (C1). Intermediate t values = linear RGB lerp in normalized t-space after z-score/tanh (same normalization pipeline as today).

---

## 1. Product copy (English-only UI — §4.7)

Suggested labels (adjust only if glossary conflicts; keep EN):

| UI | Copy |
| :--- | :--- |
| Panel title | `Visualization` or `Sign & Color` (pick one; prefer **`Visualization`**) |
| Filter group | `Show:` |
| Radio | `All` / `+ Only` / `− Only` |
| Color section | `Colors` |
| Fields | `+1` / `0` / `−1` (or `Positive (+1)` / `Zero (0)` / `Negative (−1)`) |
| Reset | `Reset` |
| Hex placeholders | `#FFE600`, `#000000`, `#9900E6` |

Internal keys (examples — agent may rename for clarity but keep stable once chosen):

- `vizFilterMode`: `'all' | 'positive' | 'negative'`
- `colorPositive`, `colorZero`, `colorNegative` (hex strings)
- `localStorage` key prefix e.g. `vl3d.viz.` (`vl3d.viz.filter`, `vl3d.viz.colorPositive`, …)

---

## 2. UX / layout

```
Right dock body (top → bottom):
  [ 3D Spatial Controls ]     ← existing ThreadSliders
  [ Visualization ]           ← NEW section-card
      Show:  ( All | + Only | − Only )
      Colors:
        +1  [#______] [swatch/color]
         0  [#______] [swatch/color]
        −1  [#______] [swatch/color]
      [ Reset ]
  [ AxisGizmo ]
```

- Same CSS patterns as `#thread-sliders-container` / `.section-card` / `.slider-group`.
- Mobile: lives in right dock (already collapses); no extra landscape rules.
- Changing filter or color → **live update** of 3D (reuse current `refreshRender` / in-situ buffer update patterns; prefer mutating colors/visibility without full scene teardown when possible).

---

## 3. Technical design (recommended seams)

### 3.1. Deep modules (preferred)

| Module | Responsibility |
| :--- | :--- |
| `src/ui/visualizationControlsDefaults.js` | Defaults, `localStorage` read/write, validate hex, `resolveVisualizationSettings()` |
| `src/ui/VisualizationControls.js` | Markup + wire events → mutate settings + `onChange` callback |
| `src/visualizer/DivergentShading.js` (extend) | Accept optional color anchors; `getDivergentColor(val, absMax, anchors?)`; shader uniforms for POINTS material if colors are GPU-side |
| Filter helper (pure) | `shouldShowActivation(v, mode, eps=0.01)` + `filterPointsData` / ribbon vertex mask — **unit-tested** |

### 3.2. Data flow

1. App loads → read `localStorage` → merge with defaults → hold `vizConfig` on `VectorLabApp` (or small store beside `sliderConfig`).
2. Mount `VisualizationControls` under sliders in right dock (`main.js` / same place as `mountThreadSlidersUI`).
3. On change → persist → `refreshRender()` (and/or update materials/geometries in place).
4. `Instancer` / `MeshFactory` / `ThreadFactory` receive `vizConfig` (or read from a single getter) when building POINTS lines/points and RIBBONS.

### 3.3. Filter semantics (F4A)

- **POINTS:** Drop points that fail the filter from the Points cloud; rebuild or rewrite buffers. Continuity `Line` (`createRibbonMesh`): only include consecutive segments where endpoints pass (or drop vertices that fail — avoid leaving misleading bridges across hidden signs). Prefer **omit failing vertices** and break the line into multiple `Line` segments / or use discontinuous indices — pick simplest robust approach; document in lessons.
- **RIBBONS (`createWideRibbonMesh`):** Same activation array — skip or split strips so hidden signs are not drawn. Do **not** leave full ribbon colored only on one side while filter says “+ only”.
- **Filter input value:** Use the **same activation** used for coloring after the project’s normalization choice. Clarify in impl: filter on **raw embedding dim value** vs **z-score/tanh normalized t**.  
  **Recommendation (lock unless blocked):** filter on **normalized t** (post `calculateZScoreNormalized`), so ε=0.01 matches the shader short-circuit and “zero color” band. State this explicitly in code comments + tests.

### 3.4. Color replacement (C1)

- `getDivergentColor` / GLSL fragment path must use anchors:
  - `t >= 0`: lerp(`colorZero`, `colorPositive`, t)  (with near-zero short-circuit → `colorZero` + low alpha)
  - `t < 0`: lerp(`colorZero`, `colorNegative`, -t)
- Remove dependency on hard-coded orange/blue mid stops when custom anchors are active (always, in v1 — anchors always drive the ramp).
- POINTS `ShaderMaterial`: today embeds ramp in GLSL — **must** gain uniforms (or CPU attribute colors) so live hex edits update without shader string rebuild every frame. Prefer **uniforms** `uColorPos`, `uColorNeg`, `uColorZero`.
- CPU paths (`getDivergentColor` for lines/ribbons vertex colors) must share the **same** math as GPU (pure function + tests).

### 3.5. Persistence

- On load: invalid hex → fallback to default for that key.
- On Reset: write defaults back to `localStorage`.
- Do not key by MODE/VIEW/RENDER (D1).

### 3.6. Versioning

- Capability add → **MINOR** bump per lessons-learned **§7** (e.g. `1.7.0` → `1.8.0` if `1.7.0` already shipped with groups; check `manifest.json` / Navbar at start of work).
- Sync `manifest.json`, `package.json`, Navbar `version-tag`, `CHANGELOG` section.
- No build numbers as product version (§7.3).

---

## 4. Files likely touched

| Area | Paths |
| :--- | :--- |
| UI | `src/ui/VisualizationControls.js` (new), `src/ui/visualizationControlsDefaults.js` (new), `src/style.css`, `src/main.js` |
| Shading | `src/visualizer/DivergentShading.js`, `src/visualizer/MeshFactory.js`, possibly `ThreadFactory.js` |
| Render | `src/visualizer/Instancer.js` (pass vizConfig into mount paths) |
| State (optional) | `src/core/State.js` only if you want viz settings in AppState — **not required**; local app field + localStorage is enough |
| Tests | `tests/visualizationControls*.test.js`, extend `tests/DivergentShading.test.js`, ribbon/points filter tests |
| Docs | `CHANGELOG.md`, `CONTEXT.md` (new terms), `lessons-learned.md` short § |

**Do not touch:** `roadmap/archivo/**`, backend (X1), unrelated roadmaps.

---

## 5. CONTEXT glossary terms to add

- **Visualization Controls:** Right-dock panel for sign filter + divergent color anchors.
- **Sign Filter:** Global show mode `all | positive | negative` over normalized activations.
- **Color Anchor:** User hex for normalized activations at +1, 0, −1 replacing the fixed dual ramp.

---

## 6. Test plan (TDD where harness exists)

### Unit
- [ ] `shouldShowActivation` / filter helper: all / + / − × values `{1, 0.5, 0.005, -0.5, -1}`.
- [ ] Hex validate + persist round-trip (mock `localStorage`).
- [ ] `getDivergentColor` with custom anchors: t=1 → +1 hex; t=0 → 0 hex; t=-1 → −1 hex; t=0.5 → midpoint lerp.
- [ ] Defaults match §0.2.
- [ ] Reset restores defaults and `all`.

### Integration / visual smoke (manual)
- [ ] ARITHMETIC + COMPARE; POINTS + RIBBONS.
- [ ] `+ Only` / `− Only` visibly removes opposite and near-zero geometry on both render modes.
- [ ] Change +1 hex → peaks update live; reload page → hex + filter restored.
- [ ] Reset → back to yellow/black/violet + All.
- [ ] Spatial sliders + viz panel both usable in right dock; gizmo still below.

---

## 7. Acceptance criteria

- [ ] New panel under Spatial Controls; EN copy; global; POINTS+RIBBONS; Arithmetic+Compare.
- [ ] Segmented **All | + Only | − Only**; + hides − and |t|&lt;ε; − hides + and |t|&lt;ε.
- [ ] Filter affects points **and** lines/ribbons (F4A).
- [ ] Three hex anchors replace old mid-stop ramp; defaults §0.2; live update.
- [ ] `localStorage` persistence; Reset works.
- [ ] No backend changes; Vitest green; CHANGELOG + version MINOR; lesson note for filter-on-normalized-t + shader uniforms.
- [ ] Approval gate before push/merge (`dev-protocol`).

---

## 8. Out of scope / non-goals

- Per-context (MODE|VIEW|RENDER) viz presets.
- Named palettes / export / import.
- Filtering NAVIGATION vs ANALYSIS differently.
- Reintroducing MESH.
- Changing z-score/tanh pipeline itself (only consume its output).
- i18n framework.

---

## 9. Implementation stages (suggested)

| Stage | Branch sketch | Deliverable |
| :--- | :--- | :--- |
| **A** | `feat/viz-controls-settings` | Defaults module + localStorage + pure filter/color helpers + Vitest (no UI yet or stub UI). |
| **B** | same or `feat/viz-controls-ui` | Panel UI under sliders; wire onChange → refreshRender with CPU color path working. |
| **C** | same | Shader uniforms for POINTS; ribbon/line filter completeness; polish Reset; docs/version. |
| **Gate** | — | Human smoke → OK → merge to `main`. |

Agent may combine A–C in one branch if the diff stays reviewable.

---

## 10. Open residual (only if blocked)

None expected. If shader uniform vs CPU attribute tradeoff is ambiguous for POINTS, prefer **uniforms** and ask only if WebGL constraints break the approach.
