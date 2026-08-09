"""
Dimensionality reduction for Galaxy VIEW.

Deep seam: project_embeddings(vectors, ...) → positions + meta.
UMAP only in v1; PCA/t-SNE raise ProjectError(501).
"""

from __future__ import annotations

from typing import Any

import numpy as np

PRE_PCA_DIMS = 50
MAX_VECTORS = 1024
DEFAULT_N_NEIGHBORS = 15
DEFAULT_MIN_DIST = 0.1
DEFAULT_METRIC = "cosine"


class ProjectError(Exception):
    """Validation / capability error with HTTP-ish status code."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _as_matrix(vectors: list[list[float]] | np.ndarray) -> np.ndarray:
    if isinstance(vectors, np.ndarray):
        mat = np.asarray(vectors, dtype=np.float64)
    else:
        if not vectors:
            raise ProjectError("vectors list cannot be empty (need 1..1024)")
        lengths = {len(row) for row in vectors}
        if len(lengths) != 1:
            raise ProjectError("all vectors must have the same dimension")
        if next(iter(lengths)) < 1:
            raise ProjectError("vector dimension must be >= 1")
        mat = np.asarray(vectors, dtype=np.float64)

    if mat.ndim != 2:
        raise ProjectError("vectors must be a 2D matrix [n, dim]")
    n, dim = mat.shape
    if n < 1 or n > MAX_VECTORS:
        raise ProjectError(f"len(vectors) must be in 1..{MAX_VECTORS}, got {n}")
    if dim < 1:
        raise ProjectError("vector dimension must be >= 1")
    if not np.isfinite(mat).all():
        raise ProjectError("vectors must contain only finite values")
    return mat


def _normalize_positions(pos: np.ndarray) -> np.ndarray:
    """Zero-mean; scale so RMS distance from origin is 1 (stable camera defaults)."""
    centered = pos - pos.mean(axis=0, keepdims=True)
    rms = float(np.sqrt(np.mean(np.sum(centered**2, axis=1))))
    if rms < 1e-12:
        return centered
    return centered / rms


def _project_small_n(
    mat: np.ndarray, *, n_components: int, seed: int
) -> tuple[np.ndarray, dict[str, Any]]:
    """
    Deterministic layout when UMAP cannot run (n < 3).

    n=1 → origin; n=2 → PCA to 1D padded to n_components (pair on an axis).
    """
    n_samples, dim = mat.shape
    if n_samples == 1:
        pos = np.zeros((1, n_components), dtype=np.float64)
        return pos, {"fallback": "origin"}

    from sklearn.decomposition import PCA

    k = min(n_samples - 1, n_components, dim)
    if k < 1:
        pos = np.zeros((n_samples, n_components), dtype=np.float64)
        return pos, {"fallback": "origin"}

    reduced = PCA(n_components=k, random_state=seed).fit_transform(mat)
    pos = np.zeros((n_samples, n_components), dtype=np.float64)
    pos[:, :k] = reduced
    return pos, {"fallback": "pca_micro", "pca_components": int(k)}


def _resolve_umap_params(
    n_samples: int, params: dict[str, Any] | None
) -> dict[str, Any]:
    raw = params or {}
    n_neighbors = int(raw.get("n_neighbors", DEFAULT_N_NEIGHBORS))
    min_dist = float(raw.get("min_dist", DEFAULT_MIN_DIST))
    metric = str(raw.get("metric", DEFAULT_METRIC))

    # UMAP requires n_neighbors < n_samples
    max_nn = max(2, n_samples - 1)
    n_neighbors = max(n_neighbors, 2)
    n_neighbors = min(n_neighbors, max_nn)

    if min_dist < 0.0:
        raise ProjectError("params.min_dist must be >= 0")

    return {
        "n_neighbors": n_neighbors,
        "min_dist": min_dist,
        "metric": metric,
    }


def project_embeddings(
    vectors: list[list[float]] | np.ndarray,
    *,
    method: str = "umap",
    n_components: int = 3,
    seed: int = 42,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Project embedding rows to 2D/3D.

    Returns:
        { method, n_components, positions, meta }
    """
    method_l = (method or "").strip().lower()
    if method_l in ("pca", "tsne"):
        raise ProjectError(
            f"method '{method_l}' is not implemented yet; use 'umap'",
            status_code=501,
        )
    if method_l != "umap":
        raise ProjectError(
            f"unsupported method '{method}'; v1 accepts 'umap' only "
            "(pca/tsne coming later)",
            status_code=400,
        )

    if n_components not in (2, 3):
        raise ProjectError("n_components must be 2 or 3")

    mat = _as_matrix(vectors)
    n_samples, dim = mat.shape

    # UMAP needs ≥3 samples; 1–2 tokens still valid in Token Comparison / Galaxy.
    if n_samples < 3:
        embedded, fallback_meta = _project_small_n(
            mat, n_components=n_components, seed=seed
        )
        positions = _normalize_positions(np.asarray(embedded, dtype=np.float64))
        return {
            "method": "umap",
            "n_components": n_components,
            "positions": positions.tolist(),
            "meta": {"seed": seed, **fallback_meta},
        }

    umap_params = _resolve_umap_params(n_samples, params)
    pre_pca_dims: int | None = None
    work = mat

    if dim > PRE_PCA_DIMS:
        from sklearn.decomposition import PCA

        pca_dims = min(PRE_PCA_DIMS, n_samples - 1, dim)
        if pca_dims < n_components:
            raise ProjectError(
                f"cannot pre-reduce: need at least {n_components} PCA dims "
                f"(n={n_samples}, dim={dim})"
            )
        pca = PCA(n_components=pca_dims, random_state=seed)
        work = pca.fit_transform(mat)
        pre_pca_dims = pca_dims

    import umap

    reducer = umap.UMAP(
        n_components=n_components,
        n_neighbors=umap_params["n_neighbors"],
        min_dist=umap_params["min_dist"],
        metric=umap_params["metric"],
        random_state=seed,
        n_jobs=1,
    )
    embedded = reducer.fit_transform(work)
    positions = _normalize_positions(np.asarray(embedded, dtype=np.float64))

    meta: dict[str, Any] = {
        "seed": seed,
        "n_neighbors": umap_params["n_neighbors"],
        "min_dist": umap_params["min_dist"],
        "metric": umap_params["metric"],
    }
    if pre_pca_dims is not None:
        meta["pre_pca_dims"] = pre_pca_dims

    return {
        "method": "umap",
        "n_components": n_components,
        "positions": positions.tolist(),
        "meta": meta,
    }
