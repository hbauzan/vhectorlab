# SAE artifacts

Compare-scope Top-K SAE checkpoint: `sae_weights.pt` (gitignored).

Created by `POST /api/sae/train`. Deleted by `POST /api/sae/clear` (Retrain confirm in UI).
Loaded automatically on `/api/sae/status` and `/api/sae/encode`.

## Benchmark cache

`benchmark_cache.json` is the machine-local micro-benchmark written by `scripts/benchmark_models.py`. Gitignored. Delete it to drop stored throughput; the next benchmark recreates it.
