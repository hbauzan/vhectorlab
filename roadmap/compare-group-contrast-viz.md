# Roadmap — COMPARE group contrast visibility (RAW vs SAE)

**Status:** Implemented (awaiting APPROVAL GATE / merge) — D* pack 1; L1+L2; v2.1.0  

**Date:** 2026-08-02  
**Product:** VectorLab 3D (`lsv2`)  
**Prompt companion:** [`PROMPT-compare-group-contrast-viz.md`](./PROMPT-compare-group-contrast-viz.md)  
**Version on ship:** decide with human (**likely MINOR** — viz/UX; not a new SAE algorithm). Confirm via SemVer rules in `lessons-learned.md` §7.

> **Goal (one sentence):** Make GROUP_1 vs GROUP_2 (and any `GROUP_*` Compare input) **structurally readable** in ANALYSIS — like Embedding Projector / TF-style “domain blocks” — by fixing paint defaults, optional dimension reorder by between-group contrast, and (only if needed) SAE/data follow-ups.

---

## 0. Problem statement

User expectation (valid semantically): automotive lexicon (`GROUP_1`) vs soft/poetic lexicon (`GROUP_2`) should show **massive structural contrast** in 3D.

Current UI: dense “static” of points, no clear domain bands — especially with **SAE ON**.

This is **not** the earlier GROUP_* badge bug (bootstrap `tokenMeta`). Badges may already work; this epic is about **matrix readability / contrast**, not labels.

---

## 1. Facts already verified (do not re-litigate)

Source: live API + `scripts/diagnose_group_separation.py` against saved SAE (`640D · k=32 · n=130`), 2026-08-02.

### 1.1 Layout (ANALYSIS)

| Axis | Meaning |
| :--- | :--- |
| **X** | Dimension index `0..D-1` (raw order — **no variance / contrast sort today**) |
| **Y** | Thread stack slot + `val * amplitudeY` |
| **Z** | Always `0` |

Demo without cosine sort: tokens **0–64 = GROUP_1**, **65–129 = GROUP_2** (contiguous). Cosine ▲/▼ **breaks** contiguity.

Render modes: **POINTS | RIBBONS only**. No MESH, no Inspector Mode C, no variance slider.

### 1.2 SAE scope

- Train corpus = **current Compare cache only** (demo → **n=130**).
- `auto_scale` → ~**640** hidden, **k=32**.
- Checkpoint: `backend/artifacts/sae_weights.pt` (gitignored).

### 1.3 Measured separation (groups demo)

| Metric | RAW 768 | SAE 640 (Top‑K densified) |
| :--- | ---: | ---: |
| Centroid cosine G1↔G2 | 0.55 | **0.22** (better) |
| Separation gap (within − between) | 0.13 | 0.08 |
| Nonzero cell fraction | ~100% | **5%** |
| Contrast share in top‑32 dims | 14% | 24% |
| Peak \|activation\| → Y @ Amplitude **1** | **0.22** | **0.26** (flat) |
| Peak Y @ Amplitude **40** | ~8.7 | ~10.5 (readable) |

**Implication:** RAW embeds are **not antipodal** (0.55). Expectation of “all dims on for G1 / off for G2” is **false for this model + unsorted X**. There **is** signal; paint + dim order hide it.

### 1.4 Critical paint bug (SAE + z-score)

Colormap uses **global z-score + tanh** on the activation matrix (`lessons-learned` §2.1).

On sparse Top‑K SAE (~5% nonzero):

- Exact **zeros** normalize to \(t \approx -0.24\) → painted as **negative** color.
- Nonzeros saturate near \(+1\).

So “dust” under `Show: All` is largely **normalized zeros**, not domain contrast.  
**`+ Only`** hides those zeros (they become negative after norm) and leaves ~K peaks/token — large visual win.

Preset **`COMPARE|ANALYSIS|POINTS`** sets `threadAmplitudeY: 1.0` (slider floor) → relief collapsed even when math has signal (`spatialSliderDefaults.js`).

### 1.5 Related code seams

| Area | Path |
| :--- | :--- |
| ANALYSIS layout | `src/visualizer/LayoutEngine.js` |
| Spatial defaults | `src/ui/spatialSliderDefaults.js` |
| Sign filter | `src/visualizer/activationFilter.js`, viz panel |
| Z-score / shading | `src/visualizer/DivergentShading.js` (or equiv.) |
| Groups parse / badges | `src/ui/parseCompareGroups.js`, `ComparePanel.js` |
| SAE replace | `src/core/saeReplace.js`, `main.js` encode path |
| Diagnosis script | `scripts/diagnose_group_separation.py` |

---

## 2. Solution lanes (ordered by ROI)

| Lane | Name | Intent | Effort |
| :--- | :--- | :--- | :--- |
| **L1** | Quick UX | Readable existing signal | Hours |
| **L2** | Dim sort | Band structure on X | Days |
| **L3** | SAE / data | Stronger monosemantic split | Medium |
| **L4** | Diagnosis | Already done — keep script green | Done |

**Default recommended order:** **L1 → L2**; **L3** only if human still wants stronger model-side split after L1+L2.

---

## 3. Open decisions (agent MUST ask before coding)

Do **not** invent answers. Ask the human, record answers in this doc §3.1, then implement.

| ID | Topic | Options / notes |
| :--- | :--- | :--- |
| **D1** | Scope for v1 of this epic | **L1 only** / **L1+L2** / **L1+L2+L3** |
| **D2** | Amplitude default (`COMPARE\|ANALYSIS\|POINTS`) | Suggested **≥ 16** (or match ARITHMETIC ANALYSIS 40). Exact value? |
| **D3** | Auto `+ Only` when SAE ON | **A)** auto-set filter to `+ Only` on encode success; **B)** soft toast/hint only; **C)** no auto — docs only |
| **D4** | Restore filter when SAE OFF | Restore previous filter vs leave `+ Only` |
| **D5** | Group Y gap | Extra vertical gap between group blocks in ANALYSIS? Magnitude? |
| **D6** | Dim sort metric (if L2) | **\|mean_G1 − mean_G2\|** (preferred) / variance / both with UI toggle |
| **D7** | Dim sort when | Only if ≥2 groups with `groupId` / always available / Compare-only |
| **D8** | Dim sort persistence | Session only / `localStorage` / off by default toggle |
| **D9** | Cosine sort vs groups | Warn or disable global cosine sort when groups active? Or “regroup” after sort? |
| **D10** | SAE sparse normalize (if in scope) | Keep global z-score / **per-row** / **ignore exact zeros in mean/std** / normalize only nonzero cells — pick carefully; has colormap impact |
| **D11** | L3 scope (if chosen) | Wider train vocab / higher epochs / metrics panel G1–G2 gap / out of v1 |
| **D12** | SemVer | Confirm MINOR bump + version number against current `package.json` / manifest |

### 3.1 Answers log (fill during kickoff)

| ID | Answer | Date |
| :--- | :--- | :--- |
| D1 | **L1+L2** (pack 1 B) — L3 out | 2026-08-02 |
| D2 | Amplitude **16** for `COMPARE\|ANALYSIS\|POINTS` **and** RIBBONS twin | 2026-08-02 |
| D3 | **A** auto-set filter to `+ Only` (`positive`) on SAE encode success | 2026-08-02 |
| D4 | **A** restore previous filter when SAE OFF | 2026-08-02 |
| D5 | **B** soft Y gap: **+1×** `threadVectorDistance` between group blocks | 2026-08-02 |
| D6 | **A** `\|mean_G1 − mean_G2\|` (for >2 groups: max pairwise \|Δmean\|) | 2026-08-02 |
| D7 | **A** dim-sort toggle only when ≥2 distinct `groupId` | 2026-08-02 |
| D8 | **A** session only, **OFF** by default (no localStorage) | 2026-08-02 |
| D9 | **B** disable cosine ▲/▼ while groups active (reason in title) | 2026-08-02 |
| D10 | **A** defer — keep global z-score; L1 `+ Only` mitigates dust | 2026-08-02 |
| D11 | **A** out of v1 | 2026-08-02 |
| D12 | **MINOR `2.1.0`** | 2026-08-02 |

---

## 4. Proposed stages (after D* closed)

### Stage A — L1 Quick UX

1. Raise `COMPARE|ANALYSIS|POINTS` (and likely RIBBONS twin) `threadAmplitudeY` default per **D2**.
2. Wire SAE ON behavior per **D3/D4**.
3. Optional group stack gap per **D5** (`LayoutEngine` / Instancer when `groupId` present).
4. Vitest for defaults + SAE→filter interaction (pure helpers where possible).
5. Smoke: groups demo, SAE ON, ANALYSIS POINTS — peaks readable, dust gone if `+ Only`.

### Stage B — L2 Dim sort (if D1 includes L2)

1. Pure helper: given items with `groupId` + embeddings/activations, compute dim permutation by **D6**.
2. Apply permutation in layout path (ANALYSIS X) without mutating backend payload permanently — or store `dimOrder` on client state.
3. UI toggle “Sort dims by group contrast” (EN copy) per **D7/D8**.
4. Tests: G1/G2 synthetic matrix → high-contrast dims move left (or agreed side).
5. Smoke: bands visible for groups demo RAW and SAE.

### Stage C — L3 SAE/data (only if D1/D11)

1. As agreed: broader train set, metrics, or normalize fix **D10** if deferred from L1.
2. Re-run `scripts/diagnose_group_separation.py`; attach numbers to PR/CHANGELOG.

### Stage D — Docs + ship

1. CHANGELOG Unreleased (EN).
2. Short `lessons-learned` note: SAE + global z-score paints zeros; Amplitude=1 flattens COMPARE; dim sort optional.
3. Update this roadmap status → Implemented.
4. APPROVAL GATE → push/merge per `git-workflow.md`.

---

## 5. Out of scope (unless human expands D*)

- MESH render mode / Embedding Projector PCA-UMAP 2D map.
- Neuronpedia / LLM feature naming.
- Changing `/compare` API contract.
- Full-vocab SAE train as default product path (session scope remains default unless D11 says otherwise).
- Reworking Arithmetic thread order.

---

## 6. Acceptance criteria (draft — tighten after D*)

### L1

- [ ] COMPARE ANALYSIS default Amplitude no longer floor `1.0` (per D2).
- [ ] With SAE ON + agreed filter behavior, sparse zeros are not a full-wall “negative dust” under the chosen mode.
- [ ] Groups demo: human can see vertical structure (peaks) without hunting sliders for 5 minutes.
- [ ] Vitest green for touched defaults/helpers.

### L2 (if in scope)

- [ ] With groups + dim sort ON, high \|Δmean\| dims cluster on X (test + visual).
- [ ] Dim sort OFF restores raw dim index order.
- [ ] Works for RAW and SAE activation matrices.
- [ ] No breakage of GROUP_* badges / tokenMeta.

### L3 (if in scope)

- [ ] Diagnosis script shows improved metric agreed in D11.
- [ ] Documented train guidance in UI or CHANGELOG.

### Always

- [ ] No Spanish UI regressions.
- [ ] APPROVAL GATE respected (no push/merge without explicit OK).

---

## 7. How to re-run diagnosis

```bash
# Backend must be up with model + optional SAE checkpoint
python3 scripts/diagnose_group_separation.py
```

Expect JSON + `=== VERDICT HINTS ===`. Keep script working as regression for L2/L3.

---

## 8. Smoke checklist (human)

1. `main` pulled; backend + `npm run dev`.
2. COMPARE → 2 Groups (or bootstrap) → **Loaded Tokens: 130**, badges GROUP_1/GROUP_2.
3. ANALYSIS + POINTS; note Amplitude default after L1.
4. SAE ON (trained on this scope): confirm filter behavior (D3); visual peaks vs dust.
5. If L2: toggle dim sort; confirm bands; toggle off.
6. Cosine sort ▲/▼: behavior matches D9.
7. SAE OFF → RAW restore + filter per D4.

---

## 9. Agent protocol reminder

1. Read `.agents/skills/dev-protocol/SKILL.md` + `lessons-learned.md` + **this file**.
2. **Ask all open D1–D12** (and any new ambiguity). Wait.
3. Fill §3.1. Branch `feat/compare-group-contrast-viz` (or staged `feat/…-l1` / `…-l2`).
4. TDD where seams exist; no fluff; deep modules.
5. Self-verify (vitest + smoke).
6. Docs/lessons if contracts change.
7. APPROVAL GATE → then git delivery (`git-workflow.md` §3).
