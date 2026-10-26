from __future__ import annotations

import warnings
from dataclasses import dataclass
from datetime import datetime, timezone

import numpy as np


@dataclass(frozen=True, slots=True)
class ModelNoiseProfile:
    """Immutable audit profile of isolated structural noise coordinates."""

    model_name: str
    embedding_dim: int
    noise_indices: tuple[int, ...]
    saturated_indices: tuple[int, ...]
    flat_indices: tuple[int, ...]
    energy_ratio: float  # Sum of L2^2 in noise dims / Total L2^2 norm
    cosine_delta: float  # Mean pairwise raw cosine - Mean pairwise pruned cosine
    timestamp_utc: str


def detect_structural_noise(
    embeddings: np.ndarray,
    model_name: str,
    sat_threshold_z: float = 3.0,
    flat_threshold_sigma: float = 0.010,
    random_seed: int = 42,
) -> ModelNoiseProfile:
    """Detect saturated outlier coordinates and flat/dead dimensions in an embedding matrix.

    Pure, deterministic mathematical detection engine.
    Criterion A: Z-score of mean absolute energy E_d >= sat_threshold_z (default 3.0).
    Criterion B: Standard deviation sigma_d <= flat_threshold_sigma or <= 0.35 * mean(sigma).
    """
    timestamp = datetime.now(timezone.utc).isoformat()

    arr = np.asarray(embeddings, dtype=np.float32)
    if arr.ndim != 2:
        arr = np.atleast_2d(arr)

    n_samples, dim = arr.shape

    # Fail-closed guard: degenerate or insufficient sample count
    if n_samples < 2 or dim == 0:
        return ModelNoiseProfile(
            model_name=model_name,
            embedding_dim=dim,
            noise_indices=(),
            saturated_indices=(),
            flat_indices=(),
            energy_ratio=0.0,
            cosine_delta=0.0,
            timestamp_utc=timestamp,
        )

    # 1. Criterion A: Universal Saturation Outliers (Energy Z-score)
    e_d = np.mean(np.abs(arr), axis=0)  # Shape (dim,)
    e_bar = float(np.mean(e_d))
    sigma_e = float(np.std(e_d))  # Population standard deviation

    if sigma_e <= 1e-12:
        saturated_set: set[int] = set()
    else:
        z_e = (e_d - e_bar) / sigma_e
        saturated_set = {int(idx) for idx in np.where(z_e >= sat_threshold_z)[0]}

    # 2. Criterion B: Thematic Indifference / Flat Channels
    sigma_d = np.std(arr, axis=0)  # Shape (dim,)
    sigma_bar = float(np.mean(sigma_d))
    flat_mask = (sigma_d <= flat_threshold_sigma) | (sigma_d <= 0.35 * sigma_bar)
    flat_set = {int(idx) for idx in np.where(flat_mask)[0]}

    # 3. Consolidated Noise Sets (mutually exclusive breakdown)
    saturated_indices = tuple(sorted(saturated_set))
    flat_indices = tuple(sorted(flat_set - saturated_set))
    noise_indices = tuple(sorted(saturated_set | flat_set))

    # 4. Energy Concentration Metric
    total_l2_sq = float(np.sum(arr**2))
    if total_l2_sq > 1e-12 and noise_indices:
        noise_l2_sq = float(np.sum(arr[:, list(noise_indices)] ** 2))
        energy_ratio = round(noise_l2_sq / total_l2_sq, 4)
    else:
        energy_ratio = 0.0

    # 5. Anisotropic Baseline Cosine Drop
    if not noise_indices or n_samples < 2:
        cosine_delta = 0.0
    else:
        sample_size = min(n_samples, 500)
        rng = np.random.RandomState(random_seed)
        if sample_size < n_samples:
            sample_idx = rng.choice(n_samples, sample_size, replace=False)
        else:
            sample_idx = np.arange(n_samples)

        sample = arr[sample_idx].astype(np.float64)

        # Raw pairwise cosine
        raw_norms = np.linalg.norm(sample, axis=1, keepdims=True)
        raw_norms = np.maximum(raw_norms, 1e-12)
        normed_raw = sample / raw_norms

        triu_idx = np.triu_indices(sample_size, k=1)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            sim_raw = normed_raw @ normed_raw.T
        mean_raw_cosine = float(np.mean(sim_raw[triu_idx]))

        # Pruned pairwise cosine
        pruned_sample = sample.copy()
        pruned_sample[:, list(noise_indices)] = 0.0
        pruned_norms = np.linalg.norm(pruned_sample, axis=1, keepdims=True)
        pruned_norms = np.maximum(pruned_norms, 1e-12)
        normed_pruned = pruned_sample / pruned_norms

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            sim_pruned = normed_pruned @ normed_pruned.T
        mean_pruned_cosine = float(np.mean(sim_pruned[triu_idx]))

        cosine_delta = round(mean_raw_cosine - mean_pruned_cosine, 4)

    return ModelNoiseProfile(
        model_name=model_name,
        embedding_dim=dim,
        noise_indices=noise_indices,
        saturated_indices=saturated_indices,
        flat_indices=flat_indices,
        energy_ratio=energy_ratio,
        cosine_delta=cosine_delta,
        timestamp_utc=timestamp,
    )
