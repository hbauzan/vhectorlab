"""Engine API: status, structural-noise detection, and disk/RAM cache."""

from __future__ import annotations

import time
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

REPO_NPZ = Path(__file__).resolve().parents[2] / "public" / "vocab_embeddings.npz"
EXPECTED_NOISE = [38, 58, 65, 80, 297, 329, 376, 386, 404, 549, 577, 616, 780]

_STATE_FIELDS = (
    "model",
    "model_name",
    "model_profile",
    "embedding_dim",
    "selection",
    "vocab_words",
    "vocab_embeddings",
    "is_loaded",
    "device",
    "noise_profile",
)


@pytest.fixture()
def profiles_dir(tmp_path, monkeypatch):
    import backend.routers.engine as engine_mod

    dest = tmp_path / "noise_profiles"
    dest.mkdir()
    monkeypatch.setattr(engine_mod, "NOISE_PROFILES_DIR", dest)
    return dest


@pytest.fixture()
def client(profiles_dir):
    from backend.routers.engine import router as engine_router
    from backend.state import state

    saved = {name: getattr(state, name, None) for name in _STATE_FIELDS}
    saved["vocab_words"] = list(state.vocab_words)

    state.model = object()
    state.model_name = "stub-model"
    state.model_profile = "local-test"
    state.embedding_dim = 64
    state.selection = None
    state.vocab_words = [f"w{i}" for i in range(100)]
    state.vocab_embeddings = None
    state.is_loaded = True
    state.device = "cpu"
    state.noise_profile = None

    @asynccontextmanager
    async def _noop(_app):
        yield

    app = FastAPI(lifespan=_noop)
    app.include_router(engine_router, prefix="/api")

    with TestClient(app) as test_client:
        yield test_client

    for name in _STATE_FIELDS:
        setattr(state, name, saved[name])


def test_engine_status_endpoint(client):
    from backend.state import state

    res = client.get("/api/engine/status")
    assert res.status_code == 200
    data = res.json()
    assert data["model_name"] == state.model_name == "stub-model"
    assert data["model_profile"] == "local-test"
    assert data["embedding_dim"] == 64
    assert data["accelerator"] == state.device == "cpu"
    assert data["is_loaded"] is True
    assert data["has_cached_profile"] is False
    assert data["vocab_size"] == 100


def test_engine_detect_structural_noise_computation_and_cache(client, profiles_dir):
    from backend.state import state

    rng = np.random.default_rng(0)
    state.vocab_embeddings = rng.normal(0.0, 0.02, size=(100, 64)).astype(np.float32)
    state.model_name = "stub-model"
    state.noise_profile = None

    res = client.post("/api/engine/detect-structural-noise", json={})
    assert res.status_code == 200
    first = res.json()
    for key in (
        "model_name",
        "embedding_dim",
        "noise_indices",
        "saturated_indices",
        "flat_indices",
        "energy_ratio",
        "cosine_delta",
        "timestamp_utc",
    ):
        assert key in first
    assert first["model_name"] == "stub-model"
    assert first["embedding_dim"] == 64
    assert isinstance(first["noise_indices"], list)
    written = profiles_dir / "stub-model.json"
    assert written.is_file()

    started = time.perf_counter()
    cached = client.post("/api/engine/detect-structural-noise", json={})
    elapsed_ms = (time.perf_counter() - started) * 1000.0
    assert cached.status_code == 200
    assert cached.json() == first
    assert elapsed_ms < 15.0

    state.noise_profile = None
    status = client.get("/api/engine/status")
    assert status.status_code == 200
    assert status.json()["has_cached_profile"] is True
    from_disk = client.post("/api/engine/detect-structural-noise", json={})
    assert from_disk.status_code == 200
    assert from_disk.json() == first


def test_engine_noise_profile_get_and_404(client):
    from backend.state import state

    missing = client.get("/api/engine/noise-profile")
    assert missing.status_code == 404

    rng = np.random.default_rng(1)
    state.vocab_embeddings = rng.normal(0.0, 0.02, size=(40, 16)).astype(np.float32)
    state.embedding_dim = 16
    created = client.post("/api/engine/detect-structural-noise", json={})
    assert created.status_code == 200

    found = client.get("/api/engine/noise-profile")
    assert found.status_code == 200
    assert found.json() == created.json()

    state.noise_profile = None
    reloaded = client.get("/api/engine/noise-profile")
    assert reloaded.status_code == 200
    assert reloaded.json() == created.json()


def test_engine_detect_fail_closed_unloaded_state(client):
    from backend.state import state

    state.vocab_embeddings = None
    state.model = None
    state.noise_profile = None

    res = client.post("/api/engine/detect-structural-noise", json={})
    assert res.status_code == 503
    assert "detail" in res.json()


def test_engine_detect_real_npz_latency(client, profiles_dir):
    from backend.state import state

    npz = np.load(REPO_NPZ, allow_pickle=True)
    embeddings = npz["embeddings"]
    state.vocab_embeddings = embeddings
    state.model_name = str(npz["model_name"])
    state.embedding_dim = int(embeddings.shape[1])
    state.vocab_words = [f"t{i}" for i in range(embeddings.shape[0])]
    state.noise_profile = None

    started = time.perf_counter()
    res = client.post("/api/engine/detect-structural-noise?force_recompute=true")
    cold_ms = (time.perf_counter() - started) * 1000.0
    assert res.status_code == 200, res.text
    body = res.json()
    assert cold_ms < 150.0, f"cold detect took {cold_ms:.2f} ms"
    assert body["noise_indices"] == EXPECTED_NOISE
    assert body["energy_ratio"] == pytest.approx(0.1980)
    assert body["cosine_delta"] == pytest.approx(0.1152)
    assert (profiles_dir / "BAAI_bge-m3.json").is_file()

    started = time.perf_counter()
    cached = client.post("/api/engine/detect-structural-noise", json={})
    cached_ms = (time.perf_counter() - started) * 1000.0
    assert cached.status_code == 200
    assert cached.json() == body
    assert cached_ms < 15.0, f"cached detect took {cached_ms:.2f} ms"

    forced = client.post("/api/engine/detect-structural-noise?force_recompute=true")
    assert forced.status_code == 200
    forced_body = forced.json()
    assert forced_body["noise_indices"] == EXPECTED_NOISE
    assert forced_body["timestamp_utc"] != body["timestamp_utc"]
    print(f"ENGINE_LATENCY cold_ms={cold_ms:.3f} cached_ms={cached_ms:.3f}")


def test_engine_detect_single_row_without_model_is_503(client):
    from backend.state import state

    state.model = None
    state.noise_profile = None
    state.vocab_embeddings = np.ones((1, 8), dtype=np.float32)
    one = client.post("/api/engine/detect-structural-noise", json={})
    assert one.status_code == 503

    state.vocab_embeddings = np.ones((0, 8), dtype=np.float32)
    empty = client.post("/api/engine/detect-structural-noise", json={})
    assert empty.status_code == 503


def test_load_model_clears_noise_profile_only_when_reload_proceeds(monkeypatch):
    from backend.model_catalog import resolve_profile
    from backend.state import AppState
    from backend.structural_noise import ModelNoiseProfile

    profile = ModelNoiseProfile(
        model_name="old",
        embedding_dim=4,
        noise_indices=(1,),
        saturated_indices=(1,),
        flat_indices=(),
        energy_ratio=0.1,
        cosine_delta=0.2,
        timestamp_utc="2026-10-26T00:00:00+00:00",
    )
    held = AppState()
    held.is_loaded = True
    held.noise_profile = profile
    held.load_model_and_vocab(selection=resolve_profile("local-comfort"))
    assert held.noise_profile is profile

    fresh = AppState()
    fresh.noise_profile = profile

    def _stop_build(*_args, **_kwargs):
        raise RuntimeError("build stopped")

    monkeypatch.setattr("backend.state.build_model", _stop_build)
    with pytest.raises(RuntimeError, match="build stopped"):
        fresh.load_model_and_vocab(selection=resolve_profile("local-comfort"))
    assert fresh.noise_profile is None


def test_engine_detect_encodes_vocab_deck_when_matrix_missing(client, monkeypatch):
    from backend.state import state

    state.vocab_embeddings = None
    state.model = object()
    state.selection = object()
    state.model_name = "deck-model"
    seen: dict[str, object] = {}

    def _fake_encode(model, words, selection, show_progress_bar=False):
        seen["model"] = model
        seen["n"] = len(words)
        seen["selection"] = selection
        rng = np.random.default_rng(2)
        return rng.normal(0.0, 0.02, size=(len(words), 8)).astype(np.float32)

    monkeypatch.setattr("backend.routers.engine.encode_texts", _fake_encode)

    res = client.post("/api/engine/detect-structural-noise", json={})
    assert res.status_code == 200
    assert seen["model"] is state.model
    assert seen["selection"] is state.selection
    assert 2 <= int(seen["n"]) <= 500
    assert res.json()["embedding_dim"] == 8
