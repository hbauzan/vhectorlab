from __future__ import annotations

from dataclasses import FrozenInstanceError
from pathlib import Path

import numpy as np
import pytest

from structural_noise import (
    ModelNoiseProfile,
    detect_structural_noise,
)


def test_detect_noise_synthetic_spikes_and_flats() -> None:
    rng = np.random.RandomState(42)
    # 200 samples, 100 dims, small Gaussian noise
    X = rng.normal(loc=0.0, scale=0.02, size=(200, 100)).astype(np.float32)

    # Inject large absolute energy into dims 12 and 45 (outliers)
    X[:, 12] = 0.50
    X[:, 45] = -0.40

    # Inject zero variance into dim 88 (flat channel)
    X[:, 88] = 0.00

    profile = detect_structural_noise(
        embeddings=X,
        model_name="synthetic-test-model",
        sat_threshold_z=3.0,
        flat_threshold_sigma=0.010,
    )

    assert isinstance(profile, ModelNoiseProfile)
    assert profile.model_name == "synthetic-test-model"
    assert profile.embedding_dim == 100
    assert profile.saturated_indices == (12, 45)
    assert profile.flat_indices == (88,)
    assert profile.noise_indices == (12, 45, 88)
    assert profile.energy_ratio > 0.0
    assert profile.timestamp_utc != ""


def test_detect_noise_fail_closed_degenerate() -> None:
    # 1. Empty matrix (0 samples)
    empty = np.zeros((0, 64), dtype=np.float32)
    p_empty = detect_structural_noise(empty, model_name="empty")
    assert p_empty.noise_indices == ()
    assert p_empty.energy_ratio == 0.0
    assert p_empty.cosine_delta == 0.0

    # 2. Single vector (N=1)
    single = np.ones((1, 64), dtype=np.float32)
    p_single = detect_structural_noise(single, model_name="single")
    assert p_single.noise_indices == ()
    assert p_single.energy_ratio == 0.0
    assert p_single.cosine_delta == 0.0

    # 3. Zero-variance matrix (all elements identical constant)
    const_matrix = np.full((50, 64), fill_value=0.05, dtype=np.float32)
    p_const = detect_structural_noise(const_matrix, model_name="constant")
    assert isinstance(p_const, ModelNoiseProfile)
    # With std(E) == 0, no saturated outlier can exist
    assert p_const.saturated_indices == ()


def test_detect_noise_real_bge_m3_npz() -> None:
    vocab_path = (
        Path(__file__).resolve().parent.parent.parent
        / "public"
        / "vocab_embeddings.npz"
    )
    if not vocab_path.exists():
        pytest.skip(f"Vocabulary tensor not found at {vocab_path}")

    npz = np.load(str(vocab_path), allow_pickle=True)
    embeddings = npz["embeddings"]
    model_name = str(npz["model_name"])

    profile = detect_structural_noise(
        embeddings=embeddings,
        model_name=model_name,
        sat_threshold_z=3.0,
        flat_threshold_sigma=0.010,
    )

    assert profile.model_name == "BAAI/bge-m3"
    assert profile.embedding_dim == 1024

    # Top energy audit assertions (measured rank 1, 2, 3)
    assert 386 in profile.saturated_indices
    assert 297 in profile.saturated_indices
    assert 780 in profile.saturated_indices

    # Lowest variance channels (rank 1023, 1024)
    assert 329 in profile.flat_indices
    assert 616 in profile.flat_indices

    # Exact measured profile under Z_E >= 3.0 and flat criteria
    assert profile.saturated_indices == (
        38,
        58,
        65,
        80,
        297,
        376,
        386,
        404,
        549,
        577,
        780,
    )
    assert profile.flat_indices == (329, 616)
    assert profile.noise_indices == (
        38,
        58,
        65,
        80,
        297,
        329,
        376,
        386,
        404,
        549,
        577,
        616,
        780,
    )

    # Measured empirical bounds: energy_ratio = 0.1980, cosine_delta = 0.1152
    assert 0.190 <= profile.energy_ratio <= 0.210
    assert profile.energy_ratio == 0.1980
    assert profile.cosine_delta > 0.05
    assert profile.cosine_delta == 0.1152


def test_detect_noise_all_mpnet_base_v2_synthetic_contract() -> None:
    # Contract verification for known dead dimensions in all-mpnet-base-v2:
    # Dims 34, 555, 688, 756 are known dead/near-zero channels
    rng = np.random.RandomState(42)
    N, D = 100, 768
    X = rng.normal(loc=0.0, scale=0.03, size=(N, D)).astype(np.float32)

    # Force dead channels
    dead_dims = [34, 555, 688, 756]
    for d in dead_dims:
        X[:, d] = 0.0

    profile = detect_structural_noise(
        embeddings=X,
        model_name="sentence-transformers/all-mpnet-base-v2",
        sat_threshold_z=3.0,
        flat_threshold_sigma=0.010,
    )

    for d in dead_dims:
        assert d in profile.flat_indices
        assert d in profile.noise_indices


def test_noise_profile_immutability() -> None:
    profile = ModelNoiseProfile(
        model_name="test-model",
        embedding_dim=512,
        noise_indices=(1, 2),
        saturated_indices=(1,),
        flat_indices=(2,),
        energy_ratio=0.05,
        cosine_delta=0.01,
        timestamp_utc="2026-10-26T12:00:00Z",
    )

    with pytest.raises(FrozenInstanceError):
        # dataclass is frozen; mutating should fail
        profile.energy_ratio = 0.10  # type: ignore[misc]
