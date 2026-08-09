"""
Embedding model catalog — single source of truth for profiles and Hub IDs.

Slice 1: selection types + resolve APIs only (no SentenceTransformer load).
Encode/build adapters land in Slice 2.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

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


def get_model(hub_id: str) -> ModelSelection:
    """Look up a catalog model by Hub ID (no profile)."""
    entry = _MODEL_BY_HUB.get(hub_id)
    if entry is None:
        raise ValueError(f"unknown model: {hub_id!r}")
    return _selection_from_entry(
        entry,
        profile=None,
        truncate_dim=entry.default_truncate_dim,
    )
