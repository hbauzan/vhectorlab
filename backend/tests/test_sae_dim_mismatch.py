"""SAE clears when embedding dim changes (multillm M10)."""

from __future__ import annotations

from pathlib import Path

import torch
from backend.sae.sae_model import SAEManager, TopKSAE


def _install_dim(manager: SAEManager, input_dim: int) -> None:
    model = TopKSAE(input_dim=input_dim, hidden_dim=64, k=4)
    manager.model = model
    manager.config = {"input_dim": input_dim, "hidden_dim": 64, "k": 4}
    manager.metrics = {"loss": 0.1}


def test_clear_if_dim_mismatch_clears_when_different():
    manager = SAEManager(device="cpu")
    _install_dim(manager, 768)
    cleared = manager.clear_if_dim_mismatch(384)
    assert cleared is True
    assert manager.model is None
    assert manager.config == {}


def test_clear_if_dim_mismatch_keeps_when_same():
    manager = SAEManager(device="cpu")
    _install_dim(manager, 384)
    cleared = manager.clear_if_dim_mismatch(384)
    assert cleared is False
    assert manager.model is not None
    assert manager.config["input_dim"] == 384


def test_clear_if_dim_mismatch_deletes_incompatible_checkpoint(tmp_path: Path):
    weights = tmp_path / "sae_weights.pt"
    model = TopKSAE(input_dim=768, hidden_dim=64, k=4)
    torch.save(
        {
            "config": {"input_dim": 768, "hidden_dim": 64, "k": 4},
            "state_dict": model.state_dict(),
            "metrics": {},
        },
        weights,
    )
    manager = SAEManager(device="cpu", weights_path=str(weights))
    assert manager.has_checkpoint_file()
    cleared = manager.clear_if_dim_mismatch(384)
    assert cleared is True
    assert not weights.exists()
    assert manager.model is None


def test_clear_if_dim_mismatch_noop_when_empty():
    manager = SAEManager(device="cpu")
    assert manager.clear_if_dim_mismatch(768) is False
