"""Unit tests for encode adapter + env selection (mocked SentenceTransformer)."""

from __future__ import annotations

from dataclasses import replace
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from backend.model_catalog import (
    ModelSelection,
    encode_texts,
    get_model,
    resolve_profile,
    resolve_selection_from_env,
)


class _FakeEncoder:
    """Captures encode inputs; returns fixed-width vectors from text length."""

    def __init__(self, dim: int = 4) -> None:
        self.dim = dim
        self.last_texts: list[str] | None = None

    def encode(self, texts, **kwargs):
        if isinstance(texts, str):
            texts = [texts]
        self.last_texts = list(texts)
        out = np.zeros((len(texts), self.dim), dtype=np.float32)
        for i, t in enumerate(texts):
            out[i, 0] = float(len(t))
            out[i, 1] = 1.0 if str(t).startswith("query:") else 0.0
            out[i, 2] = 1.0  # non-zero so L2 is well-defined
        return out

    def get_sentence_embedding_dimension(self) -> int:
        return self.dim


def _sel(**overrides) -> ModelSelection:
    base = ModelSelection(
        hub_id="intfloat/multilingual-e5-small",
        profile=None,
        trust_remote_code=False,
        e5_mode=True,
        truncate_dim=None,
        gated=False,
        short_label="E5-small-multi",
    )
    return replace(base, **overrides) if overrides else base


def test_encode_texts_applies_e5_query_prefix():
    model = _FakeEncoder()
    encode_texts(model, ["king", "queen"], _sel(e5_mode=True))
    assert model.last_texts == ["query: king", "query: queen"]


def test_encode_texts_skips_prefix_when_not_e5():
    model = _FakeEncoder()
    encode_texts(model, ["king"], _sel(e5_mode=False))
    assert model.last_texts == ["king"]


def test_encode_texts_truncate_dim_and_l2():
    model = _FakeEncoder(dim=4)
    vecs = encode_texts(
        model,
        ["a", "bb"],
        _sel(e5_mode=False, truncate_dim=2),
    )
    assert vecs.shape == (2, 2)
    norms = np.linalg.norm(vecs, axis=1)
    np.testing.assert_allclose(norms, np.ones(2), atol=1e-5)


def test_encode_texts_single_string_returns_1d():
    model = _FakeEncoder(dim=4)
    vec = encode_texts(model, "hello", _sel(e5_mode=False))
    assert vec.ndim == 1
    assert vec.shape[0] == 4
    assert abs(float(np.linalg.norm(vec)) - 1.0) < 1e-5


def test_resolve_selection_from_env_profile(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("TRUNCATE_DIM", raising=False)
    monkeypatch.setenv("MODEL_PROFILE", "local-comfort")
    monkeypatch.delenv("MODEL_NAME", raising=False)
    sel = resolve_selection_from_env()
    assert sel.profile == "local-comfort"
    assert sel.hub_id == resolve_profile("local-comfort").hub_id
    assert sel.truncate_dim is None


def test_resolve_selection_from_env_truncate_override(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("MODEL_PROFILE", "local-full")
    monkeypatch.setenv("TRUNCATE_DIM", "768")
    sel = resolve_selection_from_env()
    assert sel.profile == "local-full"
    assert sel.truncate_dim == 768


def test_resolve_selection_from_env_model_name_alias(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("MODEL_PROFILE", raising=False)
    monkeypatch.delenv("TRUNCATE_DIM", raising=False)
    monkeypatch.setenv("MODEL_NAME", "all-mpnet-base-v2")
    sel = resolve_selection_from_env()
    assert sel.hub_id == "sentence-transformers/all-mpnet-base-v2"
    assert sel.profile is None


def test_get_model_accepts_bare_name():
    sel = get_model("paraphrase-multilingual-MiniLM-L12-v2")
    assert sel.hub_id.endswith("paraphrase-multilingual-MiniLM-L12-v2")


def test_build_model_passes_trust_remote_code():
    from backend.model_catalog import build_model

    sel = get_model("Snowflake/snowflake-arctic-embed-m-v2.0")
    fake = MagicMock(name="SentenceTransformer")
    with patch("sentence_transformers.SentenceTransformer", fake):
        build_model(sel, device="cpu")
    fake.assert_called_once()
    kwargs = fake.call_args.kwargs
    assert kwargs.get("trust_remote_code") is True
    assert kwargs.get("device") == "cpu"
