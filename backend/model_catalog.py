"""
Embedding model catalog — single source of truth for profiles and Hub IDs.

Resolves selection from env, builds SentenceTransformer, and encodes texts
with E5 prefixes / Matryoshka truncate / L2 norm in one adapter.
"""

from __future__ import annotations

import logging
import os
from collections.abc import Sequence
from dataclasses import dataclass, replace
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

# Explicit no-go list from roadmap §2.3 (must never appear in list_models).
NO_GO_HUB_IDS: frozenset[str] = frozenset(
    {
        "BAAI/bge-m3",
        "jinaai/jina-embeddings-v3",
    }
)


@dataclass(frozen=True, slots=True)
class ModelSelection:
    """Resolved embedding selection for env / setup / AppState (Slice 2+)."""

    hub_id: str
    profile: str | None
    trust_remote_code: bool
    e5_mode: bool
    truncate_dim: int | None
    gated: bool
    short_label: str


@dataclass(frozen=True, slots=True)
class _ModelEntry:
    hub_id: str
    short_label: str
    trust_remote_code: bool = False
    e5_mode: bool = False
    default_truncate_dim: int | None = None
    gated: bool = False


@dataclass(frozen=True, slots=True)
class ProfileInfo:
    id: str
    hub_id: str
    default_truncate_dim: int | None


# §2.1 required + §2.2 inferred extras (order = menu order later).
_MODELS: tuple[_ModelEntry, ...] = (
    _ModelEntry(
        hub_id="sentence-transformers/all-mpnet-base-v2",
        short_label="EN baseline (mpnet)",
    ),
    _ModelEntry(
        hub_id="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        short_label="MiniLM-multi",
    ),
    _ModelEntry(
        hub_id="Snowflake/snowflake-arctic-embed-m-v2.0",
        short_label="Arctic-m-v2",
        trust_remote_code=True,
        default_truncate_dim=256,
    ),
    _ModelEntry(
        hub_id="Alibaba-NLP/gte-multilingual-base",
        short_label="GTE-multi",
        trust_remote_code=True,
    ),
    _ModelEntry(
        hub_id="intfloat/multilingual-e5-small",
        short_label="E5-small-multi",
        e5_mode=True,
    ),
    _ModelEntry(
        hub_id="google/embeddinggemma-300m",
        short_label="EmbeddingGemma-300m",
        gated=True,
    ),
    _ModelEntry(
        hub_id="sentence-transformers/paraphrase-multilingual-mpnet-base-v2",
        short_label="mpnet-multi",
    ),
    _ModelEntry(
        hub_id="intfloat/multilingual-e5-base",
        short_label="E5-base-multi",
        e5_mode=True,
    ),
    _ModelEntry(
        hub_id="sentence-transformers/distiluse-base-multilingual-cased-v2",
        short_label="distiluse-multi",
    ),
)

_MODEL_BY_HUB: dict[str, _ModelEntry] = {m.hub_id: m for m in _MODELS}

# Named profiles (§2.4). hf-demo is a local preset only (same hub as local-comfort).
_PROFILES: dict[str, ProfileInfo] = {
    "local-comfort": ProfileInfo(
        id="local-comfort",
        hub_id="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        default_truncate_dim=None,
    ),
    "local-full": ProfileInfo(
        id="local-full",
        hub_id="Snowflake/snowflake-arctic-embed-m-v2.0",
        default_truncate_dim=256,
    ),
    "hf-demo": ProfileInfo(
        id="hf-demo",
        hub_id="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        default_truncate_dim=None,
    ),
}


def _selection_from_entry(
    entry: _ModelEntry,
    *,
    profile: str | None,
    truncate_dim: int | None,
) -> ModelSelection:
    return ModelSelection(
        hub_id=entry.hub_id,
        profile=profile,
        trust_remote_code=entry.trust_remote_code,
        e5_mode=entry.e5_mode,
        truncate_dim=truncate_dim,
        gated=entry.gated,
        short_label=entry.short_label,
    )


def list_models() -> Sequence[ModelSelection]:
    """Catalog models as ModelSelection with profile=None and entry default truncate."""
    return tuple(
        _selection_from_entry(
            entry,
            profile=None,
            truncate_dim=entry.default_truncate_dim,
        )
        for entry in _MODELS
    )


def list_profiles() -> Sequence[ProfileInfo]:
    """Named profiles in stable order: comfort, full, hf-demo."""
    order = ("local-comfort", "local-full", "hf-demo")
    return tuple(_PROFILES[pid] for pid in order)


def resolve_profile(profile_id: str) -> ModelSelection:
    """Map a profile id to a full ModelSelection (including default truncate_dim)."""
    info = _PROFILES.get(profile_id)
    if info is None:
        raise ValueError(f"unknown profile: {profile_id!r}")
    entry = _MODEL_BY_HUB.get(info.hub_id)
    if entry is None:
        raise ValueError(
            f"profile {profile_id!r} maps to missing catalog hub_id {info.hub_id!r}"
        )
    return _selection_from_entry(
        entry,
        profile=info.id,
        truncate_dim=info.default_truncate_dim,
    )


def _lookup_entry(hub_id: str) -> _ModelEntry | None:
    """Exact Hub ID or bare name matching a catalog suffix."""
    entry = _MODEL_BY_HUB.get(hub_id)
    if entry is not None:
        return entry
    bare = hub_id.split("/")[-1]
    matches = [m for m in _MODELS if m.hub_id == bare or m.hub_id.endswith("/" + bare)]
    if len(matches) == 1:
        return matches[0]
    return None


def get_model(hub_id: str) -> ModelSelection:
    """Look up a catalog model by Hub ID or bare name (no profile)."""
    entry = _lookup_entry(hub_id)
    if entry is None:
        raise ValueError(f"unknown model: {hub_id!r}")
    return _selection_from_entry(
        entry,
        profile=None,
        truncate_dim=entry.default_truncate_dim,
    )


def _parse_truncate_dim(raw: str | int | None) -> int | None:
    if raw is None:
        return None
    if isinstance(raw, int):
        return raw if raw > 0 else None
    text = str(raw).strip()
    if not text:
        return None
    value = int(text)
    if value <= 0:
        raise ValueError(f"TRUNCATE_DIM must be positive, got {value}")
    return value


def _passthrough_selection(hub_id: str, truncate_dim: int | None) -> ModelSelection:
    """Legacy / unlisted Hub ID — minimal flags inferred from the id string."""
    lower = hub_id.lower()
    return ModelSelection(
        hub_id=hub_id,
        profile=None,
        trust_remote_code=False,
        e5_mode="e5" in lower,
        truncate_dim=truncate_dim,
        gated=False,
        short_label=hub_id.split("/")[-1],
    )


def resolve_selection(
    *,
    profile: str | None = None,
    model_name: str | None = None,
    truncate_dim: int | None = None,
) -> ModelSelection:
    """
    Resolve ModelSelection from explicit knobs.

    Profile wins over model_name for hub_id. truncate_dim overrides profile/model defaults
    when provided (including overriding local-full's 256).
    """
    if profile and profile.strip():
        sel = resolve_profile(profile.strip())
        if truncate_dim is not None:
            return replace(sel, truncate_dim=truncate_dim)
        return sel

    name = (model_name or "").strip() or "sentence-transformers/all-mpnet-base-v2"
    entry = _lookup_entry(name)
    if entry is None:
        return _passthrough_selection(name, truncate_dim)
    sel = _selection_from_entry(
        entry,
        profile=None,
        truncate_dim=entry.default_truncate_dim,
    )
    if truncate_dim is not None:
        return replace(sel, truncate_dim=truncate_dim)
    return sel


def resolve_selection_from_env(
    *,
    profile: str | None = None,
    model_name: str | None = None,
    truncate_dim: str | int | None = None,
) -> ModelSelection:
    """Read MODEL_PROFILE / MODEL_NAME / TRUNCATE_DIM (args override env)."""
    env_profile = profile if profile is not None else os.getenv("MODEL_PROFILE")
    env_model = model_name if model_name is not None else os.getenv("MODEL_NAME")
    if truncate_dim is not None:
        dim = _parse_truncate_dim(truncate_dim)
    else:
        dim = _parse_truncate_dim(os.getenv("TRUNCATE_DIM"))
    return resolve_selection(
        profile=env_profile,
        model_name=env_model,
        truncate_dim=dim,
    )


def _gte_auto_model(st_model: Any) -> Any | None:
    """Return the underlying HF auto model for a SentenceTransformer, if present."""
    try:
        first = st_model[0]
    except (TypeError, IndexError, KeyError):
        return None
    return getattr(first, "auto_model", None)


def _repair_gte_nonpersistent_buffers(st_model: Any) -> None:
    """
    Re-init GTE/Arctic non-persistent buffers after transformers 5.x meta load.

    Remote GTE code registers position_ids / RoPE caches with persistent=False but
    does not restore them in _init_weights. transformers≥5 materializes on meta and
    leaves those buffers as uninitialized / zero storage → RoPE NaNs or IndexError.
    See HF transformers#43644 / #43950.
    """
    import torch

    auto = _gte_auto_model(st_model)
    if auto is None:
        return
    embeddings = getattr(auto, "embeddings", None)
    if embeddings is None:
        return

    position_ids = getattr(embeddings, "position_ids", None)
    if isinstance(position_ids, torch.Tensor) and position_ids.numel() > 0:
        expected = torch.arange(
            position_ids.numel(),
            device=position_ids.device,
            dtype=position_ids.dtype,
        )
        if not torch.equal(position_ids, expected):
            embeddings.register_buffer(
                "position_ids", expected, persistent=False
            )
            logger.info("Repaired GTE embeddings.position_ids after meta load")

    rotary = getattr(embeddings, "rotary_emb", None)
    if rotary is None:
        return
    dim = int(getattr(rotary, "dim", 0) or 0)
    base = float(getattr(rotary, "base", 10000.0) or 10000.0)
    max_pos = int(
        getattr(rotary, "max_position_embeddings", 0)
        or getattr(auto.config, "max_position_embeddings", 0)
        or 0
    )
    if dim <= 0 or max_pos <= 0:
        return
    device = next(auto.parameters()).device
    inv_freq = 1.0 / (
        base ** (torch.arange(0, dim, 2, device=device, dtype=torch.float32) / dim)
    )
    rotary.register_buffer("inv_freq", inv_freq, persistent=False)
    # Prefer the module's own cache builder (covers NTKScalingRotaryEmbedding).
    if hasattr(rotary, "_set_cos_sin_cache"):
        rotary._set_cos_sin_cache(
            seq_len=max_pos,
            device=device,
            dtype=torch.get_default_dtype(),
        )
    logger.info("Repaired GTE rotary_emb buffers after meta load")


def build_model(selection: ModelSelection, device: str) -> Any:
    """Construct SentenceTransformer for the selection (trust_remote_code when declared).

    Arctic (GTE remote code) ships with use_memory_efficient_attention=true and
    unpad_inputs=true, which hard-require xformers. That package is often
    unavailable on macOS/MPS and unnecessary for lab encode workloads, so we
    force both flags off via config_kwargs. Also repairs non-persistent RoPE /
    position buffers corrupted by transformers≥5 meta-device loading.
    """
    from sentence_transformers import SentenceTransformer

    kwargs: dict[str, Any] = {"device": device}
    if selection.trust_remote_code:
        kwargs["trust_remote_code"] = True
        # Arctic Hub config: use_memory_efficient_attention=true (+ unpad_inputs)
        # hard-requires xformers; without MEA, unpad+RoPE blows up on encode.
        # Force both off for CPU/MPS/lab loads (HF discussion #15).
        kwargs["config_kwargs"] = {
            "use_memory_efficient_attention": False,
            "unpad_inputs": False,
        }
    logger.info(
        "Building SentenceTransformer hub_id=%s trust_remote_code=%s device=%s",
        selection.hub_id,
        selection.trust_remote_code,
        device,
    )
    model = SentenceTransformer(selection.hub_id, **kwargs)
    if selection.trust_remote_code:
        _repair_gte_nonpersistent_buffers(model)
    return model


def _apply_e5_prefixes(texts: Sequence[str]) -> list[str]:
    """Symmetric lab tasks use query: for all strings (E5 STS guidance)."""
    out: list[str] = []
    for text in texts:
        t = text.strip()
        if t.startswith(("query:", "passage:")):
            out.append(t)
        else:
            out.append(f"query: {t}")
    return out


def _l2_normalize(matrix: np.ndarray) -> np.ndarray:
    if matrix.ndim == 1:
        norm = float(np.linalg.norm(matrix))
        if norm == 0:
            norm = 1e-9
        return (matrix / norm).astype(np.float32, copy=False)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1e-9
    return (matrix / norms).astype(np.float32, copy=False)


def encode_texts(
    model: Any,
    texts: str | Sequence[str],
    selection: ModelSelection,
    *,
    show_progress_bar: bool = False,
) -> np.ndarray:
    """
    Encode via the catalog adapter: optional E5 prefixes, truncate_dim, L2 normalize.

    Single string → 1-D float32 vector; sequence → 2-D (N, D).
    """
    single = isinstance(texts, str)
    batch: list[str] = [texts] if single else [str(t) for t in texts]
    if selection.e5_mode:
        batch = _apply_e5_prefixes(batch)

    raw = model.encode(
        batch, show_progress_bar=show_progress_bar, convert_to_numpy=True
    )
    arr = np.asarray(raw, dtype=np.float32)
    if arr.ndim == 1:
        arr = arr.reshape(1, -1)

    if selection.truncate_dim is not None:
        dim = selection.truncate_dim
        if dim > arr.shape[1]:
            raise ValueError(
                f"truncate_dim={dim} exceeds model embedding width {arr.shape[1]}"
            )
        arr = arr[:, :dim]

    arr = _l2_normalize(arr)
    if single:
        return arr[0]
    return arr
