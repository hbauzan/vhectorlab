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
2. Composes `frontmatter + README.md` body via `scripts/compose_hf_space_readme.sh`.
3. Creates an ephemeral git commit with `commit-tree` (working tree / GitHub `main` unchanged).
4. Force-pushes that tip to the Space remote (`HF_SPACE_FORCE_PUSH=1` by default).

Override path with env `HF_SPACE_FRONTMATTER` (default: `deploy/hf/space-frontmatter.yml`).
