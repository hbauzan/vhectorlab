"""Tests for POST /project (UMAP dimensionality reduction)."""

from __future__ import annotations

from contextlib import asynccontextmanager

import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient


@pytest.fixture()
def client():
    """Lightweight app with core router only (no model load)."""
    from backend.routers.core import router as core_router

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
    app.include_router(core_router)
    app.include_router(core_router, prefix="/api")

    with TestClient(app) as c:
        yield c


def _random_vectors(n: int = 24, dim: int = 32, seed: int = 0) -> list[list[float]]:
    rng = np.random.default_rng(seed)
    mat = rng.standard_normal((n, dim)).astype(np.float64)
    norms = np.linalg.norm(mat, axis=1, keepdims=True)
    norms[norms == 0] = 1e-9
    return (mat / norms).tolist()


def test_project_rejects_empty_vectors(client: TestClient):
    res = client.post(
        "/project",
        json={"vectors": [], "method": "umap", "n_components": 3, "seed": 42},
    )
    assert res.status_code == 400
    assert "empty" in res.json()["detail"].lower() or "1" in res.json()["detail"]


def test_project_rejects_too_many_vectors(client: TestClient):
    vecs = _random_vectors(n=2, dim=4)
    bloated = vecs * 513  # 1026
    res = client.post(
        "/project",
        json={"vectors": bloated, "method": "umap", "n_components": 3},
    )
    assert res.status_code == 400
    assert "1024" in res.json()["detail"]


def test_project_rejects_inconsistent_dims(client: TestClient):
    res = client.post(
        "/project",
        json={
            "vectors": [[1.0, 0.0], [0.0, 1.0, 0.0]],
            "method": "umap",
            "n_components": 2,
        },
    )
    assert res.status_code == 400
    assert "dim" in res.json()["detail"].lower()


def test_project_rejects_invalid_n_components(client: TestClient):
    res = client.post(
        "/project",
        json={"vectors": _random_vectors(8, 8), "method": "umap", "n_components": 4},
    )
    assert res.status_code == 422  # pydantic Field constraint


@pytest.mark.parametrize("method", ["pca", "tsne"])
def test_project_pca_tsne_not_implemented(client: TestClient, method: str):
    res = client.post(
        "/project",
        json={
            "vectors": _random_vectors(12, 8),
            "method": method,
            "n_components": 3,
            "seed": 42,
        },
    )
    assert res.status_code == 501
    detail = res.json()["detail"].lower()
    assert method in detail
    assert "not implemented" in detail or "umap" in detail


def test_project_rejects_unknown_method(client: TestClient):
    res = client.post(
        "/project",
        json={
            "vectors": _random_vectors(12, 8),
            "method": "mds",
            "n_components": 3,
        },
    )
    assert res.status_code == 400
    assert "umap" in res.json()["detail"].lower()


def test_project_umap_smoke_3d_seeded(client: TestClient):
    vectors = _random_vectors(n=20, dim=16, seed=7)
    payload = {
        "vectors": vectors,
        "method": "umap",
        "n_components": 3,
        "seed": 42,
        "params": {"n_neighbors": 5, "min_dist": 0.1, "metric": "cosine"},
    }
    res = client.post("/project", json=payload)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["method"] == "umap"
    assert data["n_components"] == 3
    assert len(data["positions"]) == 20
    assert all(len(p) == 3 for p in data["positions"])

    meta = data["meta"]
    assert meta["seed"] == 42
    assert meta["n_neighbors"] == 5
    assert meta["min_dist"] == pytest.approx(0.1)
    assert meta["metric"] == "cosine"

    # Server-side normalize: approximately zero-mean
    pos = np.asarray(data["positions"], dtype=np.float64)
    means = pos.mean(axis=0)
    assert np.allclose(means, 0.0, atol=1e-5)

    # Same inputs → same positions (seeded)
    res2 = client.post("/project", json=payload)
    assert res2.status_code == 200
    pos2 = np.asarray(res2.json()["positions"], dtype=np.float64)
    assert np.allclose(pos, pos2, atol=1e-5)


def test_project_umap_n_components_2(client: TestClient):
    vectors = _random_vectors(n=16, dim=12, seed=3)
    res = client.post(
        "/project",
        json={
            "vectors": vectors,
            "method": "umap",
            "n_components": 2,
            "seed": 42,
            "params": {"n_neighbors": 5},
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["n_components"] == 2
    assert all(len(p) == 2 for p in data["positions"])


def test_project_umap_pre_pca_when_high_dim(client: TestClient):
    """dim > 50 triggers internal PCA→50 before UMAP; meta reports pre_pca_dims."""
    vectors = _random_vectors(n=60, dim=128, seed=1)
    res = client.post(
        "/project",
        json={
            "vectors": vectors,
            "method": "umap",
            "n_components": 3,
            "seed": 42,
            "params": {"n_neighbors": 8},
        },
    )
    assert res.status_code == 200, res.text
    meta = res.json()["meta"]
    assert meta["pre_pca_dims"] == 50


def test_project_small_n_one_vector(client: TestClient):
    """Token Comparison with a single token must still project (Galaxy path)."""
    vectors = _random_vectors(n=1, dim=32, seed=2)
    res = client.post(
        "/project",
        json={"vectors": vectors, "method": "umap", "n_components": 3, "seed": 42},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert len(data["positions"]) == 1
    assert len(data["positions"][0]) == 3
    assert data["meta"]["fallback"] == "origin"
    assert data["positions"][0] == pytest.approx([0.0, 0.0, 0.0])


def test_project_small_n_two_vectors_pair(client: TestClient):
    """Two tokens (e.g. White, Blanco) — UMAP cannot run; PCA micro-layout."""
    vectors = _random_vectors(n=2, dim=64, seed=9)
    payload = {
        "vectors": vectors,
        "method": "umap",
        "n_components": 3,
        "seed": 42,
    }
    res = client.post("/project", json=payload)
    assert res.status_code == 200, res.text
    data = res.json()
    assert len(data["positions"]) == 2
    assert all(len(p) == 3 for p in data["positions"])
    assert data["meta"]["fallback"] == "pca_micro"
    assert data["meta"]["pca_components"] == 1

    pos = np.asarray(data["positions"], dtype=np.float64)
    assert np.allclose(pos.mean(axis=0), 0.0, atol=1e-5)
    # Distinct points on an axis after normalize
    assert float(np.linalg.norm(pos[0] - pos[1])) > 0.5

    res2 = client.post("/project", json=payload)
    assert res2.status_code == 200
    assert np.allclose(pos, np.asarray(res2.json()["positions"]), atol=1e-5)


def test_project_module_unit_rejects_method():
    from backend.projection import ProjectError, project_embeddings

    with pytest.raises(ProjectError) as ei:
        project_embeddings(
            _random_vectors(10, 8),
            method="pca",
            n_components=3,
            seed=42,
        )
    assert ei.value.status_code == 501
