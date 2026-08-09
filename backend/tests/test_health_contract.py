"""Health contract fields without loading SentenceTransformer."""

from __future__ import annotations

from backend.model_catalog import resolve_profile
from backend.routers import core as core_mod
from backend.state import AppState


def test_health_includes_profile_and_dims(monkeypatch):
    stub = AppState()
    stub.is_loaded = True
    sel = resolve_profile("local-comfort")
    stub.selection = sel
    stub.model_name = sel.hub_id
    stub.model_profile = sel.profile
    stub.embedding_dim = 384
    stub.truncate_dim = None
    stub.vocab_words = ["a", "b"]
    stub.device = "cpu"
    monkeypatch.setattr(core_mod, "state", stub)

    data = core_mod.health_check()
    assert data["status"] == "ok"
    assert data["model"] == sel.hub_id
    assert data["model_profile"] == "local-comfort"
    assert data["short_label"] == "MiniLM-multi"
    assert data["embedding_dim"] == 384
    assert data["truncate_dim"] is None
    assert data["vocab_size"] == 2
    assert data["device"] == "cpu"
    assert data["is_loaded"] is True
