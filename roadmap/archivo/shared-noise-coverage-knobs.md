# Roadmap — Shared noise ship + coverage A/mA knobs

> **Archivado:** 2026-08-26  
> **Estado:** Shipped **2.4.3** — token-batch Shared noise + A/mA knobs + placement/gate/docs.  
> **Predecessor:** [`shared-noise-common-mode.md`](./shared-noise-common-mode.md).  
> No editar salvo corrección histórica.

**Status:** Shipped (2.4.3)  
**Date:** 2026-08-26  
**Product:** VHectorLab 3D (`/` legacy UI only)  
**Prompt companion:** [`PROMPT-shared-noise-coverage-knobs.md`](./PROMPT-shared-noise-coverage-knobs.md)  
**Predecessor (archived, partial):** [`shared-noise-common-mode.md`](./shared-noise-common-mode.md)  
**Version on ship:** **PATCH** `2.4.2` → `2.4.3`

> **Goal (one sentence):** Finish Shared noise as **token-batch common-mode** (not G1↔G2), place it with Zero coverage, and replace the high-coverage slider UX with **Workbench-styled dual knobs (A + mA)** on both Zero coverage and Shared noise — techo **100%**, readout editable, defaults OFF + 30%.

---

## 0. Carry-forward / WIP (read first)

A prior session left **uncommitted** work that may already be in the working tree:

| Piece | Status |
| :--- | :--- |
| Token-batch metric + split paint (`computeTokenSharedNoiseMetrics`, cancel←token / highlight←group) | Likely present — verify tests |
| Instancer / MeshFactory / RIBBONS wiring | Likely present |
| `HIGH_COVERAGE_MAX = 100` + `cancelAmountFromMetric` / shader allow `c=1` | Keep |
| Numeric `%` input beside slider | **Replace** with A/mA knobs (readout stays editable) |
| Shared noise panel move + ≥2-token gate + docs/PATCH | **Not done** |

**Agent bootstrap:** `git status` + `git branch`. If WIP exists → move onto `feat/shared-noise-coverage-knobs` (or continue `feat/shared-noise-common-mode` renamed/continued) **before** coding. If tree is clean → re-implement engine from archived D1–D13, then continue slices here. Do **not** discard the 100% ceiling.

---

## 1. Locked product decisions (do not re-litigate)

### 1.1 Shared noise metric (from predecessor)

| ID | Decision |
| :--- | :--- |
| D1 | Question: “On this dim, do **all tokens in view** look the same (sign + magnitude)?” Not group-mean agreement. |
| D2 | Unit = every Compare item with equal-width embedding. **`groupId` ignored.** |
| D3 | Per dim: `min`/`max` of raw visualized `item.embedding[d]`; `sim = sharedNoiseSimilarity(min,max)`; 0 counts as +. Mixed signs → no cancel. |
| D4 | Min/max (not means): one outlier blocks early hide. |
| D5 | Persist keys **unchanged** (`vl3d.viz.sameSignCancel*`, zero coverage keys). Defaults: toggles **OFF**, coverage **30%**. |
| D6 | Paint only — Y / geometry / dim count / X / ruler / hover raw / dim-sort untouched. |
| D7 | Label stays **`Shared noise`**; amount label stays **`Similarity`**. |
| D8 | UI: Shared noise block **immediately after Zero coverage**, **outside** Group contrast. Group contrast = Sign conflict + Group hue only. |
| D9 | Gate Shared noise: Compare + **≥2 tokens with embeddings**. Sign conflict / Group hue: **≥2 groups**. |
| D10 | Sign conflict stays G1↔G2 means. Highlight then blacken order unchanged. |
| D11 | ANALYSIS + NAVIGATION, POINTS + RIBBONS. Galaxy no-op. Arithmetic out. |
| D12 | Out: per-thread cancel, within-group second control, collapse X, backend/SAE train, `src/v25/**`. |

### 1.2 High-coverage range

| ID | Decision |
| :--- | :--- |
| C1 | Range **30% … 100%** (not 99.9999). Keep after knobs land. |
| C2 | Same range for **Zero coverage** and **Shared noise Similarity**. |
| C3 | `cancelAmountFromMetric` / zero-coverage remap must accept **`c = 1`** (100% real). |

### 1.3 Dual knobs A / mA (mapping A)

| ID | Decision |
| :--- | :--- |
| K1 | One persisted percent `v ∈ [30, 100]`. Knobs are a **projection**, not two storage keys. |
| K2 | **A (coarse):** integer amperes metaphor → whole percent `floor` component, range that covers 30…100. |
| K3 | **mA (fine):** milliamperes metaphor → tenths `0.0 … 0.9` (step 0.1). Value = compose(A, mA) then clamp to [30, 100]. |
| K4 | Readout shows single percent; **editable**. Typing `100` → A=100, mA=0. Typing `99.9` → A=99, mA=0.9. |
| K5 | Edge / clamp: **least effort** — e.g. turning A to 100 with mA=0.7 → clamp to 100, then sync knobs (mA→0). No fancy carry logic. |
| K6 | Interaction: **slider disguised as knob** (drag rotates grafismo). **Not** true circular angular capture. |
| K7 | Analog feel: short **visual lerp** of knob angle (~150–250ms) when readout commits or value jumps. No audio. |
| K8 | Labels on chrome: **`A`** and **`mA`**. Tips `(i)` short + clear (EN, ≤28 chars preferred). |
| K9 | Apply to **both** Zero coverage Coverage and Shared noise Similarity. |
| K10 | Look: big knob + smaller knob beside it (vintage amp / mixer). **Magic Workbench 3.0** tokens (`src/theme/`, existing viz panel chrome) — elegant, not cartoon. |
| K11 | Layout: cheapest clean layout — header row = label + editable readout; knobs under or beside in one dense Workbench row. Mobile: keep A\|mA **side-by-side** at smaller size; stack only if unusable (<~280px content). |
| K12 | Replace the rejected “number input + long range slider” experiment; range input may remain **hidden** as a11y/fallback only if trivial — prefer knobs + readout as the visible controls. |

### 1.4 Tone / docs

| ID | Decision |
| :--- | :--- |
| T1 | On ship, **CHANGELOG** + **commit message** both include an EN note in the human’s voice: knobs look a bit like studio-gear cosplay on a Workbench panel; shipping anyway because one slider fighting the top end was worse UX than a little theatrical. |
| T2 | Suggested spirit (agent may trim, keep voice): *Dual coarse/fine knobs for Zero coverage and Shared noise — yes, it looks a bit like studio gear cosplay on a Workbench panel. Keeping it anyway: one slider fighting the top end was worse UX than a little theatrical.* |

---

## 2. Related code seams

| Area | Path |
| :--- | :--- |
| Metric + paint | `src/visualizer/groupDimContrast.js` |
| Mount | `src/visualizer/Instancer.js`, `MeshFactory.js`, `groupHuePaint.js` |
| High coverage math | `src/ui/visualizationControlsDefaults.js` (`HIGH_COVERAGE_*`, `normalizeHighCoverage`, `cancel`/`remap`) |
| Panel | `src/ui/VisualizationControls.js`, `src/style.css`, `src/ui/fieldInfo.js` |
| Gate | `src/main.js` `syncGroupContrastGate` (+ sibling token gate) |
| Theme | `src/theme/` Workbench tokens — reuse, don’t invent a second design system |
| Tests | `tests/groupDimContrast.test.js`, `tests/visualizationControls.test.js` (+ new knob helper tests) |
| Docs | `CONTEXT.md`, `CHANGELOG.md`, `lessons-learned.md` §4.11b |
| Archived plan | `roadmap/archivo/shared-noise-common-mode.md` |

---

## 3. UX sketch

```
[ ] Zero coverage     (i)
    [ 30.0 ] %          ← editable readout
    (● A)  (· mA)       ← big + small knobs

[ ] Shared noise      (i)     ← after Zero coverage; gate ≥2 tokens
    Similarity
    [ 30.0 ] %
    (● A)  (· mA)

Group contrast                  ← ≥2 groups
    Sign conflict …
    Group hue …
```

---

## 4. Tests

| Area | Assert |
| :--- | :--- |
| Token metric | Predecessor cases: &lt;2 tokens → `[]`; 1 group ok; 3-group outlier blocks; mixed signs cancel 0 |
| Paint split | Cancel uses token metrics; highlight uses group metrics |
| Compose/decompose | `99.9` ↔ A=99, mA=0.9; `100` ↔ A=100, mA=0; clamp least-effort |
| Range | normalize still [30, 100]; unit path allows c=1 |
| Gate UI | Shared noise enable ≥2 tokens; conflict/hue ≥2 groups |
| Regression | `computeDimRelationMetrics` unchanged for Sign conflict |

`npm test`. No Python unless accidentally touched.

---

## 5. Slices

| Slice | Scope | DoD (summary) |
| ---: | :--- | :--- |
| **1** | Engine + 100% ceiling | Token-batch metric + split paint green; `HIGH_COVERAGE_MAX=100`; no push. If WIP already matches, verify + fix gaps only. **APPROVAL GATE.** |
| **2** | A/mA knobs | Deep helper compose/decompose + TDD; Workbench knobs on Zero coverage + Shared noise; editable readout sync + short lerp; tips A/mA; replace rejected slider+edit UX. **APPROVAL GATE.** |
| **3** | Placement + gate + ship docs | Move Shared noise after Zero coverage; ≥2-token gate; CONTEXT / CHANGELOG (incl. T2 note) / lessons §4.11b; PATCH 2.4.3; smoke §6. **APPROVAL GATE** → wait OK → `git-workflow.md` §3 (commit message includes T2). |

Serial. Do not start the next slice until the human approves the current one.

---

## 6. Smoke (manual)

1. Dev server; COMPARE ≥2 tokens, **no** groups → Shared noise usable; Group contrast gray.
2. Shared noise ON, A/mA ~30%: flat same-sign bands darken; mixed-sign stay; Y unchanged.
3. Type `99.9` / `100` in readout → knobs lerp to match; paint updates.
4. Three `GROUP_*`: G1≈G2 but G3 opposite on a dim → **stays visible** under Shared noise; Sign conflict still G1↔G2.
5. Zero coverage knobs behave the same range/UX.
6. Reload: both toggles OFF, coverage 30% restored from persist when turned on.
7. Galaxy unchanged (no new per-dim cancel columns).

---

## 7. Doc-sync (conditional, on ship)

| Asset | Update? |
| :--- | :--- |
| `CONTEXT.md` | Yes — Shared noise = token min/max; sits with Zero coverage; A/mA coverage chrome |
| `CHANGELOG.md` | Yes — metric retarget + knobs; include T2 note |
| `lessons-learned.md` §4.11b | Yes — token batch; gate ≥2 tokens; knobs |
| SemVer bump sites | Yes PATCH 2.4.3 |
| `architecture_spec.md` / `README.md` | No |

---

## 8. Out of scope

- True rotary encoder math / WebMIDI / audio ticks
- Second “within-group shared noise” control
- N-way Sign conflict
- Dropping dims from X / PCA / backend stats
- Re-opening 99.9999% as max
