"""Structural-noise engine API: status, detection, and profile cache."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from backend.model_catalog import encode_texts
from backend.state import state
from backend.structural_noise import ModelNoiseProfile, detect_structural_noise
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, ValidationError

router = APIRouter(tags=["Engine"])

NOISE_PROFILES_DIR = (
    Path(__file__).resolve().parent.parent / "artifacts" / "noise_profiles"
)
_VOCAB_CANDIDATES = ("public/vocab_en_es.txt", "public/vocab.txt")
_CALIBRATION_WORDS = 500


def get_model_safe_filename(model_name: str) -> str:
    """Sanitize model identifier into a clean filesystem filename."""
    cleaned = model_name.strip().replace("/", "_").replace("\\", "_").replace(" ", "_")
    return cleaned + ".json"


class EngineStatusResponse(BaseModel):
    model_name: str
    model_profile: str | None
    embedding_dim: int | None
    accelerator: str
    is_loaded: bool
    has_cached_profile: bool
    vocab_size: int


class DetectNoiseRequest(BaseModel):
    force_recompute: bool = False
    sat_threshold_z: float = 3.0
    flat_threshold_sigma: float = 0.010


class ModelNoiseProfileResponse(BaseModel):
    model_name: str
    embedding_dim: int
    noise_indices: list[int]
    saturated_indices: list[int]
    flat_indices: list[int]
    energy_ratio: float
    cosine_delta: float
    timestamp_utc: str


def _profile_path(model_name: str) -> Path:
    return NOISE_PROFILES_DIR / get_model_safe_filename(model_name)


def _profile_to_dict(profile: ModelNoiseProfile) -> dict[str, object]:
    return {
        "model_name": profile.model_name,
        "embedding_dim": profile.embedding_dim,
        "noise_indices": list(profile.noise_indices),
        "saturated_indices": list(profile.saturated_indices),
        "flat_indices": list(profile.flat_indices),
        "energy_ratio": profile.energy_ratio,
        "cosine_delta": profile.cosine_delta,
        "timestamp_utc": profile.timestamp_utc,
    }


def _profile_from_dict(data: dict[str, object]) -> ModelNoiseProfile:
    parsed = ModelNoiseProfileResponse.model_validate(data)
    return ModelNoiseProfile(
        model_name=parsed.model_name,
        embedding_dim=parsed.embedding_dim,
        noise_indices=tuple(parsed.noise_indices),
        saturated_indices=tuple(parsed.saturated_indices),
        flat_indices=tuple(parsed.flat_indices),
        energy_ratio=parsed.energy_ratio,
        cosine_delta=parsed.cosine_delta,
        timestamp_utc=parsed.timestamp_utc,
    )


def _to_response(profile: ModelNoiseProfile) -> ModelNoiseProfileResponse:
    return ModelNoiseProfileResponse.model_validate(_profile_to_dict(profile))


def _read_disk(model_name: str) -> ModelNoiseProfile | None:
    path = _profile_path(model_name)
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return None
        return _profile_from_dict(data)
    except (OSError, json.JSONDecodeError, KeyError, TypeError, ValueError):
        return None


def _write_disk(profile: ModelNoiseProfile) -> None:
    NOISE_PROFILES_DIR.mkdir(parents=True, exist_ok=True)
    path = _profile_path(profile.model_name)
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(
        json.dumps(_profile_to_dict(profile)),
        encoding="utf-8",
    )
    temporary.replace(path)


def _vocab_text_path() -> Path | None:
    root = Path(__file__).resolve().parents[2]
    for relative in _VOCAB_CANDIDATES:
        candidate = root / relative
        if candidate.is_file():
            return candidate
    return None


def _read_calibration_words(path: Path, limit: int = _CALIBRATION_WORDS) -> list[str]:
    words: list[str] = []
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            word = line.strip()
            if not word:
                continue
            words.append(word)
            if len(words) >= limit:
                break
    return words


def _calibration_matrix() -> np.ndarray | None:
    if state.model is None or state.selection is None:
        return None
    path = _vocab_text_path()
    if path is None:
        return None
    words = _read_calibration_words(path)
    if len(words) < 2:
        return None
    encoded = encode_texts(state.model, words, state.selection, show_progress_bar=False)
    matrix = np.asarray(encoded)
    if matrix.ndim != 2 or matrix.shape[0] < 2:
        return None
    return matrix


def _matrix_from_state() -> np.ndarray | None:
    embeddings = state.vocab_embeddings
    if (
        isinstance(embeddings, np.ndarray)
        and embeddings.ndim == 2
        and embeddings.shape[0] >= 2
    ):
        return embeddings
    if state.model is None:
        return None
    return _calibration_matrix()


def _cached_profile(model_name: str) -> ModelNoiseProfile | None:
    if state.noise_profile is not None:
        return state.noise_profile
    loaded = _read_disk(model_name)
    if loaded is None:
        return None
    state.noise_profile = loaded
    return loaded


@router.get("/engine/status", response_model=EngineStatusResponse)
def engine_status() -> EngineStatusResponse:
    embeddings = state.vocab_embeddings
    vocab_size = len(state.vocab_words) or (
        int(embeddings.shape[0]) if embeddings is not None else 0
    )
    model_name = state.model_name
    has_cached = state.noise_profile is not None or _profile_path(model_name).is_file()
    return EngineStatusResponse(
        model_name=model_name,
        model_profile=state.model_profile,
        embedding_dim=state.embedding_dim,
        accelerator=state.device,
        is_loaded=state.is_loaded,
        has_cached_profile=has_cached,
        vocab_size=vocab_size,
    )


@router.post(
    "/engine/detect-structural-noise",
    response_model=ModelNoiseProfileResponse,
)
async def detect_structural_noise_endpoint(
    request: Request,
    force_recompute: bool | None = Query(default=None),
) -> ModelNoiseProfileResponse:
    raw = await request.body()
    if raw.strip():
        try:
            payload = DetectNoiseRequest.model_validate_json(raw)
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail=exc.errors()) from exc
    else:
        payload = DetectNoiseRequest()
    if force_recompute is not None:
        payload = payload.model_copy(update={"force_recompute": force_recompute})

    model_name = state.model_name
    if not payload.force_recompute:
        cached = _cached_profile(model_name)
        if cached is not None:
            return _to_response(cached)

    matrix = _matrix_from_state()
    if matrix is None:
        raise HTTPException(
            status_code=503,
            detail="No embeddings or active model available for noise detection.",
        )

    profile = detect_structural_noise(
        matrix,
        model_name=model_name,
        sat_threshold_z=payload.sat_threshold_z,
        flat_threshold_sigma=payload.flat_threshold_sigma,
    )
    state.noise_profile = profile
    _write_disk(profile)
    return _to_response(profile)


@router.get("/engine/noise-profile", response_model=ModelNoiseProfileResponse)
def get_noise_profile() -> ModelNoiseProfileResponse:
    profile = _cached_profile(state.model_name)
    if profile is None:
        raise HTTPException(
            status_code=404,
            detail="No cached noise profile for active model.",
        )
    return _to_response(profile)
