# Roadmap — Multi-embedding model selection (`multillm`)

**Status:** Plan (ready to implement)  
**Date:** 2026-08-09  
**Product:** VHectorLab 3D — **local bare-metal only** in this epic  
**Prompt companion:** [`PROMPT-multillm.md`](./PROMPT-multillm.md)  
**Folder index:** [`README.md`](./README.md)  
**Version on ship:** likely **MINOR** (operator-facing model profiles + setup menu + health fields). Confirm with human + SemVer rules in `.agents/skills/dev-protocol/lessons-learned.md`.

> **Goal (one sentence):** From `setup.sh`, choose a **profile** or **catalog model**, write `.env`, **always regenerate** `vocab_embeddings.npz` for the active model, restart the backend so **exactly one** embedding model is live, clear SAE when `D` changes, and show the active model (and profile) in navbar via `/health`.

---

## 0. Locked product decisions (do not re-litigate)

| ID | Decision |
| :--- | :--- |
| **M1** | Scope = **embedding models** (`SentenceTransformer`), not generative LLMs. |
| **M2** | Catalog = shortlist below + inferred extras in §2. Profiles = `local-comfort`, `local-full`, plus a **named** `hf-demo` profile that only exists as a **local preset** (maps to MiniLM multi). **No HF Space wiring** in this epic. |
| **M3** | Model change is always available from **`setup.sh` menu** (dedicated option). Flow: pick → write env → regenerate vocab NPZ → restart backend. |
| **M4** | **No** rich preview pane (no RAM/D/language table before confirm). Simple numbered list + short one-line tag is enough. |
| **M5** | Changing model **always regenerates** `public/vocab_embeddings.npz` (or path from `VOCAB_EMBEDDINGS_PATH`) for the selected model + current vocab file. No “model now / vocab later”. |
| **M6** | Vocab content for this epic: **EN + ES** only. Other languages = follow-up epic. |
| **M7** | `vocab_lang` / neighbor language filters = **follow-up** (out of scope). |
| **M8** | **One active model** in process memory. Swap = unload/reload via backend restart (or clean lifespan reload). No multi-model residency. |
| **M9** | GUI **shows** active model (and profile if set) via `/health` → navbar. **Switch only from `setup.sh`** (no web switcher). |
| **M10** | On model/`D` change: **clear/invalidate session SAE** automatically (and any persisted SAE checkpoint that is dim-incompatible). |
| **M11** | Hugging Face Space publish/build model policy = **deferred**. Local only. Any HF work later requires **many human approval gates**. |
| **M12** | Encode quirks (e.g. E5 `query:` / `passage:` prefixes) must be handled in **one backend adapter**, not in the frontend. |
| **M13** | `trust_remote_code` allowed only for catalog entries that declare it (`arctic`, `gte-multilingual-base`). |
| **M14** | Gated models (`embeddinggemma`) may appear in the menu; if download/auth fails, abort with clear instructions (`hf auth login` + accept license). Do not half-write `.env`. |
| **M15** | Default after epic (local): prefer **`local-comfort` → MiniLM multilingual** as the new recommended default in `.env.example`, but keep `all-mpnet-base-v2` in catalog as **EN baseline**. Human confirms default at merge time. |

---

## 1. Problem / gap vs current architecture

Today:

- Single env knobs: `MODEL_NAME=all-mpnet-base-v2`, `VOCAB_PATH`, `VOCAB_EMBEDDINGS_PATH`.
- `AppState` lazy-loads one `SentenceTransformer`; vocab NPZ assumed to match that model.
- `setup.sh` option **6** manages vocabulary size/path, but **cannot** switch embedding backends.
- `/health` already returns `model` + `device`; navbar shows them — but there is **no profile id**, no catalog, no swap workflow, no guaranteed NPZ rebuild on change.
- SAE assumes a stable `input_dim` (historically 768); multilingual MiniLM is **384**, Arctic MRL may be **256/768**.
- Vocab is largely **EN**, so cross-lingual Arithmetic nearest-neighbors are weak even if the encoder is multilingual.

This epic adds an **operator-facing model catalog + profiles**, a **safe swap pipeline**, **EN+ES vocab**, and **dim-safe SAE invalidation** — all local.

---

## 2. Model catalog (v1)

### 2.1 Required entries (human-confirmed)

| Profile hint | Hub ID | Role | Notes |
| :--- | :--- | :--- | :--- |
| EN baseline | `sentence-transformers/all-mpnet-base-v2` | Control / EN-only quality | Keep for A/B vs multi |
| `local-comfort` / `hf-demo` preset | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | Default multi, low RAM | D=384 |
| `local-full` | `Snowflake/snowflake-arctic-embed-m-v2.0` | Best multi + MRL | `trust_remote_code`; optional `TRUNCATE_DIM` |
| Quality reserve | `Alibaba-NLP/gte-multilingual-base` | High multi STS | `trust_remote_code` |
| Small multi + instructions | `intfloat/multilingual-e5-small` | Comfort multi | Adapter must apply E5 prefixes |
| Gemma embedding | `google/embeddinggemma-300m` | Optional gated | Requires HF auth; MRL-capable |

### 2.2 Inferred extras (include in catalog; expected to work)

These are standard SentenceTransformer multilingual encoders that fit Mac 16GB and local CPU demos; include them so the menu is useful beyond the research shortlist:

| Hub ID | Why include |
| :--- | :--- |
| `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` | Stronger multi paraphrase than MiniLM; still drop-in; D=768 |
| `intfloat/multilingual-e5-base` | Higher-quality E5; same prefix adapter as e5-small |
| `sentence-transformers/distiluse-base-multilingual-cased-v2` | Classic light multi; good Comfort candidate |

### 2.3 Explicit no-go (do not put in menu)

| Hub ID / class | Why |
| :--- | :--- |
| `BAAI/bge-m3` | Heavy for Comfort; D=1024 stress on UMAP/SAE |
| `jinaai/jina-embeddings-v3` | CC BY-NC + task adapters |
| Any generative LLM “hidden-state embedding” hack | Violates architecture |
| Remote Inference Providers as default | Offline/local product requirement |

### 2.4 Named profiles (env)

| Profile id | Maps to `MODEL_NAME` | Optional env |
| :--- | :--- | :--- |
| `local-comfort` | `paraphrase-multilingual-MiniLM-L12-v2` | unset `TRUNCATE_DIM` |
| `local-full` | `Snowflake/snowflake-arctic-embed-m-v2.0` | recommend `TRUNCATE_DIM=256` for speed; allow `768` |
| `hf-demo` | same as `local-comfort` MiniLM multi | **Local preset only** — documents future Space default; **does not** publish/build HF |

Env keys (proposed):

```bash
MODEL_PROFILE=local-comfort
MODEL_NAME=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
TRUNCATE_DIM=
VOCAB_PATH=public/vocab.txt
VOCAB_EMBEDDINGS_PATH=public/vocab_embeddings.npz
```

Catalog metadata lives in a **single source of truth** (prefer `backend/model_catalog.py` or `config/embedding_models.toml` — agent picks one deep module, not scattered bash strings). `setup.sh` should **read** that catalog (via `uv run python -m …` helper) rather than duplicating Hub IDs.

---

## 3. Operator UX (`setup.sh`)

### 3.1 New menu option

Add a dedicated option (suggested number **11**, renumber help text `0-11`):

```text
11. Select Embedding Model / Profile
```

Behavior:

1. Show current `MODEL_PROFILE` / `MODEL_NAME` / `TRUNCATE_DIM` / vocab paths (read from `.env`).
2. Submenu:
   - **Profiles:** `local-comfort` | `local-full` | `hf-demo` (local preset)
   - **Catalog models:** numbered list of §2.1 + §2.2 (one line each: short name only — **no** RAM preview table per M4)
   - **Cancel**
3. On confirm:
   1. Resolve profile → `MODEL_NAME` (+ default `TRUNCATE_DIM` if profile defines one).
   2. Upsert `.env` keys (`MODEL_PROFILE`, `MODEL_NAME`, `TRUNCATE_DIM` as applicable).
   3. Ensure EN+ES vocab file exists (see §5); if missing, generate/update before encode.
   4. Run precompute: `uv run python scripts/precompute_vocab_embeddings.py --model …` (pass truncate/adapter flags as needed).
   5. Restart **backend** (and clear SAE — backend should also self-clear on dim mismatch at load).
   6. Print `/health` summary (model, profile, dimension, vocab_size, device).
   7. Return to menu.

Failure rules:

- If gated download fails → **do not** leave `.env` pointing at an unloadable model.
- Prefer: **stage env → precompute → on success commit env + restart; on failure keep old env**.

### 3.2 Interaction with option 6 (Manage Vocabulary)

- Option 6 continues to manage vocab **content/size**.
- After vocab edits, if NPZ `model_name` ≠ current `MODEL_NAME` or shape mismatch, option 6 should **offer/force regenerate** (or call the same helper as option 11).
- Do not invent a second encode pipeline.

### 3.3 Idempotent deploy (option 1)

- Option 1 must start backend with whatever `.env` currently specifies.
- If NPZ missing or `model_name` mismatch vs `MODEL_NAME`, either auto-precompute (with clear log) or fail with “run option 11 / regenerate vocab”. Prefer **auto-precompute on mismatch** for local DX, with a loud console warning.

---

## 4. Backend architecture

### 4.1 Catalog module

Deep module responsibilities:

- List profiles + models (id, hub_id, trust_remote_code, needs_e5_prefix, default_truncate_dim, gated bool, short_label).
- `resolve_profile(profile_id) -> ModelSelection`
- `build_sentence_transformer(selection, device) -> SentenceTransformer`
- `encode_texts(model, texts, selection) -> np.ndarray` (applies E5 prefixes / truncate_dim / L2 norm policy)

### 4.2 AppState / lifespan

- Load selection from env (`MODEL_PROFILE` optional).
- Expose: `model_name`, `model_profile`, `embedding_dim`, `truncate_dim`, `vocab_size`, `device`, `is_loaded`.
- On load: if NPZ present, **validate** `model_name` (and D) matches selection; else encode vocab or refuse with actionable error.
- SAE session: if `input_dim != embedding_dim`, **clear** SAE state/checkpoint automatically (M10).

### 4.3 `/health` contract extension

Keep existing fields; add:

```json
{
  "status": "ok",
  "model": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
  "model_profile": "local-comfort",
  "embedding_dim": 384,
  "truncate_dim": null,
  "device": "mps",
  "is_loaded": true,
  "vocab_size": 12345
}
```

Navbar: show something like `ONLINE (local-comfort · MiniLM-multi · 384D · mps)` — keep readable; truncate long Hub IDs to short_label from catalog.

### 4.4 Encode path

All `/embed`, `/compare`, `/arithmetic` (query side) go through catalog `encode_texts` so E5 prefixes and MRL truncate stay consistent with vocab NPZ generation.

### 4.5 Precompute script

Extend `scripts/precompute_vocab_embeddings.py`:

- Accept `--truncate-dim`
- Use catalog builder (not ad-hoc `SentenceTransformer(...)` forever)
- Store in NPZ: `words`, `embeddings`, `model_name`, and ideally `truncate_dim`, `embedding_dim` (forward-compatible)

---

## 5. Vocabulary — EN + ES (this epic)

### 5.1 Goal

Replace/extend monolingual EN list so Arithmetic/Compare nearest-neighbors work for **Spanish** and **English** under a multilingual encoder.

### 5.2 Practical v1 approach (keep tasks small)

1. Keep existing EN `public/vocab.txt` as base (or generate via existing option 6 tooling).
2. Add `public/vocab_es.txt` **or** a merged `public/vocab_en_es.txt` (agent chooses one clean scheme).
3. Provide a script/helper to **merge + dedupe** (lowercase) EN∪ES → active `VOCAB_PATH`.
4. Seed ES list: high-frequency nouns/adjectives + **explicit translation pairs** used in cross-lingual smoke tests (king/rey, woman/mujer, …) so lab demos work immediately.
5. Size target: pragmatic — e.g. EN top-N + ES top-N such that total stays comfortable for NPZ encode on M4 (document chosen N in README). Do **not** jump to 30k×6 languages.

### 5.3 Out of scope here

- FR/DE/PT/IT
- `vocab_lang.npy` filters
- UI language toggle

---

## 6. Frontend (display only)

- Consume extended `/health` fields.
- Navbar online chip shows profile (if any) + short model label + `embedding_dim` + device.
- No model dropdown, no settings modal switcher.
- If health fails mid-swap, existing offline UX applies.

---

## 7. Tests (mandatory per slice)

| Area | Examples |
| :--- | :--- |
| Catalog | profile resolve; unknown profile → error; no-go ids absent |
| Encode adapter | E5 prefix applied; truncate_dim shapes; L2 norm |
| NPZ | roundtrip keys; mismatch detection |
| `/health` | new fields present |
| SAE | dim change clears session model |
| setup helper | env upsert + rollback path (if implemented in Python) |
| Smoke (manual OK) | 10 EN↔ES pairs cosine; document expected “soft” threshold (do not hardcode 0.82 as CI gate unless measured) |

Prefer fast unit tests without downloading large models in CI when possible (mock `SentenceTransformer`). Optional marked integration test for MiniLM if cache available.

---

## 8. Documentation sync (when contracts land)

| Asset | Update when |
| :--- | :--- |
| `architecture_spec.md` | `/health` fields; model selection contract; encode adapter |
| `CONTEXT.md` | terms: Model Profile, Embedding Catalog, Active Model, Truncate Dim |
| `.env.example` | `MODEL_PROFILE`, `TRUNCATE_DIM`, comments |
| `README.md` | setup option 11; local profiles; note HF deferred |
| `CHANGELOG.md` | on release / notable merge |
| `manifest.json` | if `state_schema` / constraints gain `embedding_dim` or profile |

HF Space docs: **mention deferred only** — do not change publish path.

---

## 9. Implementation slices (short, serial, agent-sized)

Work **one slice per session**. Do not parallelize. Each slice ends at **APPROVAL GATE** (no push/merge without explicit human OK).

### Slice 1 — Embedding catalog + selection types

**Branch:** `feat/multillm` (reuse across slices) or `feat/multillm-catalog` for first PR — human preference at gate.

**Tasks:**

1. Add catalog module (profiles + models §2.1–§2.2; exclude §2.3).
2. `ModelSelection` dataclass/typed dict: hub_id, profile, trust_remote_code, e5_mode, truncate_dim, gated, short_label.
3. `resolve_profile` + `get_model` APIs.
4. Unit tests for resolve / unknown / catalog completeness.
5. Stub contract note for upcoming `/health` fields in `architecture_spec.md` (or defer literal prose to Slice 2 if cleaner).

**DoD:** tests green; no setup.sh UI yet; no model download required.

---

### Slice 2 — Encode adapter + AppState wiring + `/health`

**Tasks:**

1. `build_model` / `encode_texts` with E5 prefixes + optional truncate + L2.
2. Wire `AppState.load_model_and_vocab` to catalog + env (`MODEL_PROFILE`, `TRUNCATE_DIM`).
3. Extend `/health` JSON (§4.3).
4. On dim mismatch vs SAE: clear SAE (unit test with fake dims).
5. Tests with mocks; update `architecture_spec.md` `/health`.

**DoD:** backend loads selection from env; health exposes profile/dim; SAE clears on dim change.

---

### Slice 3 — Precompute script + NPZ validation

**Tasks:**

1. Extend `scripts/precompute_vocab_embeddings.py` to use catalog + `--truncate-dim` + richer NPZ metadata.
2. AppState: refuse or rebuild path when NPZ `model_name`/dim mismatch (implement §3.3 preference: auto-precompute with loud warning **or** hard fail — pick one and test).
3. Tests for NPZ roundtrip metadata.

**DoD:** `uv run python scripts/precompute_vocab_embeddings.py --help` shows new flags; mismatch handled safely.

---

### Slice 4 — EN+ES vocabulary merge

**Tasks:**

1. Add ES seed list + merge helper into active vocab path scheme.
2. Document how option 6 / scripts produce EN∪ES.
3. Smoke/pytest that merged vocab contains required demo pairs (king/rey, …) as strings (not cosine yet).
4. Update `.env.example` / README note.

**DoD:** operator can produce an EN+ES vocab file and precompute against MiniLM multi.

---

### Slice 5 — `setup.sh` option 11 (swap pipeline)

**Tasks:**

1. Menu entry + submenu (profiles + catalog list, no preview table).
2. Call Python helper for: resolve → stage → precompute → commit `.env` → restart backend → print health.
3. Rollback on precompute/auth failure.
4. Ensure option 1 still works with new env keys.
5. Manual checklist in slice report (gated Gemma may need human HF token).

**DoD:** from a clean terminal, operator can switch `local-comfort` ↔ `local-full` ↔ EN baseline and see new model on `/health` after restart.

---

### Slice 6 — Navbar display + polish

**Tasks:**

1. Frontend reads `model_profile`, `embedding_dim`, short label.
2. Vitest for health mapping / label formatting if logic is non-trivial.
3. Copy pass (English UI).
4. `CONTEXT.md` terms; `CHANGELOG` pending section; README option 11.

**DoD:** GUI shows active profile/model/dim; docs synced; epic ready for human SemVer decision.

---

### Slice 7 (optional — only if human asks in-session) — Cross-lingual smoke harness

**Tasks:**

1. Script `scripts/smoke_crosslingual_cosine.py` for 10 EN↔ES pairs (+ optional encode-only FR strings; FR not required in vocab file).
2. Prints mean cosine; **non-blocking** exit unless `--strict` + threshold.
3. Document how to run after option 11.

**DoD:** researcher can compare MiniLM vs Arctic on the same pair list locally.

---

## 10. Follow-ups (explicitly later)

| ID | Item | Notes |
| :--- | :--- | :--- |
| F1 | HF Space model policy | Many approval gates; possibly freeze Space on `hf-demo` MiniLM |
| F2 | Multi-NPZ artifacts in Docker | Only if F1 proceeds |
| F3 | `vocab_lang` + neighbor language filter | API + UI |
| F4 | FR/DE/PT/IT vocab expansion | After EN+ES proven |
| F5 | Web UI model switcher | Explicitly not now |
| F6 | Multi-model residency / A-B in one process | Explicitly not now |
| F7 | Matryoshka UI control (live truncate dim) | Optional; env is enough for v1 |

---

## 11. Risks & mitigations

| Risk | Mitigation |
| :--- | :--- |
| Gated Gemma breaks unattended swap | Fail + rollback; document `hf auth login` |
| `trust_remote_code` supply chain | Limit to catalog allowlist |
| E5 used without prefixes → bad geometry | Central encode adapter + tests |
| NPZ/model skew after crash mid-swap | Atomic/stage strategy in Slice 5 |
| SAE NaNs after dim change | Hard clear on mismatch (M10) |
| EN+ES vocab encode time on M4 | Bound N; progress bar in precompute |
| Scope creep into HF | M11 + folder README ban |

---

## 12. Definition of Done (epic)

- [ ] Catalog + profiles implemented and tested
- [ ] `setup.sh` option 11 swaps model with mandatory NPZ regenerate + backend restart
- [ ] One active model only; `/health` + navbar reflect profile/model/dim/device
- [ ] EN+ES vocab path works for demo pairs
- [ ] SAE clears on dim change
- [ ] E5/Arctic/GTE special cases work via adapter
- [ ] No HF Space publish/build changes
- [ ] Docs: architecture_spec, CONTEXT, .env.example, README, CHANGELOG (as applicable)
- [ ] Human OK on default profile (`local-comfort` vs keep mpnet) before calling release done

---

## 13. Suggested git / SemVer

- Epic branch: `feat/multillm`
- Slice PRs or serial commits on same branch — human preference at approval gate
- Likely **MINOR** when option 11 ships

---

## 14. Traceability to research conclusions

| Research verdict | Roadmap mapping |
| :--- | :--- |
| MiniLM multi = Comfort / demo default | Profile `local-comfort` + `hf-demo` preset |
| Arctic = Full | Profile `local-full` |
| gte / e5 / embeddinggemma = options | Catalog entries |
| Vocab EN-only blocks Arithmetic multi | Slice 4 EN+ES |
| HF later with approvals | M11, F1–F2 |
| One model at a time | M8 |
| setup.sh always available | M3 / Slice 5 |
| Show in GUI, switch only setup | M9 / Slice 6 |

---

## 15. Cross-lingual demo pairs (for Slice 4 seed + Slice 7 smoke)

**EN↔ES pairs (must appear in merged vocab when possible):**

`king/rey`, `queen/reina`, `man/hombre`, `woman/mujer`, `apple/manzana`, `computer/computadora`, `water/agua`, `peace/paz`, `dog/perro`, `cat/gato`

**Encode-only triads (optional smoke; FR need not be in vocab file yet):**

`brother/hermano/frère`, `city/ciudad/ville`, `sun/sol/soleil`, `book/libro/livre`, `truth/verdad/vérité`
