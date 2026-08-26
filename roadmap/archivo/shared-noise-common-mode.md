# Roadmap — Shared noise: common-mode (token batch)

> **Archivado:** 2026-08-26  
> **Estado:** Parcial — Slice 1 (engine token-batch + split paint) en WIP local / rama `feat/shared-noise-common-mode`, **sin commit/merge**. Experimento UI: techo **100%** + input `%` editable (usabilidad rechazada). Slice 2 (mover control, gate ≥2 tokens, docs/PATCH) **no hecho**.  
> **Sucesor:** [`../shared-noise-coverage-knobs.md`](../shared-noise-coverage-knobs.md) · [`../PROMPT-shared-noise-coverage-knobs.md`](../PROMPT-shared-noise-coverage-knobs.md).  
> No editar salvo corrección histórica.

**Status:** Archived (partial)  
**Date:** 2026-08-26  
**Product:** VHectorLab 3D (`/` legacy UI only)  
**Prompt companion (archived):** [`PROMPT-shared-noise-common-mode.md`](./PROMPT-shared-noise-common-mode.md)  
**Version on ship:** was **PATCH** `2.4.2` → `2.4.3` — continue in successor.

> **Goal (one sentence):** Shared noise hides dimensions that fire with the **same sign and similar value across all tokens in the current Compare batch**, via the existing On/Off + Similarity slider (most-alike first, then more), so what remains is what actually differentiates tokens — groups stay a **reading** aid, not the metric.

---

## 0. Locked product decisions (do not re-litigate)

| ID | Decision |
| :--- | :--- |
| D1 | **Question the control answers:** “On this dim, do **all tokens in view** look the same (sign + magnitude)?” Not “do two **group means** agree?” |
| D2 | **Unit of analysis:** every Compare item with an embedding of equal width. `groupId` is **ignored** for this metric. 1 group, 3 groups, or no groups: same math. |
| D3 | **Metric per dim:** `min` and `max` of the raw values on that dim (current `item.embedding`, RAW or SAE — whatever is visualized). Similarity = existing `sharedNoiseSimilarity(min, max)` = `1 − \|max−min\| / (\|max\|+\|min\|)`; both exact zeros → `1`. Mixed signs → similarity ~0 → never cancels. |
| D4 | **Why min/max, not means:** one outlier token **blocks** early hide. Matches “menos → más” and avoids another layer of averaging. Do **not** use group centroids, std, or pairwise-min unless a later epic says so. |
| D5 | **Slider:** reuse `sameSignCancelCoverage` + `cancelAmountFromMetric` (Zero-coverage style). Low coverage → only near-`1` similarity goes black. Higher coverage → progressively less-similar same-sign dims. Default coverage **30%**. Toggle default **OFF**. Persist keys **unchanged** (`vl3d.viz.sameSignCancel*`). |
| D6 | **Paint only:** lerp toward zero color; **Y / geometry / dim count / X order unchanged**. Do **not** drop or collapse columns. Dim ruler, hover raw activation, dim-sort: untouched. |
| D7 | **Keep the label `Shared noise`** + slider label `Similarity`. Update `fieldInfo` tips (EN, ≤28 chars preferred). |
| D8 | **UI placement:** move the Shared noise block **out of Group contrast**, immediately **after Zero coverage**. Group contrast keeps **Sign conflict** + **Group hue** only. Shared noise is a sibling of Zero coverage (common-mode), not a group tool. |
| D9 | **Gate:** Compare workspace + **≥2 tokens with embeddings**. Independent of `GROUP_*`. Sign conflict / Group hue stay **≥2 groups**. `<2` tokens → Shared noise disabled/gray (hint: requires ≥2 compare tokens). |
| D10 | **Sign conflict stays G1↔G2** (first two distinct `groupId`s, group means). Out of scope to N-group it. Cancel (shared noise) and highlight (conflict) still layer: highlight first, then blacken (`applyGroupDimPaint` order). |
| D11 | **Surfaces:** ANALYSIS + NAVIGATION, POINTS + RIBBONS, wherever per-dim paint already runs. **Galaxy no-op** (1 point/token, no dim columns). **Arithmetic out of scope.** |
| D12 | **Out of scope:** per-thread/per-group cancel; “within-group shared” second slider; pair picker; collapsing X; backend/API; SAE train changes; `src/v25/**` (retired). |
| D13 | Serial slices; APPROVAL GATE per slice; no push/merge without explicit human OK (`git-workflow.md` §3). |

---

## 1. Problem / why the current control is the wrong instrument

**Hypothesis (product):** inside a given model, some dimensions are excited almost the same **whichever token** you pick — a common-mode / anisotropy offset. Hiding those first reveals what differentiates tokens, then (with group layout + Group hue) semantic patterns inside `GROUP_*`.

**Today:** Shared noise compares **mean(G1) vs mean(G2)** on the first two `groupId`s (`computeDimRelationMetrics`). That asks a different question.

| Case | User wants | Today (G1↔G2 means) |
| :--- | :--- | :--- |
| 1 group, 20 tokens, dim always `+0.8` | Hide | Control **off** (needs ≥2 groups) |
| 3 groups; G3 is the outlier on that dim | **Keep** (not shared by all tokens) | May **hide** (only G1 vs G2) |
| Group means match; tokens inside vary a lot | **Keep** | **Hides** |
| All tokens in the batch ~equal, any group count | Hide | Only if the first two group means match |

Groups remain useful for **reading** (Y stack, badges, Group hue, dim-sort). They must not **define** this hide.

---

## 2. Related code seams

| Area | Path |
| :--- | :--- |
| Metric + paint | `src/visualizer/groupDimContrast.js` (`sharedNoiseSimilarity`, `cancelAmountFromMetric`, `computeDimRelationMetrics`, `paintWeightsForDim`, `applyGroupDimPaint`, `buildPointGroupPaintAttributes`) |
| Mount | `src/visualizer/Instancer.js` (`groupDimMetrics`) |
| Base then layers | `src/visualizer/groupHuePaint.js`, `src/visualizer/MeshFactory.js`, `src/visualizer/DivergentShading.js` (`aCancel` / `aHighlight`) |
| UI / persist | `src/ui/VisualizationControls.js` (`#viz-group-contrast`, `setGroupContrastControlsEnabled`, `syncGroupFxSliderEnabled`), `visualizationControlsDefaults.js`, `fieldInfo.js` |
| Gate from app | `src/main.js` `syncGroupContrastGate` |
| Tests | `tests/groupDimContrast.test.js`, `tests/visualizationControls.test.js` |
| Docs | `CONTEXT.md` (Shared Noise Similarity, Group Contrast), `CHANGELOG.md`, `.agents/skills/dev-protocol/lessons-learned.md` §4.11b |
| Lessons also | §2 z-score/tanh (paint uses **raw embedding values** for this metric, not normalized `t`); §4.8 groups; §7 SemVer |

---

## 3. UX / behavior

### 3.1 Panel (Slice 2)

Visualization HUD, after Zero coverage, **before** Group contrast:

```
[ ] Zero coverage    (i)
    Coverage:  [====]

[ ] Shared noise     (i)     ← moved here; gate ≥2 tokens
    Similarity: [====]       ← 30% … 99.9999%, same slider mapping

Group contrast               ← still ≥2 groups
    Requires ≥2 compare groups.
    [ ] Sign conflict …
    [ ] Group hue …
```

- Shared noise OFF → slider gray (existing inert pattern).
- ON + ≥2 tokens → slider live; paint updates on the current batch (including after SAE toggle / reorder as long as `items[].embedding` is what the viewer uses).
- Copy (agent may trim to `MAX_FIELD_INFO_LEN`):

| Field | Tip (EN) |
| :--- | :--- |
| Shared noise | `Hide dims all tokens share.` |
| Similarity | `30%…99.9999% how alike.` |
| Group contrast | drop “G1↔G2” if it still implies Shared noise lives there — e.g. `Groups only (conflict / hue).` |

### 3.2 Paint math (Slice 1)

Per dim `d`, values `x_i = items[i].embedding[d]` (all items with a vector; skip empty):

```
lo, hi = min(x), max(x)
sim    = sharedNoiseSimilarity(lo, hi)
same   = signedUnit(lo) === signedUnit(hi)   // 0 counts as +

if Shared noise ON and same:
  cancel = cancelAmountFromMetric(sim, highCoverageToUnit(coverage))
else:
  cancel from this layer = 0
```

Then existing Sign conflict weights from **group-mean** metrics (if ≥2 groups and that toggle ON).

`paintWeightsForDim` must take **two** optional metric objects (token-batch vs G1↔G2). Do not stuff token min/max into `meanA`/`meanB` — that would silently retarget Sign conflict.

### 3.3 Worked examples (tests must lock these)

Batch of 3 tokens, one dim:

| Values | sim (approx) | Coverage 30% | Coverage 90% |
| :--- | ---: | :--- | :--- |
| `+0.80, +0.80, +0.81` | ~0.99 | black | black |
| `0, 0, 0` | 1 | black | black |
| `+0.10, +0.50, +0.90` | 0.2 | **visible** | some cancel (floor=0.1) |
| `+0.90, +0.90, −0.70` | ~0 | **visible** | **visible** |
| two tokens `+0.8`, third `+0.1` | lower sim | stays longer | eaten later |

3 groups: happy/sad `+0.80`, angry `−0.90` on that dim → **not** shared noise (angry breaks unanimity). Today it can blacken if happy & sad are the first two groups.

---

## 4. Persistence / settings

No new keys. Reuse:

| Key | Default | Notes |
| :--- | :--- | :--- |
| `sameSignCancelEnabled` | `false` | Same toggle |
| `sameSignCancelCoverage` | `30` | Same high-coverage range |

Reset viz: OFF + 30%, same as now.

---

## 5. Tests

| Area | Assert |
| :--- | :--- |
| Formula | `sharedNoiseSimilarity` unchanged (existing cases) |
| Token batch | ≥2 equal-width embeddings → per-dim min/max sim; `<2` or mismatched width → `[]` |
| Ignores groups | 1 `groupId` still computes; 3 groups uses **all** tokens, not first two means |
| Mixed signs | `allSameSign` false; cancel 0 even at high coverage |
| Paint | `sameSignCancelEnabled` uses **token** metric; `oppositeHighlightEnabled` still uses **group-mean** metric |
| Gate UI | `<2` tokens: Shared noise disabled; ≥2 tokens no groups: Shared noise usable; Sign conflict still needs ≥2 groups |
| Regression | `computeDimRelationMetrics` still G1 vs G2 means (Sign conflict tests stay green) |

`npm test`. No Python change expected (`uv run pytest` only if something backend-side was touched — it must not be).

---

## 6. Slices

| Slice | Scope | DoD (summary) |
| ---: | :--- | :--- |
| **1** | Engine: token-batch metric + split paint | New helper(s) + TDD; Instancer/RIBBONS/POINTS cancel uses token sim; Sign conflict still G1↔G2; `npm test` green; APPROVAL GATE |
| **2** | UI + gate + docs | Block after Zero coverage; ≥2-token gate; copy; CONTEXT/CHANGELOG/lessons §4.11b; SemVer bump on ship; smoke §8; APPROVAL GATE → wait for OK → git delivery |

Do **not** start Slice 2 until Slice 1 is approved (paint is testable in Compare with Shared noise already ON and ≥2 groups).

---

## 7. Implementation notes (deep module)

- Prefer extending `groupDimContrast.js` (already the paint seam) over a new file unless the file splits naturally (`tokenSharedNoise.js` exporting `hasEnoughTokensForSharedNoise`, `computeTokenSharedNoiseMetrics`). Deletion test: callers should not re-derive min/max.
- `hasGroupsForDimContrast` stays **groups ≥2** for Sign conflict / Group hue / `syncGroupContrastGate`. Add a **separate** token gate; do not overload the group boolean.
- `syncGroupContrastGate` in `main.js` must also pass token-count into viz enable (or a sibling `syncSharedNoiseGate`).
- Metric input = **visualized** vectors (`rawCompareData` vs SAE-replaced items — follow whatever Instancer already uses for paint, not a second source).
- z-score/tanh is for **color `t`**, not for this similarity. Mixing them would hide “normalized zeros”, not common-mode.

---

## 8. Smoke (manual)

1. Backend + frontend (`./setup.sh` opción 1 or usual dev).
2. COMPARE, **no** `GROUP_*`, ≥2 words → Visualization: Shared noise usable; Group contrast still gray.
3. ON, Similarity ~30%: dims that are a flat band across tokens go black; mixed-sign dims stay colored. Y height unchanged.
4. Slide Similarity up: more same-sign dims darken; distinctive dims remain.
5. Add 3 `GROUP_*`. Pick a dim where G1≈G2 but G3 opposite: **must stay visible**. Enable Sign conflict: opposite G1↔G2 still highlights. Group hue still independent.
6. Clean/Denoise ON (if SAE trained): still token-batch on SAE activations; no crash.
7. Galaxy: no new per-dim black columns (unchanged). ANALYSIS POINTS/RIBBONS both show cancel.
8. Reload: Shared noise OFF by default; persisted coverage restores when turned ON.

---

## 9. Doc-sync (conditional)

| Asset | Update? |
| :--- | :--- |
| `CONTEXT.md` | **Yes** — Shared Noise Similarity = token min/max; Group Contrast no longer owns Shared noise |
| `CHANGELOG.md` | **Yes** — Changed: Shared noise is common-mode across tokens |
| `lessons-learned.md` | **Yes** — §4.11b: metric is token batch, not G1↔G2; gate ≥2 tokens; UI sits with Zero coverage |
| `manifest.json` / `package.json` / Navbar / FastAPI version | **Yes on ship** (PATCH 2.4.3 unless human says MINOR) |
| `architecture_spec.md` / `README.md` | No (no API / setup change) |

---

## 10. Out of scope / later epics (do not sneak in)

- Second control: “within this group, hide what the group shares.”
- N-way Sign conflict / pair picker.
- Dropping dims from X / PCA / extra backend stats.
- Measuring “the whole model” beyond the current Compare batch (batch = the approximation; more diverse textarea → closer to model-level common-mode).
