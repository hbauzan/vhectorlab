"""Top-K SAE model and lazy-load manager (ported from predecessor tool)."""

from __future__ import annotations

import logging
import os
from typing import Any

import numpy as np
import torch
from torch import nn

logger = logging.getLogger("sae_model")


class TopKSAE(nn.Module):
    """
    Sparse Autoencoder with Top-K activation sparsity.
    Projects D-dimensional embeddings to a higher-dimensional sparse space.
    """

    def __init__(self, input_dim: int = 768, hidden_dim: int = 8192, k: int = 32):
        super().__init__()
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.k = k

        self.b_dec = nn.Parameter(torch.zeros(input_dim))
        self.W_enc = nn.Parameter(torch.empty(input_dim, hidden_dim))
        self.b_enc = nn.Parameter(torch.zeros(hidden_dim))
        self.W_dec = nn.Parameter(torch.empty(hidden_dim, input_dim))

        self.reset_parameters()

    def reset_parameters(self) -> None:
        nn.init.kaiming_uniform_(self.W_enc, nonlinearity="relu")
        nn.init.kaiming_uniform_(self.W_dec, nonlinearity="linear")
        self.make_decoder_weights_unit_norm()

    def make_decoder_weights_unit_norm(self) -> None:
        """Constrains decoder weight rows (W_dec) to unit L2 norm."""
        with torch.no_grad():
            self.W_dec.data.div_(
                torch.norm(self.W_dec.data, dim=1, keepdim=True) + 1e-8
            )

    def encode(self, x: torch.Tensor) -> torch.Tensor:
        x_centered = x - self.b_dec
        pre_acts = torch.relu(x_centered @ self.W_enc + self.b_enc)

        # Top-K in FP32 for dead-latent / overflow stability
        if self.k < self.hidden_dim:
            pre_acts_fp32 = pre_acts.float()
            topk_vals, topk_indices = torch.topk(pre_acts_fp32, self.k, dim=-1)
            acts = torch.zeros_like(pre_acts_fp32).scatter_(-1, topk_indices, topk_vals)
            if acts.dtype != pre_acts.dtype:
                acts = acts.to(pre_acts.dtype)
        else:
            acts = pre_acts

        return acts

    def decode(self, acts: torch.Tensor) -> torch.Tensor:
        if acts.dtype != self.W_dec.dtype:
            acts = acts.to(self.W_dec.dtype)
        return acts @ self.W_dec + self.b_dec

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        acts = self.encode(x)
        x_reconstructed = self.decode(acts)
        return x_reconstructed, acts


class SAEManager:
    """Lazy-load checkpoint from disk + in-memory encode for Clean/Denoise."""

    def __init__(self, device: str = "cpu", weights_path: str | None = None):
        self.weights_path = weights_path
        self.device = device
        self.model: TopKSAE | None = None
        self.config: dict[str, Any] = {}
        self.metrics: dict[str, Any] = {}
        self.static_buckets = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]

    def has_checkpoint_file(self) -> bool:
        return bool(self.weights_path) and os.path.exists(self.weights_path)

    def is_trained(self) -> bool:
        return self.model is not None or self.has_checkpoint_file()

    def clear(self, *, delete_file: bool = False) -> None:
        """Drop in-memory model; optionally delete the saved checkpoint."""
        self.model = None
        self.config = {}
        self.metrics = {}
        if delete_file and self.weights_path and os.path.exists(self.weights_path):
            try:
                os.remove(self.weights_path)
                logger.info("Deleted SAE checkpoint %s", self.weights_path)
            except OSError as e:
                logger.warning("Could not delete SAE checkpoint: %s", e)

    def clear_if_dim_mismatch(self, embedding_dim: int) -> bool:
        """
        Clear SAE RAM (+ delete checkpoint) when stored input_dim ≠ embedding_dim (M10).

        Returns True if something was cleared. No-op when SAE is empty or dims match.
        """
        stored: int | None = None
        if self.config.get("input_dim") is not None:
            stored = int(self.config["input_dim"])
        elif self.model is not None:
            stored = int(self.model.input_dim)
        elif self.has_checkpoint_file():
            try:
                checkpoint = torch.load(self.weights_path, map_location="cpu")
                cfg = checkpoint.get("config") or {}
                if cfg.get("input_dim") is not None:
                    stored = int(cfg["input_dim"])
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    "Could not read SAE checkpoint dim (%s); clearing to be safe.", e
                )
                self.clear(delete_file=True)
                return True

        if stored is None:
            return False
        if stored == int(embedding_dim):
            return False
        logger.warning(
            "SAE input_dim=%s != embedding_dim=%s — clearing session SAE.",
            stored,
            embedding_dim,
        )
        self.clear(delete_file=True)
        return True

    def unload(self) -> None:
        """Drop RAM only (keep file on disk)."""
        self.model = None
        self.config = {}
        self.metrics = {}

    def save_checkpoint(self, checkpoint: dict[str, Any]) -> None:
        if not self.weights_path:
            return
        parent = os.path.dirname(self.weights_path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        torch.save(checkpoint, self.weights_path)
        logger.info("Saved SAE checkpoint to %s", self.weights_path)

    def install_checkpoint(self, checkpoint: dict[str, Any], *, persist: bool = True) -> None:
        """Install a trained checkpoint into RAM; optionally persist to disk."""
        self.config = dict(
            checkpoint.get("config", {"input_dim": 768, "hidden_dim": 8192, "k": 32})
        )
        self.metrics = dict(checkpoint.get("metrics", {}))
        self.model = TopKSAE(
            input_dim=int(self.config.get("input_dim", 768)),
            hidden_dim=int(self.config.get("hidden_dim", 8192)),
            k=int(self.config.get("k", 32)),
        )
        self.model.load_state_dict(checkpoint["state_dict"])
        self.model.to(self.device)
        self.model.eval()
        if persist:
            self.save_checkpoint(checkpoint)
        logger.info(
            "SAE installed (hidden_dim=%s, k=%s, persist=%s).",
            self.config.get("hidden_dim"),
            self.config.get("k"),
            persist,
        )

    def load_model(self) -> bool:
        if self.model is not None:
            return True

        if not self.has_checkpoint_file():
            logger.warning("No SAE checkpoint available")
            return False

        try:
            logger.info(
                "Loading SAE model from %s on %s...", self.weights_path, self.device
            )
            checkpoint = torch.load(self.weights_path, map_location=self.device)
            self.install_checkpoint(checkpoint, persist=False)
            return True
        except Exception as e:
            logger.error("Error loading SAE model: %s", e)
            self.model = None
            return False

    def _encode_acts_tensor(self, vectors: np.ndarray) -> torch.Tensor:
        """
        Run Top-K encode on [N, D] → device tensor [N, hidden_dim].
        Shares bucketing / from_numpy / inference_mode / AMP across dense + sparse paths.
        Model must already be loaded (singleton in RAM/VRAM).
        """
        assert self.model is not None
        orig_len = vectors.shape[0]
        if orig_len == 0:
            return torch.empty(
                (0, self.model.hidden_dim),
                dtype=torch.float32,
                device=self.device,
            )

        bucket_len = min(
            (b for b in self.static_buckets if b >= orig_len), default=orig_len
        )
        padding_needed = bucket_len - orig_len

        if padding_needed > 0:
            padded_vectors = np.pad(
                vectors, ((0, padding_needed), (0, 0)), mode="constant"
            )
        else:
            padded_vectors = vectors

        if not padded_vectors.flags.writeable:
            padded_vectors = padded_vectors.copy()
        x_tensor = torch.from_numpy(padded_vectors).to(self.device)
        if x_tensor.dtype != torch.float32:
            x_tensor = x_tensor.float()

        device_type = (
            "cuda"
            if "cuda" in str(self.device)
            else ("mps" if "mps" in str(self.device) else "cpu")
        )
        use_amp = device_type in ["cuda", "cpu", "mps"]
        amp_dtype = (
            torch.bfloat16
            if (device_type == "cuda" and torch.cuda.is_bf16_supported())
            else torch.float16
        )

        with torch.inference_mode():
            if use_amp:
                try:
                    with torch.amp.autocast(device_type=device_type, dtype=amp_dtype):
                        acts = self.model.encode(x_tensor)
                except Exception:
                    acts = self.model.encode(x_tensor)
            else:
                acts = self.model.encode(x_tensor)

            return acts[:orig_len].float()

    def encode_vectors(self, vectors: np.ndarray) -> np.ndarray:
        """
        Encode [N, D] embeddings → [N, hidden_dim] sparse activations (dense layout).
        Prefer encode_vectors_sparse for HTTP — avoids shipping ~99% zeros.
        """
        if not self.load_model() or self.model is None:
            raise ValueError("SAE model is not trained or could not be loaded.")

        if vectors.shape[0] == 0:
            return np.empty((0, self.model.hidden_dim), dtype=np.float32)

        return self._encode_acts_tensor(vectors).cpu().numpy()

    def encode_vectors_sparse(self, vectors: np.ndarray) -> dict[str, Any]:
        """
        Encode [N, D] → Top-K sparse payload (indices/values only).

        Returns dict with numpy arrays ready for ORJSON (no dense [N, H] .tolist()).
        """
        if not self.load_model() or self.model is None:
            raise ValueError("SAE model is not trained or could not be loaded.")

        hidden = int(self.model.hidden_dim)
        k = int(self.model.k)
        orig_len = int(vectors.shape[0])
        if orig_len == 0:
            return {
                "format": "topk_sparse",
                "indices": np.empty((0, k), dtype=np.int64),
                "values": np.empty((0, k), dtype=np.float32),
                "dimension": hidden,
                "k": k,
                "count": 0,
                "batch_metrics": {
                    "l0": 0.0,
                    "sparsity": 0.0,
                    "active_features": 0,
                },
            }

        with torch.inference_mode():
            acts = self._encode_acts_tensor(vectors)
            # acts already Top-K sparse in dense layout; pack the K slots
            topk_k = min(k, hidden)
            vals, idx = torch.topk(acts, topk_k, dim=-1)
            vals_np = vals.cpu().numpy().astype(np.float32, copy=False)
            idx_np = idx.cpu().numpy().astype(np.int64, copy=False)

            active_per_row = (vals > 0).sum(dim=-1).float()
            l0 = float(active_per_row.mean().item()) if orig_len else 0.0
            if orig_len and topk_k > 0:
                # Unique latent ids that fired at least once in the batch
                pos_mask = vals > 0
                if bool(pos_mask.any().item()):
                    active_features = int(torch.unique(idx[pos_mask]).numel())
                else:
                    active_features = 0
            else:
                active_features = 0

        return {
            "format": "topk_sparse",
            "indices": idx_np,
            "values": vals_np,
            "dimension": hidden,
            "k": topk_k,
            "count": orig_len,
            "batch_metrics": {
                "l0": l0,
                "sparsity": float(l0 / hidden) if hidden else 0.0,
                "active_features": active_features,
            },
        }
