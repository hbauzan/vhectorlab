#!/usr/bin/env python3
"""Benchmark catalog embedding models and write the local JSON cache.

Does not modify ``.env`` or the process that serves the app.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from backend.benchmark_runner import (
    NO_CACHED_MODELS_MESSAGE,
    benchmark_targets,
    format_benchmark_table,
    results_as_json,
    run_model_benchmark,
    save_benchmark_cache,
)


def main(argv: list[str] | None = None) -> int:
    parser = _parser()
    args = parser.parse_args(argv)
    try:
        targets = benchmark_targets(
            model=args.model,
            cached_only=args.cached_only,
            all_models=args.all_models,
        )
        if not targets:
            _write_empty(as_json=args.json)
            return 0
        results = []
        for selection in targets:
            result = run_model_benchmark(selection, device=args.device)
            save_benchmark_cache(result)
            results.append(result)
    except ValueError as exc:
        return _fail(str(exc), as_json=args.json)
    except Exception as exc:
        if not args.json:
            raise
        return _fail(f"{type(exc).__name__}: {exc}", as_json=True)

    if args.json:
        sys.stdout.write(results_as_json(results))
    else:
        sys.stdout.write(format_benchmark_table(results))
    return 0


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Measure local embedding throughput and store it as JSON."
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--model",
        metavar="HUB_OR_TOKEN",
        help="Hub id, bare name, profile id, or menu token (P1, M1, bge-m3)",
    )
    group.add_argument(
        "--cached-only",
        action="store_true",
        help="Benchmark catalog models already present in the Hugging Face cache",
    )
    group.add_argument(
        "--all",
        action="store_true",
        dest="all_models",
        help="Benchmark every catalog model (downloads missing weights)",
    )
    parser.add_argument(
        "--device",
        default="AUTO",
        choices=("AUTO", "MPS", "CUDA", "CPU"),
        help="Force the torch device (default: AUTO)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print only a JSON list of results",
    )
    return parser


def _write_empty(*, as_json: bool) -> None:
    if as_json:
        sys.stdout.write("[]\n")
        return
    sys.stdout.write(NO_CACHED_MODELS_MESSAGE + "\n")


def _fail(message: str, *, as_json: bool) -> int:
    if as_json:
        sys.stdout.write(json.dumps({"error": message}) + "\n")
    else:
        sys.stderr.write(message + "\n")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
