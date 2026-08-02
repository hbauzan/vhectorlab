"""API tests for /sae/status, /sae/train, /sae/encode, /sae/clear."""

from __future__ import annotations

import time
from contextlib import asynccontextmanager

import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """App client with SAE checkpoint path in temp dir."""
    import backend.routers.sae as sae_router_mod
    from backend.routers.core import router as core_router
    from backend.sae.sae_model import SAEManager
    from backend.sae.train_sae import get_optimal_device
    from backend.state import state

    weights = tmp_path / "sae_weights.pt"
    monkeypatch.setattr(sae_router_mod, "SAE_WEIGHTS_PATH", str(weights))
    sae_router_mod.sae_manager = SAEManager(
        device=get_optimal_device("CPU"),
        weights_path=str(weights),
    )
    sae_router_mod.sae_training_status = sae_router_mod.SAETrainingStatus()

    # Core health still expects loaded state; SAE train no longer needs vocab matrix
    state.model = object()
    state.model_name = "test-stub"
    state.vocab_words = []
    state.vocab_embeddings = None
    state.is_loaded = True

    @asynccontextmanager
    async def _noop_lifespan(_app):
        yield

    app = FastAPI(lifespan=_noop_lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(core_router, prefix="/api")
    app.include_router(sae_router_mod.router, prefix="/api")

    with TestClient(app) as c:
        yield c


def _scope_embeddings(n: int = 24, dim: int = 768, seed: int = 0) -> list[list[float]]:
    rng = np.random.default_rng(seed)
    mat = rng.standard_normal((n, dim)).astype(np.float32)
    norms = np.linalg.norm(mat, axis=1, keepdims=True)
    norms[norms == 0] = 1e-9
    mat = mat / norms
    return mat.tolist()


def _wait_train(client: TestClient, timeout_s: float = 120.0) -> dict:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        res = client.get("/api/sae/status")
        assert res.status_code == 200
        data = res.json()
        st = data["training"]["status"]
        if st == "success" and data["is_trained"]:
            return data
        if st == "failed":
            pytest.fail(f"SAE train failed: {data['training'].get('error_message')}")
        time.sleep(0.25)
    pytest.fail("SAE train timed out")


def test_sae_encode_without_train_404(client):
    res = client.post("/api/sae/encode", json={"embeddings": [[0.0] * 768]})
    assert res.status_code == 404


def test_sae_status_shape(client):
    res = client.get("/api/sae/status")
    assert res.status_code == 200
    data = res.json()
    assert data["is_trained"] is False
    assert data["ephemeral"] is False
    assert data["persisted"] is False
    assert "training" in data


def test_sae_train_requires_embeddings(client):
    res = client.post(
        "/api/sae/train",
        json={"hidden_dim": 128, "k": 8, "epochs": 1},
    )
    assert res.status_code == 422


def test_sae_train_persists_and_reloads(client, tmp_path):
    import backend.routers.sae as sae_router_mod
    from backend.sae.sae_model import SAEManager
    from backend.sae.train_sae import get_optimal_device

    embeddings = _scope_embeddings(n=16)
    res = client.post(
        "/api/sae/train",
        json={
            "embeddings": embeddings,
            "hidden_dim": 128,
            "k": 8,
            "epochs": 2,
            "auto_scale": False,
        },
    )
    assert res.status_code == 200
    status = _wait_train(client)
    assert status["persisted"] is True
    assert status["is_trained"] is True
    weights = status["weights_path"]
    assert weights and __import__("os").path.exists(weights)

    # Simulate backend restart: new manager pointing at same file
    sae_router_mod.sae_manager = SAEManager(
        device=get_optimal_device("CPU"),
        weights_path=weights,
    )
    reloaded = client.get("/api/sae/status").json()
    assert reloaded["is_trained"] is True
    assert reloaded["config"]["hidden_dim"] == 128

    enc = client.post("/api/sae/encode", json={"embeddings": embeddings[:1]})
    assert enc.status_code == 200
    assert enc.json()["dimension"] == 128


def test_sae_train_scope_auto_scale_and_encode(client):
    embeddings = _scope_embeddings(n=24)
    res = client.post(
        "/api/sae/train",
        json={
            "embeddings": embeddings,
            "hidden_dim": 8192,
            "k": 32,
            "epochs": 2,
            "lr": 1e-3,
            "batch_size": 16,
            "auto_scale": True,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "training"
    assert body["n_vectors"] == 24
    assert body["resolved_hidden"] < 8192
    assert body["resolved_epochs"] <= 50
    assert body["auto_scaled"] is True

    status = _wait_train(client)
    assert status["config"]["hidden_dim"] == body["resolved_hidden"]
    assert status["config"]["k"] == body["resolved_k"]
    assert "mse" in status["metrics"]
    assert status["metrics"]["total_vectors"] == 24

    enc = client.post(
        "/api/sae/encode",
        json={"embeddings": embeddings[:2]},
    )
    assert enc.status_code == 200
    enc_body = enc.json()
    assert enc_body["count"] == 2
    assert enc_body["dimension"] == body["resolved_hidden"]
    assert enc_body["format"] == "topk_sparse"
    assert "activations" not in enc_body
    assert len(enc_body["indices"]) == 2
    assert len(enc_body["values"]) == 2
    k = body["resolved_k"]
    for idx_row, val_row in zip(enc_body["indices"], enc_body["values"], strict=True):
        assert len(idx_row) == k
        assert len(val_row) == k
        for d in idx_row:
            assert 0 <= d < enc_body["dimension"]
        nonzero = sum(1 for v in val_row if v > 0)
        assert nonzero <= k


def test_sae_encode_keeps_model_in_ram(client, monkeypatch):
    """Second encode must not re-torch.load the checkpoint (singleton in RAM)."""
    embeddings = _scope_embeddings(n=12)
    res = client.post(
        "/api/sae/train",
        json={
            "embeddings": embeddings,
            "hidden_dim": 64,
            "k": 4,
            "epochs": 1,
            "auto_scale": False,
        },
    )
    assert res.status_code == 200
    _wait_train(client)

    import backend.routers.sae as sae_router_mod
    import torch

    load_calls = {"n": 0}
    real_load = torch.load

    def counting_load(*args, **kwargs):
        load_calls["n"] += 1
        return real_load(*args, **kwargs)

    monkeypatch.setattr(torch, "load", counting_load)
    # Warm model into RAM (may load once)
    assert client.post("/api/sae/encode", json={"embeddings": embeddings[:1]}).status_code == 200
    loads_after_first = load_calls["n"]
    assert (
        client.post("/api/sae/encode", json={"embeddings": embeddings[:2]}).status_code
        == 200
    )
    assert load_calls["n"] == loads_after_first


def test_sae_clear_invalidates_session(client):
    embeddings = _scope_embeddings(n=16)
    res = client.post(
        "/api/sae/train",
        json={
            "embeddings": embeddings,
            "hidden_dim": 128,
            "k": 8,
            "epochs": 2,
            "auto_scale": False,
        },
    )
    assert res.status_code == 200
    _wait_train(client)

    cleared = client.post("/api/sae/clear")
    assert cleared.status_code == 200
    assert cleared.json()["is_trained"] is False

    status = client.get("/api/sae/status").json()
    assert status["is_trained"] is False

    enc = client.post("/api/sae/encode", json={"embeddings": embeddings[:1]})
    assert enc.status_code == 404
