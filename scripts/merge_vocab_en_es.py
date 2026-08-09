#!/usr/bin/env python3
"""
Merge English + Spanish vocabulary into one file (EN∪ES, lowercase dedupe).

Default paths:
  EN: public/vocab.txt
  ES: public/vocab_es.txt
  OUT: public/vocab_en_es.txt

Then point VOCAB_PATH at the merged file and re-run precompute / setup option 11.
Languages beyond EN+ES are out of scope for this epic.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def _repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def main() -> int:
    root = _repo_root()
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    from backend.vocab_merge import assert_demo_pairs_present, merge_en_es_files

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--en",
        type=Path,
        default=root / "public" / "vocab.txt",
        help="English vocab path",
    )
    parser.add_argument(
        "--es",
        type=Path,
        default=root / "public" / "vocab_es.txt",
        help="Spanish vocab path",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=root / "public" / "vocab_en_es.txt",
        help="Merged output path",
    )
    args = parser.parse_args()

    en = args.en if args.en.is_absolute() else root / args.en
    es = args.es if args.es.is_absolute() else root / args.es
    out = args.out if args.out.is_absolute() else root / args.out

    merged = merge_en_es_files(en, es, out)
    assert_demo_pairs_present(merged)
    print(f"Wrote {out} ({len(merged)} words, EN∪ES, demo pairs OK)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
