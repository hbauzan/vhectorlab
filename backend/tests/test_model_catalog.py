"""Unit tests for embedding model catalog (no SentenceTransformer download)."""

from __future__ import annotations

import pytest
from backend.model_catalog import (
    NO_GO_HUB_IDS,
    ModelSelection,
    get_model,
    list_models,
    list_profiles,
    resolve_profile,
)

# §2.1 required + §2.2 inferred extras
REQUIRED_HUB_IDS = frozenset(
    {
        "sentence-transformers/all-mpnet-base-v2",
        "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        "Snowflake/snowflake-arctic-embed-m-v2.0",
        "Alibaba-NLP/gte-multilingual-base",
        "intfloat/multilingual-e5-small",
        "google/embeddinggemma-300m",
        "sentence-transformers/paraphrase-multilingual-mpnet-base-v2",
        "intfloat/multilingual-e5-base",
        "sentence-transformers/distiluse-base-multilingual-cased-v2",
    }
)

NO_GO_EXAMPLES = frozenset(
    {
        "BAAI/bge-m3",
        "jinaai/jina-embeddings-v3",
    }
)


def test_resolve_local_comfort():
    sel = resolve_profile("local-comfort")
    assert isinstance(sel, ModelSelection)
    assert sel.profile == "local-comfort"
    assert sel.hub_id == ("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    assert sel.trust_remote_code is False
    assert sel.e5_mode is False
    assert sel.truncate_dim is None
    assert sel.gated is False
    assert sel.short_label


def test_resolve_hf_demo_matches_comfort_hub():
    comfort = resolve_profile("local-comfort")
    demo = resolve_profile("hf-demo")
    assert demo.profile == "hf-demo"
    assert demo.hub_id == comfort.hub_id
    assert demo.truncate_dim is None


def test_resolve_local_full_defaults_truncate_256():
    sel = resolve_profile("local-full")
    assert sel.profile == "local-full"
    assert sel.hub_id == "Snowflake/snowflake-arctic-embed-m-v2.0"
    assert sel.trust_remote_code is True
    assert sel.truncate_dim == 256
    assert sel.e5_mode is False
    assert sel.gated is False


def test_resolve_unknown_profile_raises():
    with pytest.raises(ValueError, match="unknown profile"):
        resolve_profile("does-not-exist")


def test_get_model_by_hub_id():
    sel = get_model("intfloat/multilingual-e5-small")
    assert sel.hub_id == "intfloat/multilingual-e5-small"
    assert sel.profile is None
    assert sel.e5_mode is True
    assert sel.trust_remote_code is False
    assert sel.gated is False
    assert sel.short_label


def test_get_model_arctic_and_gte_trust_remote_code():
    arctic = get_model("Snowflake/snowflake-arctic-embed-m-v2.0")
    gte = get_model("Alibaba-NLP/gte-multilingual-base")
    assert arctic.trust_remote_code is True
    assert gte.trust_remote_code is True


def test_get_model_embeddinggemma_gated():
    sel = get_model("google/embeddinggemma-300m")
    assert sel.gated is True


def test_get_model_unknown_raises():
    with pytest.raises(ValueError, match="unknown model"):
        get_model("BAAI/bge-m3")


def test_catalog_completeness_required_ids_present():
    catalog_ids = {m.hub_id for m in list_models()}
    missing = REQUIRED_HUB_IDS - catalog_ids
    assert not missing, f"missing catalog entries: {sorted(missing)}"


def test_no_go_ids_absent_from_catalog():
    catalog_ids = {m.hub_id for m in list_models()}
    leaked = catalog_ids & NO_GO_EXAMPLES
    assert not leaked, f"no-go ids in catalog: {sorted(leaked)}"
    assert NO_GO_EXAMPLES <= NO_GO_HUB_IDS


def test_list_profiles_known_ids():
    profiles = {p.id for p in list_profiles()}
    assert profiles == {"local-comfort", "local-full", "hf-demo"}


def test_e5_base_also_e5_mode():
    sel = get_model("intfloat/multilingual-e5-base")
    assert sel.e5_mode is True
