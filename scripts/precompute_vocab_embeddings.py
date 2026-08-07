#!/usr/bin/env python3
"""
Precompute L2-normalized vocabulary embeddings for fast Space/Docker boot.

Writes NPZ with keys:
  words: object array of strings (lowercased, same order as vocab.txt)
  embeddings: float32 (N, D) L2-normalized
  model_name: scalar string
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import numpy as np


def _repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def precompute(
    *,
    model_name: str,
    vocab_path: Path,
    out_path: Path,
    device: str,
) -> None:
    from sentence_transformers import SentenceTransformer

    if not vocab_path.is_file():
        raise FileNotFoundError(f"Vocab not found: {vocab_path}")

    with open(vocab_path, encoding="utf-8") as f:
        words = [line.strip().lower() for line in f if line.strip()]

    if not words:
        raise ValueError(f"Empty vocabulary: {vocab_path}")

    print(f"Loading model {model_name!r} on {device!r}…")
    model = SentenceTransformer(model_name, device=device)

    print(f"Encoding {len(words)} words…")
    raw = model.encode(words, show_progress_bar=True, convert_to_numpy=True)
    norms = np.linalg.norm(raw, axis=1, keepdims=True)
    norms[norms == 0] = 1e-9
    embeddings = (raw / norms).astype(np.float32)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        out_path,
        words=np.array(words, dtype=object),
        embeddings=embeddings,
        model_name=np.array(model_name),
    )
    size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f"Wrote {out_path} ({size_mb:.1f} MiB, shape={embeddings.shape})")


def main() -> int:
    root = _repo_root()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--model",
        default=os.getenv("MODEL_NAME", "all-mpnet-base-v2"),
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

    sys.path.insert(0, str(root))
    from backend.device import get_optimal_device

    vocab = args.vocab if args.vocab.is_absolute() else root / args.vocab
    out = args.out if args.out.is_absolute() else root / args.out
    device = get_optimal_device(args.device)

    precompute(model_name=args.model, vocab_path=vocab, out_path=out, device=device)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
