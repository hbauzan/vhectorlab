"""
Cross-lingual cosine helpers for smoke harness (multillm Slice 7).

Pure math + pair tables — encode happens in the CLI script.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from backend.vocab_merge import DEMO_PAIRS

# Encode-only FR triads (FR need not be in vocab file).
FR_TRIADS: tuple[tuple[str, str, str], ...] = (
    ("brother", "hermano", "frère"),
    ("city", "ciudad", "ville"),
    ("sun", "sol", "soleil"),
    ("book", "libro", "livre"),
    ("truth", "verdad", "vérité"),
)

DEFAULT_SOFT_THRESHOLD = 0.35


@dataclass(frozen=True, slots=True)
class PairScore:
    left: str
    right: str
    cosine: float


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    va = np.asarray(a, dtype=np.float64).reshape(-1)
    vb = np.asarray(b, dtype=np.float64).reshape(-1)
    if va.shape != vb.shape:
        raise ValueError(f"dim mismatch: {va.shape} vs {vb.shape}")
    na = float(np.linalg.norm(va))
    nb = float(np.linalg.norm(vb))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return float(np.dot(va, vb) / (na * nb))


def score_pairs(
    embeddings: dict[str, np.ndarray],
    pairs: tuple[tuple[str, str], ...] = DEMO_PAIRS,
) -> list[PairScore]:
    scores: list[PairScore] = []
    for left, right in pairs:
        if left not in embeddings or right not in embeddings:
            raise KeyError(f"missing embedding for pair {left!r}/{right!r}")
        scores.append(
            PairScore(
                left=left,
                right=right,
                cosine=cosine_similarity(embeddings[left], embeddings[right]),
            )
        )
    return scores


def mean_cosine(scores: list[PairScore]) -> float:
    if not scores:
        return 0.0
    return float(sum(s.cosine for s in scores) / len(scores))
