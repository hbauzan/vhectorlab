#!/usr/bin/env python3
"""
Smoke: mean cosine for EN↔ES demo pairs under the active embedding model.

Non-blocking by default (exit 0 even if mean is low). Use --strict to fail
when mean cosine < threshold (default soft threshold 0.35 — not a CI hard gate).

Typical flow after setup.sh option 11:
  uv run --directory backend python ../scripts/smoke_crosslingual_cosine.py
  uv run --directory backend python ../scripts/smoke_crosslingual_cosine.py --profile local-comfort
  uv run --directory backend python ../scripts/smoke_crosslingual_cosine.py --include-fr
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


def _repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def main() -> int:
    root = _repo_root()
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    from backend.crosslingual_smoke import (
        DEFAULT_SOFT_THRESHOLD,
        FR_TRIADS,
        mean_cosine,
        score_pairs,
    )
    from backend.device import get_optimal_device
    from backend.model_catalog import build_model, encode_texts, resolve_selection
    from backend.vocab_merge import DEMO_PAIRS

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", default=os.getenv("MODEL_PROFILE") or None)
    parser.add_argument(
        "--model",
        default=os.getenv("MODEL_NAME", "all-mpnet-base-v2"),
    )
    parser.add_argument("--truncate-dim", type=int, default=None)
    parser.add_argument(
        "--device",
        default=os.getenv("SAE_DEVICE", "AUTO"),
    )
    parser.add_argument(
        "--include-fr",
        action="store_true",
        help="Also encode FR triad legs (encode-only; not in vocab file)",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit 1 if EN↔ES mean cosine < --threshold",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=DEFAULT_SOFT_THRESHOLD,
        help=f"Soft threshold for --strict (default {DEFAULT_SOFT_THRESHOLD})",
    )
    args = parser.parse_args()

    truncate = args.truncate_dim
    if truncate is None:
        raw = os.getenv("TRUNCATE_DIM", "").strip()
        truncate = int(raw) if raw else None

    selection = resolve_selection(
        profile=args.profile,
        model_name=args.model,
        truncate_dim=truncate,
    )
    device = get_optimal_device(args.device)

    texts: list[str] = []
    for en, es in DEMO_PAIRS:
        texts.extend([en, es])
    if args.include_fr:
        for en, es, fr in FR_TRIADS:
            texts.extend([en, es, fr])
    # unique preserve order
    seen: set[str] = set()
    unique: list[str] = []
    for t in texts:
        if t not in seen:
            seen.add(t)
            unique.append(t)

    print(
        f"Loading {selection.hub_id!r} "
        f"(profile={selection.profile!r}, truncate_dim={selection.truncate_dim!r}) "
        f"on {device!r}…"
    )
    model = build_model(selection, device=device)
    matrix = encode_texts(model, unique, selection, show_progress_bar=False)
    emb_map = {t: matrix[i] for i, t in enumerate(unique)}

    scores = score_pairs(emb_map, DEMO_PAIRS)
    mean = mean_cosine(scores)
    print("\nEN↔ES pairs:")
    for s in scores:
        print(f"  {s.left:12s} / {s.right:12s}  cos={s.cosine:.4f}")
    print(f"\nMean EN↔ES cosine: {mean:.4f}  (n={len(scores)})")

    if args.include_fr:
        print("\nFR encode-only triads (EN–ES / EN–FR / ES–FR):")
        from backend.crosslingual_smoke import cosine_similarity

        for en, es, fr in FR_TRIADS:
            c_en_es = cosine_similarity(emb_map[en], emb_map[es])
            c_en_fr = cosine_similarity(emb_map[en], emb_map[fr])
            c_es_fr = cosine_similarity(emb_map[es], emb_map[fr])
            print(
                f"  {en}/{es}/{fr}: "
                f"EN-ES={c_en_es:.4f}  EN-FR={c_en_fr:.4f}  ES-FR={c_es_fr:.4f}"
            )

    if args.strict and mean < args.threshold:
        print(
            f"\nSTRICT FAIL: mean {mean:.4f} < threshold {args.threshold:.4f}",
            file=sys.stderr,
        )
        return 1

    if mean < args.threshold:
        print(
            f"\nNote: mean {mean:.4f} is below soft threshold {args.threshold:.4f} "
            "(non-blocking; pass --strict to fail)."
        )
    else:
        print("\nOK (non-blocking smoke).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
