#!/usr/bin/env bash
# Smoke tests for scripts/compose_hf_space_readme.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="$ROOT/scripts/compose_hf_space_readme.sh"
FM="$ROOT/deploy/hf/space-frontmatter.yml"
fail=0

assert() {
    local name="$1"
    shift
    if eval "$@"; then
        echo "OK  $name"
    else
        echo "FAIL $name" >&2
        fail=1
    fi
}

tmp_out="$(mktemp)"
tmp_readme="$(mktemp)"
tmp_fm="$(mktemp)"
cleanup() { rm -f "$tmp_out" "$tmp_readme" "$tmp_fm"; }
trap cleanup EXIT

# 1) Real project README + canonical frontmatter
"$COMPOSE" "$FM" "$ROOT/README.md" "$tmp_out"
assert "starts with fence" 'head -n 1 "$tmp_out" | grep -qx -- "---"'
assert "has sdk docker" 'grep -qE "^sdk:[[:space:]]*docker[[:space:]]*$" "$tmp_out"'
assert "has app_port 7860" 'grep -qE "^app_port:[[:space:]]*7860[[:space:]]*$" "$tmp_out"'
assert "body title once" 'test "$(grep -c "^# VHectorLab 3D$" "$tmp_out")" -eq 1'

# 2) Source README already has frontmatter — must not nest fences
cat > "$tmp_readme" <<'EOF'
---
title: Old
sdk: gradio
app_port: 9999
---

# Body Title

hello
EOF
"$COMPOSE" "$FM" "$tmp_readme" "$tmp_out"
assert "no nested old sdk" '! grep -q "sdk: gradio" "$tmp_out"'
assert "no nested old port" '! grep -q "app_port: 9999" "$tmp_out"'
assert "keeps body" 'grep -qx "# Body Title" "$tmp_out"'
assert "single closing fence before body" 'test "$(awk "/^---\$/{c++} END{print c+0}" "$tmp_out")" -eq 2'

# 3) Frontmatter without fences still works
cat > "$tmp_fm" <<'EOF'
title: Bare
sdk: docker
app_port: 7860
EOF
echo '# Bare Body' > "$tmp_readme"
"$COMPOSE" "$tmp_fm" "$tmp_readme" "$tmp_out"
assert "bare fm wrapped" 'head -n 1 "$tmp_out" | grep -qx -- "---"'
assert "bare body present" 'grep -qx "# Bare Body" "$tmp_out"'

# 4) Missing sdk must fail
cat > "$tmp_fm" <<'EOF'
---
title: Bad
app_port: 7860
---
EOF
if "$COMPOSE" "$tmp_fm" "$tmp_readme" "$tmp_out" 2>/dev/null; then
    echo "FAIL missing-sdk should exit non-zero" >&2
    fail=1
else
    echo "OK  missing-sdk rejected"
fi

if [ "$fail" -ne 0 ]; then
    exit 1
fi
echo "All compose_hf_space_readme checks passed."
