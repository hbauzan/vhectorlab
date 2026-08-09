#!/usr/bin/env python3
"""
Precompute L2-normalized vocabulary embeddings for fast Space/Docker boot.

Uses the embedding catalog adapter (E5 prefixes / truncate_dim / L2).

Writes NPZ with keys:
  words: object array of strings (lowercased, same order as vocab.txt)
  embeddings: float32 (N, D) L2-normalized
  model_name: scalar string (Hub id)
  embedding_dim: scalar int
  truncate_dim: scalar int (optional; only when set)
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


def _repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def precompute(
    *,
    selection,
    vocab_path: Path,
    out_path: Path,
    device: str,
) -> None:
    from backend.model_catalog import build_model, encode_texts
    from backend.vocab_embeddings import save_vocab_embeddings_npz

    if not vocab_path.is_file():
        raise FileNotFoundError(f"Vocab not found: {vocab_path}")

    with open(vocab_path, encoding="utf-8") as f:
        words = [line.strip().lower() for line in f if line.strip()]

    if not words:
        raise ValueError(f"Empty vocabulary: {vocab_path}")

    print(
        f"Loading model {selection.hub_id!r} "
        f"(truncate_dim={selection.truncate_dim!r}, e5_mode={selection.e5_mode}) "
        f"on {device!r}…"
    )
    model = build_model(selection, device=device)

    print(f"Encoding {len(words)} words…")
    embeddings = encode_texts(model, words, selection, show_progress_bar=True)

    save_vocab_embeddings_npz(
        out_path,
        words=words,
        embeddings=embeddings,
        model_name=selection.hub_id,
        truncate_dim=selection.truncate_dim,
    )
    size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f"Wrote {out_path} ({size_mb:.1f} MiB, shape={embeddings.shape})")


def main() -> int:
    root = _repo_root()
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    from backend.device import get_optimal_device
    from backend.model_catalog import resolve_selection

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--model",
        default=os.getenv("MODEL_NAME", "all-mpnet-base-v2"),
        help="Hub id or bare catalog name (ignored when --profile is set)",
    )
    parser.add_argument(
        "--profile",
        default=os.getenv("MODEL_PROFILE") or None,
        help="Named profile: local-comfort | local-full | hf-demo",
    )
    parser.add_argument(
        "--truncate-dim",
        type=int,
        default=None,
        help="Matryoshka truncate width (overrides profile default; env TRUNCATE_DIM)",
    )
    parser.add_argument(
        "--vocab",
        type=Path,
        default=Path(os.getenv("VOCAB_PATH", str(root / "public" / "vocab.txt"))),
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(
            os.getenv(
                "VOCAB_EMBEDDINGS_PATH",
                str(root / "public" / "vocab_embeddings.npz"),
            )
        ),
    )
    parser.add_argument(
        "--device",
        default=os.getenv("SAE_DEVICE", "CPU"),
        help="AUTO|CPU|CUDA|MPS (default CPU for Docker builds)",
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

    vocab = args.vocab if args.vocab.is_absolute() else root / args.vocab
    out = args.out if args.out.is_absolute() else root / args.out
    device = get_optimal_device(args.device)

    precompute(selection=selection, vocab_path=vocab, out_path=out, device=device)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
