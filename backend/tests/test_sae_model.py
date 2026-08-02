"""Unit tests for Top-K SAE model, manager, training, and dim suggestions."""

from __future__ import annotations

import os
import tempfile

import numpy as np
import pytest
import torch

from backend.sae.sae_model import SAEManager, TopKSAE
from backend.sae.suggest_dims import suggest_sae_dims
from backend.sae.train_sae import train_sae


def test_sae_dimensions_and_topk():
    batch_size = 4
    input_dim = 768
    hidden_dim = 1024
    k = 10

    model = TopKSAE(input_dim=input_dim, hidden_dim=hidden_dim, k=k)
    x = torch.randn(batch_size, input_dim)

    reconstruction, acts = model(x)

    assert reconstruction.shape == (batch_size, input_dim)
    assert acts.shape == (batch_size, hidden_dim)

    active_counts = (acts > 0).sum(dim=-1)
    for count in active_counts:
        assert int(count) <= k


def test_decoder_unit_norm_constraint():
    model = TopKSAE(input_dim=768, hidden_dim=1024, k=10)
    model.make_decoder_weights_unit_norm()
    norms = torch.norm(model.W_dec, dim=1)
    for norm in norms:
        assert abs(norm.item() - 1.0) < 1e-5


def test_suggest_sae_dims_scales_for_small_n():
    h, k = suggest_sae_dims(n_vectors=20, input_dim=768, requested_hidden=8192, requested_k=32)
    assert h < 8192
    assert h <= 20 * 3
    assert k <= h
    assert k <= 32


def test_suggest_train_schedule_caps_epochs_for_small_hidden():
    from backend.sae.suggest_dims import suggest_train_schedule

    epochs, batch = suggest_train_schedule(
        n_vectors=24, hidden_dim=64, requested_epochs=50, requested_batch_size=64
    )
    assert epochs <= 12
    assert batch == 24  # full-batch


def test_suggest_sae_dims_allows_full_when_n_large():
    h, k = suggest_sae_dims(
        n_vectors=3000, input_dim=768, requested_hidden=8192, requested_k=32
    )
    assert h == 8192
    assert k == 32


def test_encode_empty_input():
    vectors = np.random.randn(8, 64).astype(np.float32)
    _metrics, checkpoint = train_sae(
        vectors=vectors,
        hidden_dim=128,
        k=4,
        epochs=2,
        batch_size=4,
        device_name="CPU",
        output_path=None,
    )
    manager = SAEManager(device="cpu")
    manager.install_checkpoint(checkpoint)
    empty = np.empty((0, 64), dtype=np.float32)
    acts = manager.encode_vectors(empty)
    assert acts.shape == (0, 128)


def test_training_ephemeral_install_and_encode():
    num_samples = 20
    input_dim = 768
    hidden_dim = 256
    k = 5
    dummy_vectors = np.random.randn(num_samples, input_dim).astype(np.float32)

    metrics, checkpoint = train_sae(
        vectors=dummy_vectors,
        hidden_dim=hidden_dim,
        k=k,
        epochs=5,
        lr=1e-3,
        batch_size=8,
        device_name="CPU",
        output_path=None,
    )

    assert "mse" in metrics
    assert "mean_sparsity" in metrics
    assert "dead_features_count" in metrics

    manager = SAEManager(device="cpu")
    assert not manager.is_trained()
    manager.install_checkpoint(checkpoint, persist=False)
    assert manager.is_trained()

    acts = manager.encode_vectors(dummy_vectors)
    assert acts.shape == (num_samples, hidden_dim)
    active_counts = (acts > 0).sum(axis=-1)
    for count in active_counts:
        assert int(count) <= k

    sparse = manager.encode_vectors_sparse(dummy_vectors)
    assert sparse["format"] == "topk_sparse"
    assert sparse["indices"].shape == (num_samples, k)
    assert sparse["values"].shape == (num_samples, k)
    assert sparse["dimension"] == hidden_dim
    assert sparse["count"] == num_samples
    # Dense reconstruction from sparse must match encode_vectors support
    rebuilt = np.zeros((num_samples, hidden_dim), dtype=np.float32)
    for i in range(num_samples):
        rebuilt[i, sparse["indices"][i]] = sparse["values"][i]
    np.testing.assert_allclose(rebuilt, acts, rtol=1e-5, atol=1e-5)

    manager.clear(delete_file=False)
    assert not manager.is_trained()


def test_optional_disk_checkpoint_still_loads():
    """Debug/test path: train can still write a file and hydrate via weights_path."""
    vectors = np.random.randn(12, 64).astype(np.float32)
    with tempfile.TemporaryDirectory() as temp_dir:
        weights_path = os.path.join(temp_dir, "sae_weights.pt")
        train_sae(
            vectors=vectors,
            hidden_dim=64,
            k=4,
            epochs=2,
            batch_size=4,
            device_name="CPU",
            output_path=weights_path,
        )
        manager = SAEManager(device="cpu", weights_path=weights_path)
        assert manager.load_model()
        assert manager.is_trained()


def test_manager_not_trained_raises():
    manager = SAEManager(device="cpu")
    assert not manager.is_trained()
    with pytest.raises(ValueError, match="not trained"):
        manager.encode_vectors(np.random.randn(2, 768).astype(np.float32))
