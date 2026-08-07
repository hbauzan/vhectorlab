"""Unit tests for device resolution and vocab NPZ cache (no SentenceTransformer)."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from backend.device import get_optimal_device
from backend.state import AppState, load_vocab_embeddings_npz


def test_get_optimal_device_cpu_forced():
    assert get_optimal_device("CPU") == "cpu"
    assert get_optimal_device("cpu") == "cpu"


def test_load_vocab_embeddings_npz_roundtrip(tmp_path: Path):
    words = ["king", "queen", "man"]
    embeddings = np.array(
        [
            [1.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 1.0],
        ],
        dtype=np.float32,
    )
    path = tmp_path / "vocab_embeddings.npz"
    np.savez_compressed(
        path,
        words=np.array(words, dtype=object),
        embeddings=embeddings,
        model_name=np.array("all-mpnet-base-v2"),
    )

    loaded_words, loaded_emb, model_name = load_vocab_embeddings_npz(path)
    assert loaded_words == words
    assert loaded_emb.shape == (3, 3)
    assert model_name == "all-mpnet-base-v2"
    np.testing.assert_allclose(loaded_emb, embeddings)


def test_load_vocab_embeddings_npz_rejects_bad_shape(tmp_path: Path):
    path = tmp_path / "bad.npz"
    np.savez_compressed(
        path,
        words=np.array(["a", "b"], dtype=object),
        embeddings=np.zeros((3, 4), dtype=np.float32),
    )
    with pytest.raises(ValueError, match="shape mismatch"):
        load_vocab_embeddings_npz(path)


def test_app_state_defaults_device_cpu():
    app = AppState()
    assert app.device == "cpu"
    assert app.is_loaded is False
