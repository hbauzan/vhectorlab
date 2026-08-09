# Prompt — agent Multi-embedding / `multillm`

Copy-paste the block for a **new** session.  
Canonical roadmap: [`multillm.md`](./multillm.md) (2026-08-09).  
Folder index: [`README.md`](./README.md).

**Work mode:** **serial** — one session / one slice. Do not launch parallel agents.  
Start at **Slice 1** unless the human names another slice.

---

## Master kickoff (Slice 1) — paste this

```text
Using dev-protocol, implement the multillm epic — embedding model catalog + setup.sh selection.

## Context
Repo: VHectorLab 3D (Python/uv + Vite/Three.js).
Base: update `main` first (`git pull`) if applicable.
Canonical roadmap — read it COMPLETELY before any code:
  `roadmap/multillm/multillm.md`
Also read: `roadmap/multillm/README.md`
Lessons: `.agents/skills/dev-protocol/lessons-learned.md`
Architecture: `architecture_spec.md`
UI: legacy app only (`src/main.js`, `src/ui/*`, …). Do not revive retired `/v25/` or `/amiga/` routes.

## Locked decisions (do NOT re-ask)
- Embedding SentenceTransformer models only — NOT generative LLMs.
- Profiles: `local-comfort`, `local-full`, `hf-demo` (hf-demo is a LOCAL preset only).
- Catalog: required models in roadmap §2.1 + inferred extras §2.2; exclude §2.3 no-go list.
- setup.sh dedicated menu option (suggested 11) always available to swap.
- No RAM/D preview table in the menu (short labels only).
- Swap always regenerates vocab NPZ; one active model; backend restart.
- GUI shows active model via /health; switch ONLY from setup.sh.
- SAE clears on embedding dim change.
- Vocab languages this epic: EN+ES only.
- vocab_lang filters: follow-up (out of scope).
- Hugging Face Space publish/build/model policy: OUT OF SCOPE. Do not change options 7/8 behavior for models. Any HF work later needs many human approval gates.
- E5 prefixes / trust_remote_code / gated Gemma handled in backend catalog adapter.
- Prefer staging: precompute success → commit .env; failure → keep old .env.

## Slice to execute in THIS session
Slice 1 — Embedding catalog + selection types
(from `roadmap/multillm/multillm.md` §9)

### Definition of Done — Slice 1
1. Catalog module (single source of truth) with profiles + models §2.1–§2.2.
2. Typed ModelSelection (hub_id, profile, trust_remote_code, e5_mode, truncate_dim, gated, short_label).
3. resolve_profile / get_model APIs.
4. Unit tests: resolve, unknown profile, catalog completeness, no-go ids absent.
5. Branch `feat/multillm` (or `feat/multillm-catalog` if splitting PRs).
6. APPROVAL GATE: report what changed + how to run tests; WAIT for explicit human OK before push/merge.

### Do NOT implement now
Slices 2–7 (AppState wiring, precompute flags, EN+ES vocab, setup.sh option 11, navbar, smoke harness).
No HF Space changes. No web UI model switcher. No multi-model residency.

## Style
No-fluff; TDD; deep modules; do not expand scope.
If a contract is ambiguous: ASK — do not guess.
Follow `.agents/skills/dev-protocol/SKILL.md`
(clarify → branch → implement → verify → conditional doc-sync → approval gate → git delivery only after OK).
```

---

## Slice 2 — paste when Slice 1 is OK / merged

```text
Using dev-protocol, continue multillm — ONLY Slice 2.

Roadmap: `roadmap/multillm/multillm.md` §9 Slice 2 + §4.
Out of scope: HF Space, setup.sh option 11, EN+ES vocab file work, web switcher.

DoD:
- build_model / encode_texts (E5 prefixes, truncate_dim, L2).
- AppState loads MODEL_PROFILE / MODEL_NAME / TRUNCATE_DIM via catalog.
- /health adds model_profile, embedding_dim, truncate_dim (keep existing fields).
- SAE session clears when input_dim != embedding_dim (tested).
- architecture_spec.md updated for /health + encode adapter.
- Tests green (mock SentenceTransformer where possible).
- APPROVAL GATE — wait for human OK before push/merge.
```

---

## Slice 3 — paste when Slice 2 is OK

```text
Using dev-protocol, continue multillm — ONLY Slice 3.

Roadmap: `roadmap/multillm/multillm.md` §9 Slice 3 + §4.5 + §3.3.

DoD:
- scripts/precompute_vocab_embeddings.py uses catalog; supports --truncate-dim; richer NPZ metadata.
- NPZ mismatch vs MODEL_NAME/dim handled safely (document chosen strategy: auto-precompute with loud warning OR hard fail).
- Tests for NPZ roundtrip metadata.
- No setup.sh menu UI yet unless trivial helper CLI is needed for later Slice 5.
- APPROVAL GATE — wait for human OK.
```

---

## Slice 4 — paste when Slice 3 is OK

```text
Using dev-protocol, continue multillm — ONLY Slice 4.

Roadmap: `roadmap/multillm/multillm.md` §9 Slice 4 + §5 + §15.

DoD:
- EN+ES vocab scheme (merged file or EN∪ES helper) — languages beyond EN+ES forbidden.
- Seed includes demo pairs from §15 (king/rey, …).
- Test/assert required strings present after merge.
- .env.example / README note for vocab merge.
- No vocab_lang filters. No HF.
- APPROVAL GATE — wait for human OK.
```

---

## Slice 5 — paste when Slice 4 is OK

```text
Using dev-protocol, continue multillm — ONLY Slice 5.

Roadmap: `roadmap/multillm/multillm.md` §9 Slice 5 + §3.

DoD:
- setup.sh new option (suggested 11): Select Embedding Model / Profile.
- Submenu: profiles + catalog short labels (NO RAM preview table).
- Pipeline: resolve → precompute vocab NPZ → commit .env on success → restart backend → print /health.
- Rollback .env on precompute/auth failure.
- Option 1 still boots whatever .env specifies.
- Do NOT change HF options 7/8 model policy.
- APPROVAL GATE — wait for human OK. Include manual test notes for local-comfort ↔ local-full ↔ EN baseline.
```

---

## Slice 6 — paste when Slice 5 is OK

```text
Using dev-protocol, continue multillm — ONLY Slice 6.

Roadmap: `roadmap/multillm/multillm.md` §9 Slice 6 + §6 + §8.

DoD:
- Navbar/online chip shows profile (if any) + short model label + embedding_dim + device from /health.
- No in-app model switcher.
- Vitest if formatting logic is non-trivial.
- CONTEXT.md terms; README option 11; CHANGELOG note; architecture_spec if any UI contract.
- Ask human to confirm default profile for .env.example (local-comfort vs keep mpnet) before finalizing.
- APPROVAL GATE — wait for human OK before push/merge/release bump.
```

---

## Slice 7 (optional) — only if human explicitly requests

```text
Using dev-protocol, continue multillm — ONLY optional Slice 7.

Roadmap: `roadmap/multillm/multillm.md` §9 Slice 7 + §15.

DoD:
- scripts/smoke_crosslingual_cosine.py for EN↔ES pairs (+ optional FR encode-only).
- Non-blocking by default; --strict optional.
- Document usage after setup option 11.
- APPROVAL GATE — wait for human OK.
```

---

## Agent reminders (all slices)

- English for code comments, UI strings, and docs touched in this epic.
- Never push/merge without explicit human OK (dev-protocol approval gate).
- Never implement HF Space model migration in this epic.
- Prefer `uv` / `pnpm` per project rules; TDD for backend seams.
