# Roadmap — Galaxy feel + Group hue paint

**Status:** Plan (ready to implement)  
**Date:** 2026-08-08  
**Product:** VHectorLab 3D — **legacy UI only** (`/`, `src/main.js`). **Do not touch `src/v25/`.**  
**Prompt companion:** [`PROMPT-galaxy-feel-group-hue.md`](./PROMPT-galaxy-feel-group-hue.md)  
**Version on ship:** likely **PATCH** on `2.3.x` (feel + viz paint). Confirm with human + SemVer in `lessons-learned.md` §7. If Galaxy pipeline slices still WIP, land on current `main` line without inventing a new MINOR unless human says so.

> **Goal (one sentence):** Make **Galaxy** feel spacious and elegant (larger UMAP world + slower WASD/QE/mouse + soft glowing star points), and add a transversal **Group hue** paint mode under Visualization → Group contrast: each `GROUP_*` ramps **black (−1) → picked color (+1)**, default OFF, coexisting with existing color / Shared noise / Sign conflict controls.

---

## 0. Locked product decisions (do not re-litigate)

| ID | Decision |
| :--- | :--- |
| D1 | **Galaxy space:** enlarge UMAP world scale **and** slow translation (WASD/QE) **and** mouse look — **Galaxy VIEW only**. Leaving Galaxy restores prior flight feel. |
| D2 | Agent **calibrates** scale + speeds for an elegant, comfortable flight (not a dashboard of knobs in v1). No new Spatial sliders required unless existing `threadSpacing` / `thickness` already drive galaxy scale/size — then retune those mappings, don’t invent duplicate UI. |
| D3 | “Poca definición” = points **too close** + **square/pixelated**. Fix = more separation **in sync** with D1/D2 + **circular soft “stars”** that glow toward their paint color (not hard GL_POINTS squares). Prefer shader soft disc / glow over expensive InstancedMesh spheres. |
| D4 | Star look is **Galaxy POINTS only**. ANALYSIS / NAVIGATION keep current square/point path unless a shared soft-disc path is trivially reusable without regressing threads. |
| D5 | **Group hue** toggle lives **under Group contrast**, below existing Shared noise / Sign conflict blocks. Default **OFF**. |
| D6 | Group hue is **transversal**: applies to **COMPARE** paint everywhere groups exist (ANALYSIS / NAVIGATION / GALAXY, POINTS and RIBBONS where paint already uses viz config). Gated like other group contrast: needs ≥2 `GROUP_*` (reuse `hasGroupsForDimContrast` / same enable gate). |
| D7 | Ramp: **black at normalized −1 → group’s picked color at +1**. Midpoint \(t=0\) = lerp black↔groupColor (no separate zero swatch for this mode). Explicit **“i”** tip in EN, style of `fieldInfo.js`. |
| D8 | **One color picker + hex** per `GROUP_*` (same swatch/hex pattern as Colors / Hi). Dynamic rows when groups change. Sensible default palette for new groupIds. Persist map `groupId → hex` under `vl3d.viz.*` (or sibling key). |
| D9 | **Coexists** with global Colors (+1/0/−1), Zero coverage, Shared noise, Sign conflict: Group hue replaces **base** divergent anchors for the point/segment when ON; cancel/highlight layers still apply after. When OFF = today’s behavior. |
| D10 | Value driving \(t\): keep existing normalized activation path (z-score/tanh / intensity). Galaxy already uses `cosine_vs_first` as activation — keep that for Group hue in Galaxy. Do **not** invent a new backend field. |
| D11 | **No `src/v25/**`.** Verify `git diff -- src/v25` empty before merge. |
| D12 | Copy EN; tips via `infoTipMarkup` / `wireFieldInfo`. Soft cap ~28 chars preferred; **Group hue** tip may be longer (~60) so −1/black and +1/color stay explicit. |
| D13 | Serial slices; APPROVAL GATE per slice; no push/merge without human OK. |

---

## 1. Problem / gap

### 1.1 Galaxy feel

- UMAP coords are server-normalized (RMS≈1); `GALAXY_DEFAULT_SCALE = 48` + nav `moveSpeed ≈ 75` + mouse look `0.003` feel **too fast** and **cramped**.
- POINTS fragment path uses a **square** `gl_PointCoord` mask → pixelated “tiles”, worse when small/dense.

### 1.2 Group readability

- Global divergent ramp (+1/0/−1) is shared across all groups; domains don’t get a dedicated hue.
- User wants an optional mode: **one shade family per group**, black→color, to read clusters / threads faster — especially with Galaxy + multi-group Compare.

---

## 2. Related code seams

| Area | Path |
| :--- | :--- |
| Galaxy layout / scale | `src/visualizer/galaxyLayout.js` (`GALAXY_DEFAULT_SCALE`, `layoutGalaxyPoints`) |
| Galaxy mount | `src/visualizer/Instancer.js` `renderGalaxyData` (scale from `threadSpacing`, `pointSize`) |
| Flight | `src/engine/Navigation.js` (`moveSpeed`, `applyLookDelta`, turbo) |
| Galaxy enter/leave | `src/ui/galaxyChrome.js`, `src/main.js` view triad |
| POINTS shader | `src/visualizer/DivergentShading.js` (square edge today) |
| Mesh paint | `src/visualizer/MeshFactory.js`, `src/visualizer/groupDimContrast.js` |
| Viz UI / persist | `src/ui/VisualizationControls.js`, `visualizationControlsDefaults.js`, `fieldInfo.js` |
| Lessons | `.agents/skills/dev-protocol/lessons-learned.md` §3 (WASD lerp), §4.11b (group paint), §6.0d (v25 off-limits) |

---

## 3. UX / behavior

### 3.1 Galaxy flight profile (Slice 1)

On enter GALAXY:

1. Apply **Galaxy flight profile**: lower `moveSpeed`, slightly lower turbo if needed, lower mouse look sensitivity — still inertial `lerp` (§3.1 lessons).
2. On leave: restore **default** profile (current ANALYSIS/NAV numbers).

Calibration target (agent judgment, document final constants in PR/report):

- Comfortable WASD cruise across IT-core cloud in ~several seconds, not a blink.
- Mouse look not twitchy; still usable for orbiting a cluster.
- Feel **elegant**, not sluggish like a slideshow.

### 3.2 Galaxy world scale (Slice 1)

- Raise effective world scale so tokens are clearly separated at default camera framing (IT-core centroid fit still works).
- Keep scale tied to existing mapping if present (`threadSpacing * k` in `renderGalaxyData`) **or** raise `GALAXY_DEFAULT_SCALE` + multiplier together so Spatial thickness/spacing don’t fight the feel.
- Re-frame camera after scale change (existing galaxy camera helper).

### 3.3 Soft stars (Slice 2)

Galaxy POINTS material path:

- Circular soft disc (radial falloff), mild glow toward final fragment color.
- Raise `gl_PointSize` clamp ceiling if stars clip too small after scale change.
- `frustumCulled = false` invariant unchanged.
- Non-Galaxy POINTS: unchanged unless shared helper is opt-in (`galaxy: true` / flag on material).

### 3.4 Group hue UI (Slice 3)

Under `#viz-group-contrast`, **after** Sign conflict block:

```
[ ] Group hue   (i)
    GROUP_it_core  [swatch] [#hex]
    GROUP_1        [swatch] [#hex]
    GROUP_2        [swatch] [#hex]
    …dynamic…
```

- Toggle OFF → pickers disabled/gray (same pattern as Shared noise / Sign conflict).
- Toggle ON → pickers enabled; paint uses group ramp.
- Section still disabled entirely when &lt;2 groups.
- Reset viz: Group hue OFF + default palette (or clear persisted hues to defaults).

**Suggested tip copy (agent may trim):**

- Toggle: `Per group: black (−1) → color (+1).`
- Per-swatch: `This group’s +1 color.`

### 3.5 Paint math (Slice 3)

Pseudo:

```
base = groupHueEnabled && groupId
  ? lerp(black, groupColor[groupId], remapLikeDivergent(t))  // t in [-1,1]
  : getDivergentColor(t, anchors, zeroCoverage)
base = applyGroupDimPaint(base, metric, …)  // Shared noise / Sign conflict unchanged
```

- Missing `groupId` → fall back to divergent anchors.
- Unknown groupId with hue ON → assign next default palette color and persist.
- RIBBONS / wide ribbons: same base replacement wherever `colorForActivation` / equiv runs.

---

## 4. Persistence

Extend `VisualizationSettings` (+ storage keys):

| Key | Default |
| :--- | :--- |
| `groupHueEnabled` | `false` |
| `groupHueColors` | `{}` map `groupId → #RRGGBB` |

Default palette (example — agent may refine, keep high contrast): e.g. cyan / amber / magenta / lime cycling by stable sort of groupIds.

---

## 5. Tests

| Area | Assert |
| :--- | :--- |
| Flight profile | Enter Galaxy applies slower speeds; leave restores; pure helper unit-testable |
| Scale | `layoutGalaxyPoints` / mount scale increases vs prior constant; finite positions |
| Stars | Shader/helper: circular mask path selected for galaxy flag (unit or snapshot of GLSL define/flag) |
| Group hue | OFF = divergent; ON = black at −1 / group hex at +1; missing group → fallback; persist round-trip |
| Gate | &lt;2 groups → section disabled; ≥2 → Group hue toggle usable |
| v25 | no files under `src/v25/` in diff |

`npm test` + `uv run pytest` if backend untouched (expect no py changes).

---

## 6. Slices

| Slice | Scope | DoD (summary) |
| ---: | :--- | :--- |
| **1** | Galaxy scale + flight profile | Larger world; slower WASD/QE/mouse in Galaxy only; camera still frames IT core; tests for profile apply/restore; APPROVAL GATE |
| **2** | Soft star POINTS in Galaxy | Circular glowing stars; size in sync with Slice 1; non-Galaxy unchanged; APPROVAL GATE |
| **3** | Group hue paint + UI | Toggle + per-group pickers; transversal paint; coexist with cancel/highlight; persist; tips; tests; APPROVAL GATE |
| **4** | Polish / docs | `CHANGELOG`, `CONTEXT` terms if needed, `lessons-learned` (Galaxy flight profile; star disc; group hue base ramp); smoke; `git diff -- src/v25` empty; SemVer confirm; APPROVAL GATE → delivery |

---

## 7. Smoke (manual)

1. Open Compare bootstrap (IT core + G1 + G2) → GALAXY → Visualize.
2. WASD/QE/mouse: comfortable, not twitchy; cloud readable, not a dust ball.
3. Points look like soft glowing stars (round), not squares.
4. Visualization → Group contrast → enable **Group hue**; set distinct colors; ANALYSIS + Galaxy both show per-group ramps; Shared noise / Sign conflict still do something when ON.
5. Leave Galaxy → flight speed back to normal; ANALYSIS points not forced into star shader.
6. Reload: Group hue OFF by default; if user had colors saved, map restores when toggled ON.

---

## 8. Out of scope

- PCA / t-SNE / real K-means
- 2D Galaxy submode
- New Spatial sliders solely for galaxy speed
- True mesh spheres / bloom post-process stack
- Changing `/project` UMAP math
- v25 / amiga

---

## 9. Risks

| Risk | Mitigation |
| :--- | :--- |
| Scale↑ without speed↓ still feels wrong | Ship both in Slice 1; calibrate together |
| Soft disc breaks reorder / attributes | Keep same buffers; only fragment mask + optional size clamp |
| Dynamic pickers fight collapsed viz panel | Rebuild rows on group gate sync (`syncGroupContrastGate`) |
| Group hue + Zero coverage interaction | When hue ON, zero-coverage remap may still apply to \|t\| before lerp black↔color — document choice in lessons; prefer **apply remap then lerp black↔groupColor** for consistency |

---

## 10. Documentation sync (Slice 4)

- `CHANGELOG.md` (EN)
- `CONTEXT.md` — Galaxy flight feel; Group hue
- `lessons-learned.md` — constants + paint layering invariant
- `architecture_spec.md` — only if public API changes (expect **no**)
