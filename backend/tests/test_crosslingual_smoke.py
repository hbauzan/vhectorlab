"""Unit tests for cross-lingual smoke math (no SentenceTransformer)."""

from __future__ import annotations

import numpy as np
import pytest
from backend.crosslingual_smoke import (
    cosine_similarity,
    mean_cosine,
    score_pairs,
)
from backend.vocab_merge import DEMO_PAIRS


def test_cosine_identical_is_one():
    v = np.array([1.0, 2.0, 3.0], dtype=np.float32)
    assert abs(cosine_similarity(v, v) - 1.0) < 1e-6


def test_cosine_orthogonal_is_zero():
    a = np.array([1.0, 0.0], dtype=np.float32)
    b = np.array([0.0, 1.0], dtype=np.float32)
    assert abs(cosine_similarity(a, b)) < 1e-6


def test_score_pairs_mean():
    emb = {}
    for en, es in DEMO_PAIRS:
        # Same vector → cos=1 for every pair
        emb[en] = np.array([1.0, 0.0], dtype=np.float32)
        emb[es] = np.array([1.0, 0.0], dtype=np.float32)
    scores = score_pairs(emb, DEMO_PAIRS)
    assert len(scores) == len(DEMO_PAIRS)
    assert abs(mean_cosine(scores) - 1.0) < 1e-6


def test_score_pairs_missing_raises():
    with pytest.raises(KeyError):
        score_pairs({"king": np.ones(2)}, (("king", "rey"),))
