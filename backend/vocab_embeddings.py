"""
Vocab embeddings NPZ cache — load/save metadata + selection compatibility.

Strategy (multillm Slice 3 / §3.3): on model_name or dim mismatch, AppState
logs a loud warning and re-encodes from the vocab text file (auto-rebuild),
then overwrites the NPZ when a path is available.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from backend.model_catalog import ModelSelection


@dataclass(frozen=True, slots=True)
class VocabEmbeddingsCache:
    words: list[str]
    embeddings: np.ndarray
    model_name: str | None = None
    truncate_dim: int | None = None
    embedding_dim: int | None = None


def _scalar_str(raw: Any) -> str | None:
    if raw is None:
        return None
    if hasattr(raw, "item"):
        try:
            return str(raw.item())
        except (ValueError, TypeError):
            pass
    text = str(raw).strip()
    return text or None


def _scalar_int(raw: Any) -> int | None:
    if raw is None:
        return None
    if hasattr(raw, "item"):
        try:
            raw = raw.item()
        except (ValueError, TypeError):
            pass
    if raw is None or raw == "":
        return None
    return int(raw)


def load_vocab_embeddings_npz(npz_path: Path) -> VocabEmbeddingsCache:
    """Load precomputed vocab embeddings NPZ (words, embeddings, optional metadata)."""
    data = np.load(npz_path, allow_pickle=True)
    if "words" not in data or "embeddings" not in data:
        raise ValueError(f"Invalid vocab embeddings file (missing keys): {npz_path}")
    words = [str(w).strip().lower() for w in data["words"].tolist()]
    embeddings = np.asarray(data["embeddings"], dtype=np.float32)
    if embeddings.ndim != 2 or len(words) != embeddings.shape[0]:
        raise ValueError(
            f"Vocab NPZ shape mismatch: words={len(words)} embeddings={embeddings.shape}"
        )
    model_name = _scalar_str(data["model_name"]) if "model_name" in data else None
    truncate_dim = _scalar_int(data["truncate_dim"]) if "truncate_dim" in data else None
    embedding_dim = (
        _scalar_int(data["embedding_dim"]) if "embedding_dim" in data else None
    )
    if embedding_dim is None:
        embedding_dim = int(embeddings.shape[1])
    return VocabEmbeddingsCache(
        words=words,
        embeddings=embeddings,
        model_name=model_name,
        truncate_dim=truncate_dim,
        embedding_dim=embedding_dim,
    )


def save_vocab_embeddings_npz(
    npz_path: Path,
    *,
    words: list[str],
    embeddings: np.ndarray,
    model_name: str,
    truncate_dim: int | None = None,
) -> None:
    """Write compressed NPZ with forward-compatible metadata keys."""
    arr = np.asarray(embeddings, dtype=np.float32)
    if arr.ndim != 2 or len(words) != arr.shape[0]:
        raise ValueError(f"Cannot save NPZ: words={len(words)} embeddings={arr.shape}")
    npz_path.parent.mkdir(parents=True, exist_ok=True)
    payload: dict[str, Any] = {
        "words": np.array(words, dtype=object),
        "embeddings": arr,
        "model_name": np.array(model_name),
        "embedding_dim": np.array(int(arr.shape[1])),
    }
    if truncate_dim is not None:
        payload["truncate_dim"] = np.array(int(truncate_dim))
    else:
        # Explicit null-ish marker for readers (omit key = legacy unknown)
        pass
    np.savez_compressed(npz_path, **payload)


def _names_compatible(cached: str, hub_id: str) -> bool:
    if cached == hub_id:
        return True
    return cached.split("/")[-1] == hub_id.split("/")[-1]


def npz_compatible_with_selection(
    cache: VocabEmbeddingsCache,
    selection: ModelSelection,
) -> tuple[bool, str | None]:
    """
    Return (ok, reason). reason is set when incompatible.

    Checks Hub id (when present) and effective embedding width vs truncate_dim.
    """
    if cache.model_name and not _names_compatible(cache.model_name, selection.hub_id):
        return (
            False,
            f"model_name={cache.model_name!r} != {selection.hub_id!r}",
        )

    expected_dim = selection.truncate_dim
    actual_dim = int(cache.embeddings.shape[1])
    if expected_dim is not None and actual_dim != expected_dim:
        return (
            False,
            f"embedding width {actual_dim} != truncate_dim={expected_dim}",
        )

    if (
        cache.truncate_dim is not None
        and selection.truncate_dim is not None
        and cache.truncate_dim != selection.truncate_dim
    ):
        return (
            False,
            f"npz truncate_dim={cache.truncate_dim} != {selection.truncate_dim}",
        )

    if (
        selection.truncate_dim is None
        and cache.truncate_dim is not None
        and cache.truncate_dim != actual_dim
    ):
        # Cached under a truncate that current selection no longer uses
        return (
            False,
            f"npz was truncated to {cache.truncate_dim} but selection has no truncate_dim",
        )

    return True, None
