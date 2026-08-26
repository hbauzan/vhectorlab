# Discovery Note — Shared Noise Is Embedding-Geometry Dependent

**Status:** Research / evidence dump (not a product roadmap; not an implementation ticket)  
**Date:** 2026-08-26 (UTC)  
**Repo:** `vhectorlab`  
**Authors of the session:** human (Hector) + coding agent (Cursor)  
**Audience:** another AI (and the human) continuing analysis with full repo access  

**Location:** `current-research/` — empirical discoveries beyond day-to-day engineering lessons (`lessons-learned.md`). Do not treat this folder as a roadmap or as shipped product docs.

This document captures an accidental discovery made while debugging why **Shared noise** felt alive on a local Mac lab but **did nothing** on the public Hugging Face Space. The first hypothesis was “HF is missing code / wrong wiring / model pin.” The deeper finding is: **the Shared noise pipeline is model-agnostic in code, but its *visibility* collapses or expands with the statistical geometry of the embedding space and the Compare batch.**

Treat this as a primary source for follow-up science, not as a finished theory.

---

## 0. How to use this file

1. Read this document end-to-end before changing Shared noise math.
2. Cross-read (do not replace this file with them):
   - `roadmap/HANDOFF-shared-noise.md` — product intent, SAE caveats, omit-common draft status
   - `roadmap/shared-noise-omit-common.md` — agreed direction for *geometry* hide (not yet on `main`)
   - `roadmap/archivo/shared-noise-coverage-knobs.md` — shipped 2.4.3 decisions (token-batch min/max)
   - `src/visualizer/groupDimContrast.js` — the actual engine
   - `tests/groupDimContrast.test.js` — locked formulas
   - `.agents/skills/dev-protocol/lessons-learned.md` §8.9 — short engineering invariant distilled from this study
3. Re-run the reproduction snippets in §7 against whatever model is currently loaded locally / on the Space.
4. At the time of writing, **local** was already Arctic `local-full` @256; **HF Space** was still serving **mpnet @768** until a republish of Dockerfile commit `dbd822d` finishes building. Numbers below are from that split.

---

## 1. The accident (chronology)

### 1.1 Symptom the human reported

> Shared noise works locally. On HF it does not move anything. Seriously — the knob did nothing.

### 1.2 First-layer discrepancy (ops / deploy)

Local `.env` (gitignored, observed 2026-08-26):

| Knob | Local Mac |
| :--- | :--- |
| `MODEL_PROFILE` | `local-full` |
| `MODEL_NAME` | `Snowflake/snowflake-arctic-embed-m-v2.0` |
| `TRUNCATE_DIM` | `256` |
| `VOCAB_PATH` | `public/vocab_en_es.txt` |
| Device (`/health`) | `mps` |
| Embedding width | **256** |

Hugging Face Space `hbauzan/llm-semantic-visualizer` **before** the Arctic pin (live `/health` during the study):

| Knob | HF Space (cpu-basic) |
| :--- | :--- |
| Profile | `null` (no `MODEL_PROFILE`) |
| Model | `sentence-transformers/all-mpnet-base-v2` |
| Truncate | `null` (full width) |
| Vocab | `public/vocab.txt` (EN-only, from Dockerfile) |
| Device | `cpu` |
| Embedding width | **768** |

Dockerfile historically hard-pinned `MODEL_NAME=all-mpnet-base-v2` for the cpu-basic demo epic. Multi-LLM catalog work explicitly deferred Space model policy (`roadmap/multillm/…`). So the Space was not “broken”; it was running a **different lab**.

### 1.3 Second-layer question (this discovery)

After explaining the model mismatch, the human asked:

> Can Shared noise wiring work with one LLM but not another? Please review.

That forced a code audit + measurements. **Result:** wiring is universal; **cancel rates are not.**

### 1.4 Immediate product follow-up already landed

Commit on `main`: `dbd822d` — `feat(hf): pin Space to local-full Arctic-m @256 + EN∪ES vocab`.

Rationale checked against HF docs: **cpu-basic** = 2 vCPU / **16 GB RAM** / **50 GB** disk. Arctic `model.safetensors` ≈ **1.2 GB** → fits. `trust_remote_code` + xformers disable / GTE buffer repair already live in `backend/model_catalog.build_model` (lesson 8.8).

After option **8** republish + Space rebuild, `/health` should report Arctic · 256D · `model_profile: local-full`. Until then, comparative measurements against HF still see mpnet.

---

## 2. What Shared noise *is* on `main` (engineering contract)

### 2.1 Scope

- **UI:** Visualization panel → “Shared noise” toggle + Similarity knobs (`A` / `mA`).
- **Gate:** ≥2 Compare tokens with equal-width embeddings (`hasEnoughTokensForSharedNoise`). Groups are **not** required for Shared noise (Group contrast / Sign conflict is a separate gate).
- **Effect:** **Paint only** toward black (and alpha fade). Thread **Y / geometry / undulation unchanged** on `main`.
- **Not shipped:** omit-common / per-word holes / geometry hide (`feat/shared-noise-per-word` never merged; omit-common still draft).

### 2.2 Metric (token-batch, since 2.4.3)

For each dimension `d` over all Compare items with embeddings:

```
min_d = min_i embedding_i[d]
max_d = max_i embedding_i[d]
sameSign_d = signedUnit(min_d) == signedUnit(max_d)   # signedUnit: v >= 0 → +1 (zero counts as +)
similarity_d = 1 - |max_d - min_d| / (|max_d| + |min_d|)   # both ~0 → 1
```

**Critical veto (D4):** if `sameSign_d` is false → **no Shared-noise cancel on that dim**, regardless of Similarity knob. One opposite-sign outlier vetoes the entire dimension for the whole batch.

### 2.3 Cancel amount (knob)

```
coverage01 = highCoverageToUnit(sameSignCancelCoverage)   # UI percent → [0,1]
cancel_d = cancelAmountFromMetric(similarity_d, coverage01)
# floor = 1 - coverage01; if similarity <= floor → 0; else ramp to 1 as similarity → 1
```

Default Similarity coverage sits at the high-coverage minimum (historically “30%” class floor for high-coverage knobs — see `DEFAULT_HIGH_COVERAGE` in `visualizationControlsDefaults.js`). Human often runs ~70–80% when exploring.

### 2.4 Where it is applied

| Stage | File | Role |
| :--- | :--- | :--- |
| Metrics | `src/visualizer/groupDimContrast.js` → `computeTokenSharedNoiseMetrics` | min/max / sameSign / similarity |
| Weights | `paintWeightsForDim` | cancel from token metrics; highlight from G1↔G2 group metrics |
| POINTS attrs | `buildPointGroupPaintAttributes` | per-point cancel/highlight using `meta.dim` = **source** dim |
| Color | `groupHuePaint.js` → `applyGroupDimPaint` | lerp toward black / highlight |
| Instancer | `src/visualizer/Instancer.js` | computes token metrics on **raw** item embeddings; dim-sort permutation tracked via `sourceDims` so paint still indexes original dims |

There is **no** branch on `MODEL_NAME`, `embedding_dim`, profile id, or Hub id in this path. Inputs are `number[]` embeddings already present on Compare items (RAW or whatever the UI currently visualizes after SAE encode — if SAE is ON, the visualized vectors are SAE features, not the encoder dims; see handoff SAE warnings).

### 2.5 Scale invariance of similarity (important)

For same-sign pairs, `sharedNoiseSimilarity(a,b)` depends on **relative** spread, not absolute magnitude:

- `(0.01, 0.02)` → similarity `0.667`
- `(0.10, 0.20)` → similarity `0.667`

So “mpnet has smaller float magnitudes” is **not** by itself an explanation. What matters is:

1. How often min/max **straddle zero** across the batch (veto).
2. Conditional on same sign, how flat min≈max is across tokens.

Those are properties of **embedding geometry + batch composition**, not of the JS wiring.

---

## 3. The discovery (compressed statement)

**Claim.** For the same Shared noise code and the same Compare texts, **all-mpnet-base-v2 @768** produces far fewer dimensions that survive the same-sign veto and receive non-zero cancel than **Snowflake arctic-embed-m-v2.0 Matryoshka-truncated @256**. On diverse batches, mpnet cancel can fall to a few percent of dims — visually “the knob does nothing” in POINTS — while Arctic still paints a meaningful fraction of the thread.

**Non-claim.** We do **not** claim Arctic is “better” in general, nor that Shared noise is “correct” on Arctic. We claim the **current metric is hypersensitive to sign-unanimity across the batch**, and different encoders + widths change how often that unanimity occurs.

**Accident value.** The HF vs local mismatch was the instrument that made the hypersensitivity obvious. Without two live endpoints running different models on the same UI, it looked like a deploy bug.

---

## 4. Evidence A — synthetic geometry (agent simulation)

Quick Monte Carlo (Python, `random.gauss` isotropic vectors then L2-normalize). Coverage = `0.77`.

| Scenario | Dims | Tokens | sameSign % | cancel>0 @77% |
| :--- | ---: | ---: | ---: | ---: |
| Isotropic L2 (mpnet-like) | 768 | 12 | **0%** | **0** |
| Isotropic L2 (arctic-width) | 256 | 12 | **0%** | **0** |
| Near-duplicate tokens (noise 0.15 on shared base) | 768 | 4 | ~88% | many |
| 3-group bootstrap with opposing group base | 768 | 24 | **0%** | **0** |
| 2 groups, all-positive correlated | 768 | 12 | ~98% | many |
| Structured: first 80 dims shared, rest noise (256-D) | 256 | 12 | ~31% | 80 dims |

**Interpretation:**

- Pure isotropic high-dim L2 spaces almost never keep unanimous signs across ≥12 diverse tokens → Shared noise is dead by construction.
- Real encoders are **not** isotropic; they have structure. The question becomes *how much same-sign flatness survives for a given batch*.
- The classic 3-group “happy / sad / angry” style opposition annihilates token-batch Shared noise even before model choice (angry vetoes dims that happy & sad shared). This matches the archived roadmap note that 2.4.3 with large Compare bootstraps “almost doesn’t fire.”

---

## 5. Evidence B — live `/compare` on the same 12 texts

### 5.1 Probe texts (fixed)

```json
["happy","joyful","glad","sad","unhappy","sorrow","angry","furious","mad","car","truck","bike"]
```

Mixed emotions + vehicles — intentional diversity (closer to a small multi-theme Compare than to three synonyms).

### 5.2 Endpoints

| Endpoint | Observed `/health` during measurement |
| :--- | :--- |
| Local | `Snowflake/snowflake-arctic-embed-m-v2.0`, profile `local-full`, **256-D**, truncate 256, device `mps` |
| HF Space | `sentence-transformers/all-mpnet-base-v2`, profile `null`, **768-D**, device `cpu` |

POST local: `http://127.0.0.1:8000/compare`  
POST Space: `https://hbauzan-llm-semantic-visualizer.hf.space/api/compare`

### 5.3 Results (Shared noise math applied offline to returned embeddings)

Coverage = **0.77** (Similarity knob ≈ 77%).

| Batch | Model | Dim | sameSign dims | sameSign % | sim>0.9 | cancel>0 | cancel>0.5 |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| Mixed 12 | **Arctic local** | 256 | 77 | **30.1%** | 0 | **55** | 10 |
| Mixed 12 | **mpnet HF** | 768 | 52 | **6.8%** | 4 | **24** | 4 |
| Happy synonyms (3) | Arctic local | 256 | 194 | 75.8% | 19 | 171 | 106 |
| Happy synonyms (3) | mpnet HF | 768 | 382 | 49.7% | 12 | 317 | 135 |
| Emotion 9 (no cars) | Arctic local | 256 | 104 | 40.6% | 0 | 75 | 18 |

### 5.4 Why this matches the human’s perception

- POINTS draws one point per (token × dim). Paint cancel only on dims that pass the veto and clear the coverage floor.
- **Arctic mixed-12:** ~**21%** of dims get *some* cancel (`55/256`). Visible darkening along threads.
- **mpnet mixed-12:** ~**3.1%** of dims get some cancel (`24/768`). On a 768-point-long thread, blackening ~24 indices is easy to miss → “knob does nothing.”
- On **near synonyms**, both models respond. So Shared noise is not “broken on mpnet”; it is **batch- and geometry-starved** on diverse mpnet Compare scenes.

### 5.5 Coverage = 1.0 (full Similarity) on mixed-12

| Model | cancel>0 at 100% Similarity |
| :--- | ---: |
| Arctic | 77 (all sameSign dims) |
| mpnet | 52 (all sameSign dims) |

Even at max knob, mpnet only has **52** candidate dims vs Arctic’s **77**, on a canvas that is **3× wider** (768 vs 256). Density of affected points ≈ `52/768 ≈ 6.8%` vs `77/256 ≈ 30%`.

---

## 6. What we ruled out

| Hypothesis | Verdict |
| :--- | :--- |
| HF missing Shared noise frontend | **Ruled out.** Same `main` UI; Space served Shared noise controls. |
| JS wiring keyed on model id / dim | **Ruled out.** No such branches in `groupDimContrast.js` / Instancer paint path. |
| Similarity formula fails on small magnitudes | **Ruled out** for same-sign case (scale-invariant). |
| Dim-sort permutation breaks paint index | **Unlikely as HF-only cause.** Instancer stores `meta.dim = sourceDim`; metrics indexed by source dim. Would affect both models equally if buggy. |
| “Must use SAE” / “must use RAW” as HF difference | **Not required for the finding.** Measurements used `/compare` RAW embeddings. SAE ON would change the visualized space further (handoff warns SAE Top‑K fights “hide the common pack”). |
| Disk / Docker / option 7–8 publish bugs | **Separate saga** (GIF binary + orphan tip + full disk). They delayed republish but did not invent the Shared noise geometry effect. |

---

## 7. Reproduction recipes (for the next AI)

### 7.1 Offline metric helper (Python)

```python
def shared_noise_similarity(a, b):
    aa, bb = abs(a), abs(b)
    den = aa + bb
    if den <= 1e-12:
        return 1.0
    return max(0.0, min(1.0, 1.0 - abs(a - b) / den))

def cancel_amount_from_metric(metric01, coverage01):
    m = max(0.0, min(1.0, float(metric01)))
    c = max(0.0, min(1.0, float(coverage01)))
    if c <= 1e-12:
        return 0.0
    floor = 1.0 - c
    if m <= floor:
        return 0.0
    return (m - floor) / c

def analyze_batch(embeddings, coverage=0.77):
    """embeddings: list[list[float]] shape (n_tokens, dim)"""
    n, d = len(embeddings), len(embeddings[0])
    same = hi = c0 = c5 = 0
    for di in range(d):
        vals = [embeddings[i][di] for i in range(n)]
        lo, hi_ = min(vals), max(vals)
        same_sign = (lo >= 0) == (hi_ >= 0)  # matches signedUnit: 0 → +
        sim = shared_noise_similarity(lo, hi_)
        if same_sign:
            same += 1
            if sim > 0.9:
                hi += 1
            c = cancel_amount_from_metric(sim, coverage)
            if c > 1e-9:
                c0 += 1
            if c > 0.5:
                c5 += 1
    return {
        "n": n,
        "d": d,
        "same_sign": same,
        "same_sign_pct": 100.0 * same / d,
        "sim_gt_0_9": hi,
        "cancel_gt_0": c0,
        "cancel_gt_0_5": c5,
    }
```

### 7.2 Fetch embeddings

```bash
# Local
curl -sS -X POST 'http://127.0.0.1:8000/compare' \
  -H 'Content-Type: application/json' \
  -d '{"texts":["happy","joyful","glad","sad","unhappy","sorrow","angry","furious","mad","car","truck","bike"]}' \
  -o /tmp/cmp_local.json

# Space (path may be /compare or /api/compare depending on reverse proxy; Space uses /api)
curl -sS -X POST 'https://hbauzan-llm-semantic-visualizer.hf.space/api/compare' \
  -H 'Content-Type: application/json' \
  -d '{"texts":["happy","joyful","glad","sad","unhappy","sorrow","angry","furious","mad","car","truck","bike"]}' \
  -o /tmp/cmp_hf.json

curl -sS 'http://127.0.0.1:8000/health'
curl -sS 'https://hbauzan-llm-semantic-visualizer.hf.space/health'
```

Parse `items[].embedding` from the JSON and run `analyze_batch`.

### 7.3 Vitest ground truth

```bash
npx vitest run tests/groupDimContrast.test.js
```

Formulas and veto examples are locked there (including “G3 outlier blocks high sim”).

### 7.4 UI ground truth

1. COMPARE + ANALYSIS + POINTS.
2. Prefer **SAE OFF** for this study (RAW floats).
3. Enable Shared noise; sweep Similarity.
4. Repeat with (a) 3 near synonyms, (b) mixed 12 probe, (c) full bootstrap (`it_core` + `vehicles` + `women` — hundreds of tokens). Expect (c) to starve cancel on **both** models.

---

## 8. Related product context (do not confuse layers)

### 8.1 Already known before this discovery

From `roadmap/HANDOFF-shared-noise.md`:

- 2.4.3 retarget to token-batch min/max made large Compare bootstraps look “dead.”
- Zero coverage is a **different** instrument (colormap band around 0).
- Desired future: hide the **pack** in **geometry** (omit-common), keep the distinctive point — **not** paint-only.

This discovery **sharpens** that story: even when the batch is moderate (12 tokens), **encoder choice** can push you into the “dead knob” regime.

### 8.2 SAE trap (repeat for the next AI)

Lab SAE = dictionary fit on current batch + Top‑K **largest** activations for reconstruction. Shared large features survive; unique small ones die. Yellow stripes across groups with SAE ON are often **not** Shared noise failing — they are SAE doing its job. Study Shared noise on **RAW** first.

### 8.3 Matryoshka / truncate

Arctic `local-full` uses `TRUNCATE_DIM=256` (catalog default). That is not cosmetic: it selects a Matryoshka prefix. Whether the **prefix** is more same-sign-stable across diverse tokens than full 768 mpnet is an open scientific question suggested by the data, not proven as “MRL causes X.”

---

## 9. Open questions for deeper analysis

Prioritize with the human; do not silently implement.

1. **Is Arctic@256 systematically more same-sign-stable than mpnet@768 across many batches?**  
   Need a grid: synonym sets, antonym sets, multi-theme, full bootstrap, random vocab samples. Report distributions of `sameSign%` and `cancel>0` density (normalize by dim).

2. **Width vs model family vs MRL prefix**  
   Ablate: Arctic@256 vs Arctic@768 (if quality allows) vs MiniLM-multi@384 (`local-comfort` / old `hf-demo` preset) vs mpnet@768 on identical texts.

3. **Is unanimous sign the wrong veto?**  
   Product intent (“hide the shared pack, keep the odd one out”) fights hard with min/max + sameSign. One opposite token currently **zeros the whole dim**. That may be correct for “common mode,” or it may be the bug relative to human vision (L2 in omit-common draft: 229 equal + 1 different → hide the 229, keep the 1).

4. **Per-dim robust statistics**  
   Alternatives to min/max: trimmed min/max, percentiles, MAD, “mode cluster” mass, pairwise agreement rates, ignore bottom-k outliers. Measure cancel density vs false hide of distinctive points.

5. **Normalize visibility by dim count**  
   UI perception ≈ fraction of points painted, not absolute count. A metric “cancel mass” = `mean(cancel_d)` or `sum(cancel_d)/D` may predict “knob feels alive” better than raw counts.

6. **Interaction with L2 normalization**  
   Sentence-transformers typically L2-normalize. Does that increase zero-straddling vs unnormalized Matryoshka prefixes?

7. **After Space rebuild**  
   Re-run §5 against HF once `/health` shows Arctic@256. Expect HF ≈ local for the same texts (device noise aside). If not, look for SAE defaults, vocab-only differences, or stale frontend bundle.

8. **Documentation / teaching**  
   Should the UI warn when `sameSign%` is near zero for the current batch (“Shared noise has almost no candidate dims on this Compare set / model”)?

---

## 10. Practical guidance (until the science settles)

- To **demo Shared noise** the way the Mac lab feels: use **Arctic `local-full` @256** (Space Dockerfile now aims there) and start with **small, coherent token sets** before the giant bootstrap.
- To **stress-test** the metric: use multi-theme or 3-group opposing batches — expect starvation by design.
- Do **not** assume HF is wrong if a knob looks dead on mpnet with diverse Compare; measure `sameSign%` first.
- Do **not** “fix” Shared noise by special-casing model ids without an explicit product decision.

---

## 11. Code & commit pointers (repo anchors)

| Item | Location |
| :--- | :--- |
| Engine | `src/visualizer/groupDimContrast.js` |
| Tests | `tests/groupDimContrast.test.js` |
| Instancer wiring | `src/visualizer/Instancer.js` (`computeTokenSharedNoiseMetrics`, `sourceDims`) |
| Paint | `src/visualizer/groupHuePaint.js`, `applyGroupDimPaint` |
| UI / storage | `src/ui/VisualizationControls.js`, `src/ui/visualizationControlsDefaults.js` |
| Gate from main | `src/main.js` (`setSharedNoiseControlsEnabled`, `hasEnoughTokensForSharedNoise`) |
| Catalog profiles | `backend/model_catalog.py` (`local-full` → Arctic + default truncate 256) |
| Space pin | `Dockerfile` (`MODEL_PROFILE=local-full`, `TRUNCATE_DIM=256`, `vocab_en_es.txt`) |
| Space card blurb | `deploy/hf/space-frontmatter.yml` |
| Arctic/xformers lesson | `.agents/skills/dev-protocol/lessons-learned.md` §8.8 |
| HF packaging lesson | same file §8.5 (+ Space model note 2026-08) |
| Commit pinning Space model | `dbd822d` |
| Evidence dump (this study) | `current-research/DISCOVERY-shared-noise-embedding-geometry.md` |
| Lesson distilled | `.agents/skills/dev-protocol/lessons-learned.md` §8.9 |
| Product handoff | `roadmap/HANDOFF-shared-noise.md` |
| Omit-common draft | `roadmap/shared-noise-omit-common.md` |

---

## 12. Suggested next session prompt (paste for another AI)

```text
Read current-research/DISCOVERY-shared-noise-embedding-geometry.md (this file).
Also read roadmap/HANDOFF-shared-noise.md, lessons-learned.md §8.9, and src/visualizer/groupDimContrast.js.
Do NOT implement omit-common or change Shared noise math unless I explicitly ask.
First: verify current /health on local and on the HF Space.
Re-run the §5 probe batch and report sameSign% and cancel density for whatever models are live.
Then help me design an ablation grid (models × batch types) to test whether Matryoshka-256
systematically preserves more same-sign flat dims than mpnet-768, and whether the unanimous-sign
veto conflicts with the “229 same + 1 different → keep the one” product intent.
```

---

## 13. One-paragraph abstract

While aligning a Hugging Face Space with a local VHectorLab setup, we found that Shared noise—a paint-only effect that blackens dimensions whose values are unanimously signed and mutually similar across Compare tokens—can appear completely inert on `all-mpnet-base-v2` (768-D) for diverse token batches, yet clearly active on `Snowflake/snowflake-arctic-embed-m-v2.0` truncated to 256-D for the **same** texts and the **same** frontend code. Live measurements showed ~30% same-sign dims and ~21% dims with cancel>0 on Arctic versus ~7% same-sign and ~3% cancel>0 on mpnet at 77% Similarity coverage. The code path is model-agnostic; the metric’s hard same-sign veto and min/max batch statistics make perceived “brokenness” a function of embedding geometry and batch diversity. The Space has since been pinned toward the local-full Arctic profile so demos match the Mac lab; deeper metric redesign remains an open research/product question tied to the omit-common roadmap.

---

*End of discovery note. Append new measurement tables below rather than rewriting history; date each addendum.*
