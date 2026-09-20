# Epic — Multi-LLM / Multi-Embedding Model Selection

**Status:** Plan (ready to implement)  
**Date:** 2026-08-09  
**Product:** VHectorLab 3D — local bare-metal first  
**Canonical roadmap:** [`multillm.md`](./multillm.md)  
**Agent kickoff:** [`PROMPT-multillm.md`](./PROMPT-multillm.md)

## One-sentence goal

Let the operator pick among several local **SentenceTransformer embedding models** (and named profiles) from `setup.sh`, regenerate vocab embeddings automatically, restart with **one active model**, and surface that model in the GUI — without touching Hugging Face Space publish until many human approval gates later.

## Docs in this folder

| File | Role |
| :--- | :--- |
| [`multillm.md`](./multillm.md) | Full roadmap: locked decisions, catalog, slices, DoD, follow-ups |
| [`PROMPT-multillm.md`](./PROMPT-multillm.md) | Serial agent prompts (`Using dev-protocol…`) per slice |

## Explicitly deferred (do not implement in this epic)

- Hugging Face Space model swap / multi-NPZ Docker builds
- `vocab_lang` neighbor language filters
- Vocab languages beyond **EN + ES**
- Loading multiple models in RAM at once
- In-app (web UI) model switcher
