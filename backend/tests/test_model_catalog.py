"""Unit tests for embedding model catalog (no SentenceTransformer download)."""

from __future__ import annotations

import pytest
from backend.model_catalog import (
    NO_GO_HUB_IDS,
    MemoryTier,
    ModelFamily,
    ModelSelection,
    get_model,
    list_models,
    list_profiles,
    resolve_profile,
    resolve_selection,
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
        "BAAI/bge-m3",
    }
)

NO_GO_EXAMPLES = frozenset(
    {
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
        get_model("invalid/non-existent-model")


def test_get_model_bge_m3():
    sel = get_model("BAAI/bge-m3")
    assert sel.hub_id == "BAAI/bge-m3"
    assert sel.short_label == "BGE-M3"
    assert sel.trust_remote_code is False
    assert sel.gated is False


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


# Explicit slice-1 taxonomy. Kept in the test so a wrong catalog table fails.
_TAXONOMY: dict[str, tuple[ModelFamily, MemoryTier]] = {
    "sentence-transformers/all-mpnet-base-v2": (
        ModelFamily.UKPLAB,
        MemoryTier.MEDIUM,
    ),
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2": (
        ModelFamily.UKPLAB,
        MemoryTier.LIGHT,
    ),
    "Snowflake/snowflake-arctic-embed-m-v2.0": (
        ModelFamily.SNOWFLAKE,
        MemoryTier.MEDIUM,
    ),
    "Alibaba-NLP/gte-multilingual-base": (
        ModelFamily.ALIBABA,
        MemoryTier.MEDIUM,
    ),
    "intfloat/multilingual-e5-small": (
        ModelFamily.INTFLOAT,
        MemoryTier.LIGHT,
    ),
    "google/embeddinggemma-300m": (
        ModelFamily.GOOGLE,
        MemoryTier.LIGHT,
    ),
    "sentence-transformers/paraphrase-multilingual-mpnet-base-v2": (
        ModelFamily.UKPLAB,
        MemoryTier.MEDIUM,
    ),
    "intfloat/multilingual-e5-base": (
        ModelFamily.INTFLOAT,
        MemoryTier.MEDIUM,
    ),
    "sentence-transformers/distiluse-base-multilingual-cased-v2": (
        ModelFamily.UKPLAB,
        MemoryTier.MEDIUM,
    ),
    "BAAI/bge-m3": (ModelFamily.BAAI, MemoryTier.FULL),
}


def test_family_and_tier_labels_match_the_slice_contract():
    assert ModelFamily.BAAI.value == "BAAI"
    assert ModelFamily.SNOWFLAKE.value == "Snowflake"
    assert ModelFamily.ALIBABA.value == "Alibaba"
    assert ModelFamily.INTFLOAT.value == "Intfloat (E5)"
    assert ModelFamily.UKPLAB.value == "UKPLab (Sentence-Transformers)"
    assert ModelFamily.GOOGLE.value == "Google"
    assert MemoryTier.LIGHT.value == "LIGERO (<500MB)"
    assert MemoryTier.MEDIUM.value == "MEDIO (500MB-1.5GB)"
    assert MemoryTier.FULL.value == "COMPLETO (>1.5GB)"


def test_every_catalog_model_has_assigned_family_and_tier():
    models = list(list_models())
    assert {m.hub_id for m in models} == set(_TAXONOMY)
    for sel in models:
        assert type(sel.family) is ModelFamily
        assert type(sel.memory_tier) is MemoryTier
        assert (sel.family, sel.memory_tier) == _TAXONOMY[sel.hub_id]
        again = get_model(sel.hub_id)
        assert again.family is sel.family
        assert again.memory_tier is sel.memory_tier
        assert again.profile is None


def test_every_profile_has_family_and_tier_of_its_hub():
    profiles = list(list_profiles())
    assert profiles, "profile list is empty"
    for profile in profiles:
        assert type(profile.family) is ModelFamily
        assert type(profile.memory_tier) is MemoryTier
        model = get_model(profile.hub_id)
        assert profile.family is model.family
        assert profile.memory_tier is model.memory_tier


def test_resolve_selection_keeps_existing_fields_and_adds_taxonomy():
    """model_swap.resolve_choice / resolve_selection keyword signature stays."""
    from backend.model_swap import resolve_choice

    sel = resolve_selection(profile="local-full", truncate_dim=128)
    assert sel.hub_id == "Snowflake/snowflake-arctic-embed-m-v2.0"
    assert sel.profile == "local-full"
    assert sel.trust_remote_code is True
    assert sel.e5_mode is False
    assert sel.truncate_dim == 128
    assert sel.gated is False
    assert sel.short_label == "Arctic-m-v2"
    assert sel.family is ModelFamily.SNOWFLAKE
    assert sel.memory_tier is MemoryTier.MEDIUM

    default = resolve_selection()
    assert default.hub_id == "sentence-transformers/all-mpnet-base-v2"
    assert default.profile is None
    assert default.truncate_dim is None
    assert default.family is ModelFamily.UKPLAB
    assert default.memory_tier is MemoryTier.MEDIUM

    chosen = resolve_choice(model="BAAI/bge-m3")
    assert chosen.hub_id == "BAAI/bge-m3"
    assert chosen.profile is None
    assert chosen.trust_remote_code is False
    assert chosen.e5_mode is False
    assert chosen.gated is False
    assert chosen.short_label == "BGE-M3"
    assert chosen.family is ModelFamily.BAAI
    assert chosen.memory_tier is MemoryTier.FULL


def test_memory_tier_without_family_is_rejected():
    with pytest.raises(ValueError, match="family"):
        ModelSelection(
            hub_id="stub/local",
            profile=None,
            trust_remote_code=False,
            e5_mode=False,
            truncate_dim=None,
            gated=False,
            short_label="stub",
            memory_tier=MemoryTier.FULL,
        )


def test_unlisted_hub_keeps_passthrough_and_does_not_invent_a_tier():
    """Weight class exists only for the ten catalog ids. Publisher may be inferred."""
    e5 = resolve_selection(model_name="intfloat/multilingual-e5-large")
    assert e5.hub_id == "intfloat/multilingual-e5-large"
    assert e5.profile is None
    assert e5.e5_mode is True
    assert e5.trust_remote_code is False
    assert e5.gated is False
    assert e5.short_label == "multilingual-e5-large"
    assert e5.family is ModelFamily.INTFLOAT
    assert e5.memory_tier is None

    unknown = resolve_selection(model_name="acme/custom-embed")
    assert unknown.hub_id == "acme/custom-embed"
    assert unknown.e5_mode is False
    assert unknown.short_label == "custom-embed"
    assert unknown.family is None
    assert unknown.memory_tier is None
