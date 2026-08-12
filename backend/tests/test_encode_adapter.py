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
    with (
        patch("sentence_transformers.SentenceTransformer", fake),
        patch("backend.model_catalog._repair_gte_nonpersistent_buffers") as repair,
    ):
        build_model(sel, device="cpu")
    fake.assert_called_once()
    kwargs = fake.call_args.kwargs
    assert kwargs.get("trust_remote_code") is True
    assert kwargs.get("device") == "cpu"
    # Arctic Hub config enables xformers MEA + unpad; disable both without xformers.
    assert kwargs.get("config_kwargs") == {
        "use_memory_efficient_attention": False,
        "unpad_inputs": False,
    }
    repair.assert_called_once_with(fake.return_value)


def test_build_model_skips_config_kwargs_without_trust_remote():
    from backend.model_catalog import build_model

    sel = get_model("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    fake = MagicMock(name="SentenceTransformer")
    with (
        patch("sentence_transformers.SentenceTransformer", fake),
        patch("backend.model_catalog._repair_gte_nonpersistent_buffers") as repair,
    ):
        build_model(sel, device="cpu")
    kwargs = fake.call_args.kwargs
    assert "trust_remote_code" not in kwargs
    assert "config_kwargs" not in kwargs
    repair.assert_not_called()


def test_repair_gte_nonpersistent_buffers_restores_position_ids_and_rope():
    import torch
    from backend.model_catalog import _repair_gte_nonpersistent_buffers

    class _Emb(torch.nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.register_buffer(
                "position_ids",
                torch.tensor([0, 99, -1], dtype=torch.long),
                persistent=False,
            )
            rotary = torch.nn.Module()
            rotary.dim = 4
            rotary.base = 10000.0
            rotary.max_position_embeddings = 8
            rotary.register_buffer(
                "inv_freq", torch.zeros(2, dtype=torch.float32), persistent=False
            )

            def _set_cos_sin_cache(seq_len, device, dtype):
                rotary.max_seq_len_cached = seq_len
                rotary.register_buffer(
                    "cos_cached",
                    torch.ones(seq_len, rotary.dim, device=device, dtype=dtype),
                    persistent=False,
                )
                rotary.register_buffer(
                    "sin_cached",
                    torch.zeros(seq_len, rotary.dim, device=device, dtype=dtype),
                    persistent=False,
                )

            rotary._set_cos_sin_cache = _set_cos_sin_cache
            self.rotary_emb = rotary

    class _Auto(torch.nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.embeddings = _Emb()
            self.lin = torch.nn.Linear(2, 2)  # provides parameters()/device
            self.config = type("C", (), {"max_position_embeddings": 8})()

    class _TransformerMod:
        def __init__(self, auto: _Auto) -> None:
            self.auto_model = auto

    class _ST:
        def __init__(self) -> None:
            self._first = _TransformerMod(_Auto())

        def __getitem__(self, idx: int):
            assert idx == 0
            return self._first

    st = _ST()
    _repair_gte_nonpersistent_buffers(st)
    emb = st[0].auto_model.embeddings
    assert torch.equal(emb.position_ids, torch.arange(3, dtype=torch.long))
    assert torch.all(emb.rotary_emb.inv_freq > 0)
    assert emb.rotary_emb.cos_cached.shape[0] == 8
    assert emb.rotary_emb.sin_cached.shape[0] == 8
