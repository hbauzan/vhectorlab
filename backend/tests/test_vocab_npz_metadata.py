"""NPZ metadata roundtrip + selection compatibility (no SentenceTransformer)."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

import numpy as np
import pytest
from backend.model_catalog import ModelSelection, get_model, resolve_profile
from backend.state import AppState
from backend.vocab_embeddings import (
    load_vocab_embeddings_npz,
    npz_compatible_with_selection,
    save_vocab_embeddings_npz,
)


def test_npz_roundtrip_metadata(tmp_path: Path):
    words = ["king", "queen"]
    embeddings = np.eye(2, 4, dtype=np.float32)
    path = tmp_path / "vocab.npz"
    save_vocab_embeddings_npz(
        path,
        words=words,
        embeddings=embeddings,
        model_name="Snowflake/snowflake-arctic-embed-m-v2.0",
        truncate_dim=4,
    )
    cache = load_vocab_embeddings_npz(path)
    assert cache.words == words
    assert cache.model_name == "Snowflake/snowflake-arctic-embed-m-v2.0"
    assert cache.truncate_dim == 4
    assert cache.embedding_dim == 4
    np.testing.assert_allclose(cache.embeddings, embeddings)


def test_npz_roundtrip_without_truncate(tmp_path: Path):
    path = tmp_path / "vocab.npz"
    save_vocab_embeddings_npz(
        path,
        words=["a"],
        embeddings=np.ones((1, 3), dtype=np.float32),
        model_name="sentence-transformers/all-mpnet-base-v2",
        truncate_dim=None,
    )
    cache = load_vocab_embeddings_npz(path)
    assert cache.truncate_dim is None
    assert cache.embedding_dim == 3


def test_npz_compatible_matching_profile():
    sel = resolve_profile("local-full")
    cache_words = ["x"]
    emb = np.zeros((1, 256), dtype=np.float32)
    from backend.vocab_embeddings import VocabEmbeddingsCache

    cache = VocabEmbeddingsCache(
        words=cache_words,
        embeddings=emb,
        model_name=sel.hub_id,
        truncate_dim=256,
        embedding_dim=256,
    )
    ok, reason = npz_compatible_with_selection(cache, sel)
    assert ok is True
    assert reason is None


def test_npz_incompatible_wrong_model():
    sel = get_model("sentence-transformers/all-mpnet-base-v2")
    from backend.vocab_embeddings import VocabEmbeddingsCache

    cache = VocabEmbeddingsCache(
        words=["x"],
        embeddings=np.zeros((1, 768), dtype=np.float32),
        model_name="intfloat/multilingual-e5-small",
        truncate_dim=None,
        embedding_dim=768,
    )
    ok, reason = npz_compatible_with_selection(cache, sel)
    assert ok is False
    assert reason is not None
    assert "model_name" in reason


def test_npz_incompatible_wrong_dim():
    sel = resolve_profile("local-full")  # truncate 256
    from backend.vocab_embeddings import VocabEmbeddingsCache

    cache = VocabEmbeddingsCache(
        words=["x"],
        embeddings=np.zeros((1, 768), dtype=np.float32),
        model_name=sel.hub_id,
        truncate_dim=768,
        embedding_dim=768,
    )
    ok, reason = npz_compatible_with_selection(cache, sel)
    assert ok is False
    assert reason is not None


def test_appstate_rebuilds_npz_on_mismatch(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    vocab = tmp_path / "vocab.txt"
    vocab.write_text("king\nqueen\n", encoding="utf-8")
    stale = tmp_path / "vocab_embeddings.npz"
    save_vocab_embeddings_npz(
        stale,
        words=["king", "queen"],
        embeddings=np.eye(2, 8, dtype=np.float32),
        model_name="wrong-model",
        truncate_dim=8,
    )

    sel = ModelSelection(
        hub_id="sentence-transformers/all-mpnet-base-v2",
        profile=None,
        trust_remote_code=False,
        e5_mode=False,
        truncate_dim=None,
        gated=False,
        short_label="EN baseline (mpnet)",
    )

    fake_model = MagicMock()
    fake_model.get_sentence_embedding_dimension.return_value = 4

    def fake_encode(batch, **kwargs):
        n = len(batch) if not isinstance(batch, str) else 1
        return np.ones((n, 4), dtype=np.float32)

    fake_model.encode.side_effect = fake_encode

    monkeypatch.setattr(
        "backend.state.build_model", lambda selection, device: fake_model
    )
    monkeypatch.setattr("backend.device.get_optimal_device", lambda env: "cpu")

    app = AppState()
    app.load_model_and_vocab(
        vocab_path=str(vocab),
        vocab_embeddings_path=str(stale),
        selection=sel,
        device_env="CPU",
    )
    assert app.is_loaded
    assert app.vocab_embeddings is not None
    assert app.vocab_embeddings.shape == (2, 4)
    rebuilt = load_vocab_embeddings_npz(stale)
    assert rebuilt.model_name == sel.hub_id
    assert rebuilt.embedding_dim == 4
