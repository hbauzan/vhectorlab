# VHectorLab 3D — Backend

FastAPI service for this **study / laboratory** tool: semantic embeddings, vector arithmetic (`A − B + C`), tokenize, and compare APIs that drive the WebGL UI.

This is **not** a production multi-tenant API. Prefer the [public Hugging Face demo](https://huggingface.co/spaces/hbauzan/llm-semantic-visualizer) for a quick look, or run the full stack locally via the root [`../README.md`](../README.md) (`./setup.sh`).

## Requirements & setup

From this directory (macOS + [`uv`](https://docs.astral.sh/uv/)):

```bash
uv sync --extra dev
uv run pytest
uv run python -m server
```

Default listen address comes from the repo `.env` / `.env.example` (`HOST` / `PORT`, typically `127.0.0.1:8000`).

## License

Apache License 2.0 — see [`../LICENSE`](../LICENSE) and [`../NOTICE`](../NOTICE).
