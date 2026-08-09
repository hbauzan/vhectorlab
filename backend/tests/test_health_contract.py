"""Health contract fields without loading SentenceTransformer."""

from __future__ import annotations

from backend.routers import core as core_mod
from backend.state import AppState


def test_health_includes_profile_and_dims(monkeypatch):
    stub = AppState()
    stub.is_loaded = True
    stub.model_name = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    stub.model_profile = "local-comfort"
    stub.embedding_dim = 384
    stub.truncate_dim = None
    stub.vocab_words = ["a", "b"]
    stub.device = "cpu"
    monkeypatch.setattr(core_mod, "state", stub)

    data = core_mod.health_check()
    assert data["status"] == "ok"
    assert data["model"] == stub.model_name
    assert data["model_profile"] == "local-comfort"
    assert data["embedding_dim"] == 384
    assert data["truncate_dim"] is None
    assert data["vocab_size"] == 2
    assert data["device"] == "cpu"
    assert data["is_loaded"] is True
