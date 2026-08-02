"""SAE API: status / train / encode / clear — persisted Compare-scope Top-K SAE."""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import Any

import numpy as np
import orjson
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from starlette.responses import JSONResponse

from backend.sae.sae_model import SAEManager
from backend.sae.suggest_dims import suggest_sae_dims, suggest_train_schedule
from backend.sae.train_sae import get_optimal_device, train_sae

logger = logging.getLogger(__name__)


class OrjsonResponse(JSONResponse):
    """FastJSON via orjson (avoid deprecated fastapi.responses.ORJSONResponse)."""

    media_type = "application/json"

    def render(self, content: Any) -> bytes:
        return orjson.dumps(content)


router = APIRouter(default_response_class=OrjsonResponse)

_ARTIFACTS_DIR = Path(__file__).resolve().parent.parent / "artifacts"
SAE_WEIGHTS_PATH = str(_ARTIFACTS_DIR / "sae_weights.pt")


def _resolve_sae_device() -> str:
    return get_optimal_device(os.getenv("SAE_DEVICE", "AUTO"))


sae_manager = SAEManager(
    device=_resolve_sae_device(),
    weights_path=SAE_WEIGHTS_PATH,
)


class SAEEncodeRequest(BaseModel):
    embeddings: list[list[float]] = Field(
        ..., description="Batch of raw embedding vectors [N, D]"
    )


class SAETrainRequest(BaseModel):
    embeddings: list[list[float]] = Field(
        ...,
        min_length=2,
        description="Current workspace scope vectors (Compare items or Arithmetic components)",
    )
    hidden_dim: int = Field(default=8192, ge=32, le=32768)
    k: int = Field(default=32, ge=1, le=4096)
    epochs: int = Field(default=50, ge=1, le=500)
    lr: float = Field(default=1e-3, gt=0, le=1.0)
    batch_size: int = Field(default=64, ge=1, le=2048)
    auto_scale: bool = Field(
        default=True,
        description="Scale hidden_dim/k down for small N (recommended)",
    )


class SAETrainingStatus:
    def __init__(self) -> None:
        self.status = "idle"  # idle | preparing | training | success | failed
        self.phase = "idle"
        self.phase_key = "idle"  # idle | preparing | training | installing | ready | failed
        self.current_epoch = 0
        self.total_epochs = 0
        self.remaining_epochs = 0
        self.percent = 0.0
        self.loss = 0.0
        self.error_message: str | None = None
        self.metrics: dict[str, Any] | None = None
        self.message = ""
        self.resolved_hidden: int | None = None
        self.resolved_k: int | None = None
        self.n_vectors: int | None = None


sae_training_status = SAETrainingStatus()


async def _train_sae_task(
    vectors: np.ndarray,
    hidden_dim: int,
    k: int,
    epochs: int,
    lr: float,
    batch_size: int,
) -> None:
    global sae_training_status
    try:
        n = int(vectors.shape[0])
        sae_training_status.status = "training"
        sae_training_status.phase_key = "preparing"
        sae_training_status.phase = "Preparing scope matrix…"
        sae_training_status.current_epoch = 0
        sae_training_status.total_epochs = epochs
        sae_training_status.remaining_epochs = epochs
        sae_training_status.percent = 0.0
        sae_training_status.loss = 0.0
        sae_training_status.error_message = None
        sae_training_status.metrics = None
        sae_training_status.message = (
            f"Preparing scope matrix… (n={n}, hidden={hidden_dim}, k={k}, epochs={epochs})"
        )
        sae_training_status.resolved_hidden = hidden_dim
        sae_training_status.resolved_k = k
        sae_training_status.n_vectors = n

        # Drop previous in-RAM model (file replaced on install)
        sae_manager.unload()

        def progress_cb(
            completed: float,
            total_epochs: int,
            loss: float,
            detail: str = "",
        ) -> None:
            completed_f = float(completed)
            total_epochs = int(total_epochs)
            completed_i = int(completed_f) if completed_f < total_epochs else total_epochs
            remaining = max(0, total_epochs - completed_i)
            # Keep a fractional "still in this epoch" remaining feel
            if completed_f < total_epochs and completed_f > completed_i:
                remaining = max(0, total_epochs - completed_i - 1)
            pct = (
                round(100.0 * min(completed_f, float(total_epochs)) / total_epochs, 1)
                if total_epochs
                else 0.0
            )
            sae_training_status.current_epoch = completed_i
            sae_training_status.total_epochs = total_epochs
            sae_training_status.remaining_epochs = remaining
            sae_training_status.percent = min(99.0, pct) if completed_f < total_epochs else pct
            sae_training_status.loss = float(loss)
            sae_training_status.phase_key = "training"
            sae_training_status.status = "training"
            if detail:
                sae_training_status.phase = detail
            elif completed_f < total_epochs:
                running = min(total_epochs, completed_i + 1)
                loss_bit = f" · loss={loss:.6f}" if loss else ""
                sae_training_status.phase = (
                    f"Training epoch {running}/{total_epochs} — "
                    f"{remaining} remaining{loss_bit}"
                )
            else:
                sae_training_status.phase = (
                    f"Epochs done {total_epochs}/{total_epochs} · loss={loss:.6f}"
                )
            sae_training_status.message = sae_training_status.phase

        sae_training_status.phase_key = "training"
        sae_training_status.phase = (
            f"Training epoch 1/{epochs} — {epochs} remaining"
        )
        sae_training_status.message = sae_training_status.phase
        metrics, checkpoint = await asyncio.to_thread(
            train_sae,
            vectors=vectors,
            hidden_dim=hidden_dim,
            k=k,
            epochs=epochs,
            lr=lr,
            batch_size=batch_size,
            device_name=os.getenv("SAE_DEVICE", "AUTO"),
            output_path=None,
            progress_cb=progress_cb,
        )

        sae_training_status.phase_key = "installing"
        sae_training_status.current_epoch = epochs
        sae_training_status.remaining_epochs = 0
        sae_training_status.percent = 99.0
        sae_training_status.phase = "Saving checkpoint…"
        sae_training_status.message = (
            f"Saving checkpoint… ({hidden_dim}D · k={k} · n={n})"
        )
        sae_manager.device = _resolve_sae_device()
        sae_manager.install_checkpoint(checkpoint, persist=True)

        sae_training_status.metrics = metrics
        sae_training_status.status = "success"
        sae_training_status.phase_key = "ready"
        sae_training_status.percent = 100.0
        sae_training_status.remaining_epochs = 0
        sae_training_status.phase = "Ready"
        sae_training_status.message = (
            f"Ready — saved SAE {hidden_dim}D · k={k} · n={n}"
        )
        logger.info("SAE training completed (checkpoint saved).")

    except Exception as e:
        logger.exception("SAE training failed")
        sae_manager.clear(delete_file=False)
        sae_training_status.status = "failed"
        sae_training_status.phase_key = "failed"
        sae_training_status.phase = "failed"
        sae_training_status.error_message = str(e)
        sae_training_status.message = str(e)


@router.get("/sae/status")
async def sae_status() -> dict[str, Any]:
    is_trained = sae_manager.is_trained()
    status_info: dict[str, Any] = {
        "is_trained": is_trained,
        "ephemeral": False,
        "persisted": sae_manager.has_checkpoint_file(),
        "weights_path": SAE_WEIGHTS_PATH,
        "config": None,
        "metrics": None,
        "training": {
            "status": sae_training_status.status,
            "phase": sae_training_status.phase,
            "phase_key": sae_training_status.phase_key,
            "message": sae_training_status.message,
            "current_epoch": sae_training_status.current_epoch,
            "total_epochs": sae_training_status.total_epochs,
            "remaining_epochs": sae_training_status.remaining_epochs,
            "percent": sae_training_status.percent,
            "loss": sae_training_status.loss,
            "error_message": sae_training_status.error_message,
            "metrics": sae_training_status.metrics,
            "resolved_hidden": sae_training_status.resolved_hidden,
            "resolved_k": sae_training_status.resolved_k,
            "n_vectors": sae_training_status.n_vectors,
        },
    }
    if is_trained:
        if sae_manager.load_model():
            status_info["config"] = sae_manager.config
            status_info["metrics"] = sae_manager.metrics
    return status_info


@router.post("/sae/clear")
async def sae_clear() -> dict[str, Any]:
    """Delete the saved SAE checkpoint and drop RAM weights (Retrain confirm)."""
    if sae_training_status.status == "training":
        raise HTTPException(
            status_code=400,
            detail="Cannot clear SAE while a training job is in progress.",
        )
    sae_manager.clear(delete_file=True)
    sae_training_status.status = "idle"
    sae_training_status.phase = "idle"
    sae_training_status.phase_key = "idle"
    sae_training_status.message = ""
    sae_training_status.metrics = None
    sae_training_status.error_message = None
    sae_training_status.resolved_hidden = None
    sae_training_status.resolved_k = None
    sae_training_status.n_vectors = None
    sae_training_status.current_epoch = 0
    sae_training_status.total_epochs = 0
    sae_training_status.remaining_epochs = 0
    sae_training_status.percent = 0.0
    return {"message": "SAE checkpoint deleted.", "is_trained": False}


@router.post("/sae/train")
async def sae_train(request: SAETrainRequest) -> dict[str, Any]:
    if sae_training_status.status == "training":
        raise HTTPException(
            status_code=400, detail="A training job is already in progress."
        )

    vectors = np.asarray(request.embeddings, dtype=np.float32)
    if vectors.ndim != 2:
        raise HTTPException(
            status_code=400, detail="embeddings must be a 2D array [N, D]"
        )
    if vectors.shape[0] < 2:
        raise HTTPException(
            status_code=400, detail="Need at least 2 embedding vectors to train SAE"
        )

    input_dim = int(vectors.shape[1])
    n_vectors = int(vectors.shape[0])
    if request.auto_scale:
        hidden_dim, k = suggest_sae_dims(
            n_vectors=n_vectors,
            input_dim=input_dim,
            requested_hidden=request.hidden_dim,
            requested_k=request.k,
        )
        epochs, batch_size = suggest_train_schedule(
            n_vectors=n_vectors,
            hidden_dim=hidden_dim,
            requested_epochs=request.epochs,
            requested_batch_size=request.batch_size,
        )
    else:
        hidden_dim, k = request.hidden_dim, request.k
        epochs, batch_size = request.epochs, request.batch_size

    if k > hidden_dim:
        raise HTTPException(status_code=400, detail="k must be <= hidden_dim")

    asyncio.create_task(
        _train_sae_task(
            vectors=vectors,
            hidden_dim=hidden_dim,
            k=k,
            epochs=epochs,
            lr=request.lr,
            batch_size=batch_size,
        )
    )
    return {
        "message": "Training started.",
        "status": "training",
        "resolved_hidden": hidden_dim,
        "resolved_k": k,
        "resolved_epochs": epochs,
        "resolved_batch_size": batch_size,
        "n_vectors": n_vectors,
        "device": _resolve_sae_device(),
        "auto_scaled": bool(
            request.auto_scale
            and (
                hidden_dim != request.hidden_dim
                or k != request.k
                or epochs != request.epochs
                or batch_size != request.batch_size
            )
        ),
    }


@router.post("/sae/encode")
async def sae_encode(request: SAEEncodeRequest) -> dict[str, Any]:
    """
    Encode embeddings → Top-K sparse activations (indices + values).

    Does NOT return a dense [N, hidden_dim] matrix (mostly zeros). Clients densify
    locally when needed. Model stays resident in RAM after first load_model().
    """
    if not sae_manager.is_trained():
        raise HTTPException(
            status_code=404,
            detail="No trained SAE model available. Please train one first.",
        )

    try:
        if not request.embeddings:
            # Ensure config is in RAM if only the checkpoint file exists
            sae_manager.load_model()
            hidden = int(sae_manager.config.get("hidden_dim", 8192))
            k = int(sae_manager.config.get("k", 32))
            return {
                "format": "topk_sparse",
                "indices": [],
                "values": [],
                "dimension": hidden,
                "k": k,
                "count": 0,
                "batch_metrics": {
                    "l0": 0.0,
                    "sparsity": 0.0,
                    "active_features": 0,
                },
            }

        vectors = np.asarray(request.embeddings, dtype=np.float32)
        if vectors.ndim != 2:
            raise HTTPException(
                status_code=400, detail="embeddings must be a 2D array [N, D]"
            )

        sparse = await asyncio.to_thread(sae_manager.encode_vectors_sparse, vectors)
        # ORJSON serializes ndarray; convert only the small [N, K] packs
        return {
            "format": sparse["format"],
            "indices": sparse["indices"].tolist(),
            "values": sparse["values"].tolist(),
            "dimension": int(sparse["dimension"]),
            "k": int(sparse["k"]),
            "count": int(sparse["count"]),
            "batch_metrics": sparse["batch_metrics"],
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception:
        logger.exception("Error encoding embeddings through SAE")
        raise HTTPException(status_code=500, detail="SAE encode failed") from None
