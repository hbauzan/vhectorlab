"""Resolve torch runtime device from env (lazy torch import — safe for AppState top-level)."""

from __future__ import annotations


def get_optimal_device(env_device: str = "AUTO") -> str:
    """Resolve device string: AUTO|CPU|CUDA|MPS|GPU → cuda|mps|cpu."""
    env_device = (env_device or "AUTO").upper().strip()
    if env_device == "CPU":
        return "cpu"

    import torch

    if env_device == "CUDA":
        return "cuda" if torch.cuda.is_available() else "cpu"
    if env_device == "MPS":
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps"
        return "cpu"
    if env_device in ("GPU", "AUTO"):
        if torch.cuda.is_available():
            return "cuda"
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps"
        return "cpu"
    return "cpu"
