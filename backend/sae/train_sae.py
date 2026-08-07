"""Train Top-K SAE on a session-scope embedding matrix (fast path)."""

from __future__ import annotations

import logging
import os
from collections.abc import Callable
from typing import Any

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset

from backend.device import get_optimal_device
from backend.sae.sae_model import TopKSAE

logger = logging.getLogger("train_sae")

ProgressCb = Callable[..., None]

# Re-export for callers that imported get_optimal_device from this module.
__all__ = ["get_optimal_device", "train_sae"]


def _device_type(device: torch.device | str) -> str:
    s = str(device)
    if "cuda" in s:
        return "cuda"
    if "mps" in s:
        return "mps"
    return "cpu"


def _amp_settings(device: torch.device) -> tuple[bool, torch.dtype | None]:
    """Mixed precision for CUDA matmuls. MPS/CPU train stays FP32 for stability."""
    if device.type == "cuda":
        dtype = (
            torch.bfloat16
            if torch.cuda.is_bf16_supported()
            else torch.float16
        )
        return True, dtype
    return False, None


def _emit_progress(
    progress_cb: ProgressCb | None,
    completed: float,
    total_epochs: int,
    loss: float,
    detail: str = "",
) -> None:
    if progress_cb is None:
        return
    try:
        if detail:
            progress_cb(completed, total_epochs, float(loss), detail)
        else:
            progress_cb(completed, total_epochs, float(loss))
    except TypeError:
        try:
            progress_cb(completed, total_epochs, float(loss))
        except Exception:
            pass
    except Exception:
        pass


def train_sae(
    vectors: np.ndarray,
    hidden_dim: int = 8192,
    k: int = 32,
    epochs: int = 50,
    lr: float = 1e-3,
    batch_size: int = 64,
    device_name: str = "AUTO",
    output_path: str | None = None,
    progress_cb: ProgressCb | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """
    Train TopKSAE with Adam + MSE reconstruction (session-scope fast path).

    Optimizations vs naive loop:
    - contiguous float32 + torch.from_numpy (zero-copy into torch)
    - full-batch when N <= batch_size (no DataLoader overhead)
    - CUDA/CPU AMP autocast on forward
    - inference_mode for final metrics
    - decoder unit-norm every step (small H) / every 2 steps (large H)

    Returns (metrics, checkpoint).
    """
    if vectors.ndim != 2 or vectors.shape[0] == 0:
        raise ValueError("vectors must be a non-empty 2D array [N, D]")

    device = torch.device(get_optimal_device(device_name))
    logger.info("Training on device: %s", device)

    # Zero-copy friendly contiguous float32
    vectors = np.ascontiguousarray(vectors, dtype=np.float32)
    input_dim = int(vectors.shape[1])
    n = int(vectors.shape[0])

    model = TopKSAE(input_dim=input_dim, hidden_dim=hidden_dim, k=k)
    model.to(device)

    x_host = torch.from_numpy(vectors)  # shares memory with NumPy
    actual_batch_size = min(max(1, batch_size), n)
    use_full_batch = actual_batch_size >= n

    if use_full_batch:
        x_all = x_host.to(device, non_blocking=True)
        dataloader = None
    else:
        dataset = TensorDataset(x_host)
        dataloader = DataLoader(
            dataset,
            batch_size=actual_batch_size,
            shuffle=True,
            drop_last=False,
            pin_memory=(device.type == "cuda"),
        )
        x_all = None

    optimizer = optim.Adam(model.parameters(), lr=lr)
    use_amp, amp_dtype = _amp_settings(device)
    # GradScaler only for cuda fp16 (not bf16 / not mps)
    scaler = (
        torch.amp.GradScaler("cuda")
        if (use_amp and _device_type(device) == "cuda" and amp_dtype == torch.float16)
        else None
    )
    norm_every = 1 if hidden_dim <= 1024 else 2
    step_i = 0

    logger.info(
        "Starting SAE training (n=%s, hidden_dim=%s, k=%s, epochs=%s, batch_size=%s, full_batch=%s, amp=%s)...",
        n,
        hidden_dim,
        k,
        epochs,
        actual_batch_size,
        use_full_batch,
        use_amp,
    )

    last_loss = 0.0
    for epoch in range(epochs):
        model.train()
        total_loss = 0.0

        if use_full_batch:
            assert x_all is not None
            optimizer.zero_grad(set_to_none=True)
            if use_amp and amp_dtype is not None:
                with torch.amp.autocast(device_type=_device_type(device), dtype=amp_dtype):
                    reconstruction, _acts = model(x_all)
                    loss = nn.functional.mse_loss(reconstruction, x_all)
            else:
                reconstruction, _acts = model(x_all)
                loss = nn.functional.mse_loss(reconstruction, x_all)

            if scaler is not None:
                scaler.scale(loss).backward()
                scaler.step(optimizer)
                scaler.update()
            else:
                loss.backward()
                optimizer.step()

            step_i += 1
            if step_i % norm_every == 0:
                model.make_decoder_weights_unit_norm()

            last_loss = float(loss.detach().item())
            total_loss = last_loss * n
            _emit_progress(
                progress_cb,
                float(epoch) + 1.0,
                epochs,
                last_loss,
                f"Training epoch {epoch + 1}/{epochs} (full-batch) — "
                f"{max(0, epochs - epoch - 1)} left · loss={last_loss:.6f}",
            )
        else:
            assert dataloader is not None
            n_batches = max(1, len(dataloader))
            for batch_i, batch in enumerate(dataloader):
                x_batch = batch[0].to(device, non_blocking=True)
                optimizer.zero_grad(set_to_none=True)
                if use_amp and amp_dtype is not None:
                    with torch.amp.autocast(
                        device_type=_device_type(device), dtype=amp_dtype
                    ):
                        reconstruction, _acts = model(x_batch)
                        loss = nn.functional.mse_loss(reconstruction, x_batch)
                else:
                    reconstruction, _acts = model(x_batch)
                    loss = nn.functional.mse_loss(reconstruction, x_batch)

                if scaler is not None:
                    scaler.scale(loss).backward()
                    scaler.step(optimizer)
                    scaler.update()
                else:
                    loss.backward()
                    optimizer.step()

                step_i += 1
                if step_i % norm_every == 0:
                    model.make_decoder_weights_unit_norm()

                batch_loss = float(loss.detach().item())
                total_loss += batch_loss * len(x_batch)

                report = (
                    batch_i == 0
                    or batch_i == n_batches - 1
                    or batch_i % max(1, n_batches // 10) == 0
                )
                if report:
                    frac = float(epoch) + float(batch_i + 1) / float(n_batches)
                    _emit_progress(
                        progress_cb,
                        frac,
                        epochs,
                        batch_loss,
                        f"Training epoch {epoch + 1}/{epochs} · "
                        f"batch {batch_i + 1}/{n_batches} — "
                        f"{max(0, epochs - epoch - 1)} epochs left after this",
                    )

            last_loss = total_loss / n
            _emit_progress(
                progress_cb,
                float(epoch + 1),
                epochs,
                last_loss,
                f"Finished epoch {epoch + 1}/{epochs} · loss={last_loss:.6f}",
            )

        if (epoch + 1) % max(1, epochs // 10) == 0 or epoch == epochs - 1:
            logger.info(
                "Epoch %03d/%03d - Reconstruction Loss (MSE): %.6f",
                epoch + 1,
                epochs,
                last_loss,
            )

    # Ensure unit-norm after last step
    model.make_decoder_weights_unit_norm()
    model.eval()
    logger.info("Computing final training metrics...")

    with torch.inference_mode():
        if x_all is None:
            x_eval = x_host.to(device, non_blocking=True)
        else:
            x_eval = x_all
        if use_amp and amp_dtype is not None and _device_type(device) != "mps":
            with torch.amp.autocast(device_type=_device_type(device), dtype=amp_dtype):
                reconstruction, acts = model(x_eval)
        else:
            reconstruction, acts = model(x_eval)

        # Metrics in FP32 for stability
        reconstruction = reconstruction.float()
        acts = acts.float()
        x_eval_f = x_eval.float()
        final_mse = nn.functional.mse_loss(reconstruction, x_eval_f).item()
        active_per_input = (acts > 0).sum(dim=-1).float()
        mean_sparsity = active_per_input.mean().item()
        feature_activations = (acts > 0).sum(dim=0)
        dead_features_count = int((feature_activations == 0).sum().item())
        dead_features_pct = (dead_features_count / hidden_dim) * 100.0

    logger.info("Training Complete.")
    logger.info("Final Reconstruction Loss (MSE): %.6f", final_mse)
    logger.info(
        "Mean Sparsity (Active Features): %.2f / %s (Target K: %s)",
        mean_sparsity,
        hidden_dim,
        k,
    )
    logger.info(
        "Dead Features: %s/%s (%.2f%%)",
        dead_features_count,
        hidden_dim,
        dead_features_pct,
    )

    config = {
        "input_dim": input_dim,
        "hidden_dim": hidden_dim,
        "k": k,
        "device": str(device),
    }
    metrics = {
        "mse": float(final_mse),
        "mean_sparsity": float(mean_sparsity),
        "dead_features_count": int(dead_features_count),
        "dead_features_pct": float(dead_features_pct),
        "total_vectors": n,
        "epochs": int(epochs),
        "batch_size": int(actual_batch_size),
        "full_batch": bool(use_full_batch),
        "amp": bool(use_amp),
        "device": str(device),
    }

    cpu_state = {k_: v.detach().cpu() for k_, v in model.state_dict().items()}
    checkpoint: dict[str, Any] = {
        "state_dict": cpu_state,
        "config": config,
        "metrics": metrics,
    }

    if output_path:
        parent = os.path.dirname(output_path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        torch.save(checkpoint, output_path)
        logger.info("Saved SAE debug checkpoint to %s", output_path)

    return metrics, checkpoint
