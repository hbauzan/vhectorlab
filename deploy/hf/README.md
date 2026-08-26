# Hugging Face Space publish assets

GitHub keeps a normal project `README.md` (no Space YAML).

HF Spaces still require YAML frontmatter on the Space repo’s root `README.md`
(`sdk: docker`, `app_port: 7860`, …). See
[Spaces Configuration Reference](https://huggingface.co/docs/hub/spaces-config-reference).

## Files

| File | Role |
| :--- | :--- |
| `space-frontmatter.yml` | Canonical Space card / Docker contract (fenced with `---`) |

## How it is applied

`./setup.sh` → **option 8** (`publish_hf_space`):

1. Builds production frontend (smoke).
2. Composes `frontmatter + README.md` body via `scripts/compose_hf_space_readme.sh` (drops local `demo/*` media embeds).
3. Creates an **orphan** ephemeral commit with `commit-tree` (no parent — so GitHub history with demo GIFs is not packed), stripping `demo/*` / gifs from the tree. Working tree / GitHub `main` unchanged.
4. Force-pushes that orphan tip to the Space remote (always `--force`; orphan cannot fast-forward).

Linux image builds use `torch` from the PyTorch **cpu** wheel index (`backend/pyproject.toml` `[tool.uv.sources]`), not CUDA/`nvidia-*` from PyPI.

Override path with env `HF_SPACE_FRONTMATTER` (default: `deploy/hf/space-frontmatter.yml`).
