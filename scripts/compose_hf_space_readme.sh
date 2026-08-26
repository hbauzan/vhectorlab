#!/usr/bin/env bash
# Compose HF Space README = YAML frontmatter + project README body (no duplicate fence).
# Usage: compose_hf_space_readme.sh <frontmatter.yml> <readme.md> <out.md>
set -euo pipefail

fm="${1:?frontmatter path required}"
src="${2:?readme path required}"
out="${3:?output path required}"

if [ ! -f "$fm" ]; then
    echo "compose_hf_space_readme: missing frontmatter: $fm" >&2
    exit 1
fi
if [ ! -f "$src" ]; then
    echo "compose_hf_space_readme: missing readme: $src" >&2
    exit 1
fi

# Strip a leading YAML frontmatter block from the project README if present.
# Also drop local demo GIF embeds — Space tip excludes demo/ (HF binary / Xet policy).
strip_leading_frontmatter() {
    awk '
        BEGIN { in_fm = 0; started = 0 }
        NR == 1 && /^---[[:space:]]*$/ { in_fm = 1; next }
        in_fm && /^---[[:space:]]*$/ { in_fm = 0; started = 1; next }
        in_fm { next }
        /demo\/.*\.(gif|mp4|webm|mov)/ { next }
        started && /^[[:space:]]*$/ && !printed { next }
        { printed = 1; print }
    ' "$1"
}

{
    first="$(head -n 1 "$fm" | tr -d '\r')"
    if [ "$first" = "---" ]; then
        cat "$fm"
    else
        echo "---"
        cat "$fm"
        echo "---"
    fi
    # Guarantee a blank line between closing --- and markdown body.
    echo ""
    strip_leading_frontmatter "$src"
} > "$out"

# Hard contract checks — fail closed before any Space push.
if ! head -n 1 "$out" | grep -qx -- '---'; then
    echo "compose_hf_space_readme: output must start with ---" >&2
    exit 1
fi
if ! grep -qE '^sdk:[[:space:]]*docker[[:space:]]*$' "$out"; then
    echo "compose_hf_space_readme: missing sdk: docker in composed README" >&2
    exit 1
fi
if ! grep -qE '^app_port:[[:space:]]*7860[[:space:]]*$' "$out"; then
    echo "compose_hf_space_readme: missing app_port: 7860 in composed README" >&2
    exit 1
fi
