"""
EN∪ES vocabulary merge (multillm Slice 4).

Languages beyond EN+ES are forbidden in this epic. Demo translation pairs from
roadmap §15 must appear in the merged file for cross-lingual lab demos.
"""

from __future__ import annotations

from pathlib import Path

# Cross-lingual demo pairs (EN, ES) — must survive merge.
DEMO_PAIRS: tuple[tuple[str, str], ...] = (
    ("king", "rey"),
    ("queen", "reina"),
    ("man", "hombre"),
    ("woman", "mujer"),
    ("apple", "manzana"),
    ("computer", "computadora"),
    ("water", "agua"),
    ("peace", "paz"),
    ("dog", "perro"),
    ("cat", "gato"),
)

DEMO_WORDS: frozenset[str] = frozenset(w for pair in DEMO_PAIRS for w in pair)

ALLOWED_LANG_TAGS = frozenset({"en", "es"})


def normalize_word(raw: str) -> str | None:
    word = raw.strip().lower()
    if not word or word.startswith("#"):
        return None
    return word


def load_vocab_lines(path: Path) -> list[str]:
    if not path.is_file():
        raise FileNotFoundError(f"Vocab file not found: {path}")
    words: list[str] = []
    seen: set[str] = set()
    with open(path, encoding="utf-8") as f:
        for line in f:
            word = normalize_word(line)
            if word is None or word in seen:
                continue
            seen.add(word)
            words.append(word)
    return words


def merge_vocab_lists(
    *lists: list[str],
    ensure_words: frozenset[str] | None = None,
) -> list[str]:
    """Lowercase dedupe preserving first-seen order; append any missing ensure_words."""
    merged: list[str] = []
    seen: set[str] = set()
    for lst in lists:
        for word in lst:
            w = normalize_word(word)
            if w is None or w in seen:
                continue
            seen.add(w)
            merged.append(w)
    required = ensure_words if ensure_words is not None else DEMO_WORDS
    for word in sorted(required):
        if word not in seen:
            seen.add(word)
            merged.append(word)
    return merged


def merge_en_es_files(
    en_path: Path,
    es_path: Path,
    out_path: Path,
    *,
    ensure_demo_pairs: bool = True,
) -> list[str]:
    """Merge EN + ES vocab files → out_path (one word per line)."""
    en_words = load_vocab_lines(en_path)
    es_words = load_vocab_lines(es_path)
    ensure = DEMO_WORDS if ensure_demo_pairs else frozenset()
    merged = merge_vocab_lists(en_words, es_words, ensure_words=ensure)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.writelines(f"{word}\n" for word in merged)
    return merged


def assert_demo_pairs_present(words: list[str] | set[str]) -> None:
    present = {normalize_word(w) for w in words if normalize_word(w)}
    missing = sorted(DEMO_WORDS - present)
    if missing:
        raise AssertionError(f"Merged vocab missing demo words: {missing}")
