"""EN∪ES vocab merge + demo pair presence."""

from __future__ import annotations

from pathlib import Path

import pytest
from backend.vocab_merge import (
    DEMO_PAIRS,
    DEMO_WORDS,
    assert_demo_pairs_present,
    merge_en_es_files,
    merge_vocab_lists,
)


def test_merge_dedupes_and_lowercases():
    merged = merge_vocab_lists(
        ["King", "queen", "man"],
        ["rey", "QUEEN", "mujer"],
        ensure_words=frozenset(),
    )
    assert merged == ["king", "queen", "man", "rey", "mujer"]


def test_merge_ensures_demo_words():
    merged = merge_vocab_lists(["alpha"], ["beta"], ensure_words=DEMO_WORDS)
    assert_demo_pairs_present(merged)
    for en, es in DEMO_PAIRS:
        assert en in merged
        assert es in merged


def test_merge_en_es_files_roundtrip(tmp_path: Path):
    en = tmp_path / "en.txt"
    es = tmp_path / "es.txt"
    out = tmp_path / "merged.txt"
    en.write_text("king\nwoman\nzzz\n", encoding="utf-8")
    es.write_text("rey\nmujer\naaa\n", encoding="utf-8")
    merged = merge_en_es_files(en, es, out)
    text = out.read_text(encoding="utf-8")
    lines = [ln for ln in text.splitlines() if ln.strip()]
    assert lines == merged
    assert_demo_pairs_present(merged)
    assert "zzz" in merged
    assert "aaa" in merged


def test_assert_demo_pairs_raises_when_missing():
    with pytest.raises(AssertionError, match="missing demo"):
        assert_demo_pairs_present(["king", "rey"])


def test_repo_seed_es_contains_demo_spanish():
    root = Path(__file__).resolve().parents[2]
    es_path = root / "public" / "vocab_es.txt"
    assert es_path.is_file()
    words = {
        ln.strip().lower()
        for ln in es_path.read_text(encoding="utf-8").splitlines()
        if ln.strip() and not ln.strip().startswith("#")
    }
    for _, es in DEMO_PAIRS:
        assert es in words, f"vocab_es.txt missing {es}"
