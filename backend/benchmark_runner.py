"""Micro-benchmark results and atomic JSON cache.

Machine-local measurements. The cache file is not a product contract.
"""

from __future__ import annotations

import json
import math
import os
import random
import statistics
import time
from collections.abc import Sequence
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

import psutil
from backend.device import get_optimal_device
from backend.model_catalog import (
    ModelSelection,
    build_model,
    encode_texts,
    list_models,
)

_DEVICES = frozenset({"mps", "cuda", "cpu"})
NO_CACHED_MODELS_MESSAGE = "No catalog models in the local Hugging Face cache."
_DECK_SIZE = 500
_DECK_SEED = 42
_WARMUP_ITEMS = 32
_TIMED_RUNS = 3
_BYTES_PER_MB = 1024 * 1024
_FALLBACK_EN = (
    "king",
    "queen",
    "man",
    "woman",
    "water",
    "house",
    "white",
    "cat",
    "dog",
    "sun",
)
_FALLBACK_ES = (
    "rey",
    "reina",
    "hombre",
    "mujer",
    "agua",
    "casa",
    "blanco",
    "gato",
    "perro",
    "sol",
)
_FLOAT_FIELDS = (
    "cold_load_sec",
    "warmup_sec",
    "throughput_wps",
    "peak_ram_mb",
    "estimated_vocab_sec",
)


@dataclass(frozen=True, slots=True)
class ModelBenchmarkResult:
    hub_id: str
    short_label: str
    family: str
    memory_tier: str
    device: str
    cold_load_sec: float
    warmup_sec: float
    throughput_wps: float
    peak_ram_mb: float
    estimated_vocab_sec: float
    timestamp_utc: str

    def __post_init__(self) -> None:
        for name in ("hub_id", "short_label", "family", "memory_tier", "timestamp_utc"):
            value = getattr(self, name)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{name} must be a non-empty string")
        if self.device not in _DEVICES:
            raise ValueError(
                f"device must be one of {sorted(_DEVICES)}, got {self.device!r}"
            )
        for name in _FLOAT_FIELDS:
            value = getattr(self, name)
            number = _real_number(value, name)
            if number < 0:
                raise ValueError(f"{name} must be >= 0, got {value!r}")
            object.__setattr__(self, name, number)


def default_benchmark_cache_path() -> Path:
    return Path(__file__).resolve().parent / "artifacts" / "benchmark_cache.json"


def load_benchmark_cache(
    cache_path: Path | None = None,
) -> dict[str, ModelBenchmarkResult]:
    """Return cached results keyed by hub id.

    A missing file, unreadable file, or JSON that is not an object yields
    an empty dict. Rows that do not match ``ModelBenchmarkResult`` are skipped.
    """
    path = cache_path if cache_path is not None else default_benchmark_cache_path()
    try:
        text = path.read_text(encoding="utf-8")
    except (FileNotFoundError, OSError):
        return {}
    try:
        raw = json.loads(text)
    except json.JSONDecodeError:
        return {}
    if not isinstance(raw, dict):
        return {}

    loaded: dict[str, ModelBenchmarkResult] = {}
    for key, entry in raw.items():
        parsed = _parse_entry(entry)
        if parsed is None or parsed.hub_id != key:
            continue
        loaded[parsed.hub_id] = parsed
    return loaded


def save_benchmark_cache(
    result: ModelBenchmarkResult,
    cache_path: Path | None = None,
) -> None:
    """Insert ``result`` under its hub id and replace the cache atomically."""
    path = cache_path if cache_path is not None else default_benchmark_cache_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    current = load_benchmark_cache(path)
    current[result.hub_id] = result
    payload = {hub_id: asdict(item) for hub_id, item in sorted(current.items())}
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def _parse_entry(entry: object) -> ModelBenchmarkResult | None:
    if not isinstance(entry, dict):
        return None
    try:
        return ModelBenchmarkResult(
            hub_id=_as_str(entry["hub_id"]),
            short_label=_as_str(entry["short_label"]),
            family=_as_str(entry["family"]),
            memory_tier=_as_str(entry["memory_tier"]),
            device=_as_str(entry["device"]),
            cold_load_sec=_as_float(entry["cold_load_sec"]),
            warmup_sec=_as_float(entry["warmup_sec"]),
            throughput_wps=_as_float(entry["throughput_wps"]),
            peak_ram_mb=_as_float(entry["peak_ram_mb"]),
            estimated_vocab_sec=_as_float(entry["estimated_vocab_sec"]),
            timestamp_utc=_as_str(entry["timestamp_utc"]),
        )
    except (KeyError, TypeError, ValueError):
        return None


def _as_str(value: object) -> str:
    if not isinstance(value, str):
        raise TypeError
    return value


def _real_number(value: object, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise TypeError(f"{label} must be a real number, got {value!r}")
    number = float(value)
    if not math.isfinite(number):
        raise ValueError(f"{label} must be finite, got {value!r}")
    return number


def _as_float(value: object) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise TypeError
    return float(value)


def default_vocab_path() -> Path:
    return Path(__file__).resolve().parents[1] / "public" / "vocab_en_es.txt"


def vocab_projection_words(vocab_path: Path | None = None) -> int:
    """Non-empty line count of the projection vocabulary.

    ``10338`` is the measured count of ``public/vocab_en_es.txt``, not a
    copied constant. Pass a path to count another file.
    """
    path = vocab_path if vocab_path is not None else default_vocab_path()
    if not path.is_file():
        raise FileNotFoundError(path)
    return len(_vocab_lines(path))


def benchmark_deck(
    size: int = _DECK_SIZE,
    *,
    vocab_path: Path | None = None,
    seed: int = _DECK_SEED,
) -> tuple[str, ...]:
    """Deterministic deck. File sample when the vocab exists, else embedded."""
    if type(size) is not int or size < 1:
        raise ValueError(f"deck size must be an int >= 1, got {size!r}")
    path = vocab_path if vocab_path is not None else default_vocab_path()
    if path.is_file():
        words = _vocab_lines(path)
        if size > len(words):
            raise ValueError(
                f"deck size {size} exceeds vocabulary length {len(words)} in {path}"
            )
        return tuple(random.Random(seed).sample(words, size))
    pool = _fallback_pool()
    if size > len(pool):
        raise ValueError(
            f"deck size {size} exceeds embedded fallback length {len(pool)}"
        )
    return tuple(random.Random(seed).sample(list(pool), size))


def median_throughput_wps(n_items: int, run_seconds: Sequence[float]) -> float:
    """Words per second from the median run time.

    The numerator is the deck that was actually encoded. For the standard
    deck that is 500, which is ``500.0 / median_sec``.
    """
    if type(n_items) is not int:
        raise TypeError(f"n_items must be an int >= 1, got {n_items!r}")
    if n_items < 1:
        raise ValueError(f"n_items must be an int >= 1, got {n_items!r}")
    if not run_seconds:
        raise ValueError("run_seconds is empty")
    times: list[float] = []
    for value in run_seconds:
        number = _real_number(value, "run time")
        if number <= 0:
            raise ValueError(f"run time must be > 0, got {value!r}")
        times.append(number)
    return n_items / statistics.median(times)


def project_vocab_seconds(
    throughput_wps: float,
    vocab_words: int | None = None,
) -> float:
    """Linear projection of one full vocabulary pass at the measured rate."""
    rate = _real_number(throughput_wps, "throughput_wps")
    if rate <= 0:
        raise ValueError(f"throughput_wps must be > 0, got {throughput_wps!r}")
    count = vocab_projection_words() if vocab_words is None else vocab_words
    if type(count) is not int:
        raise TypeError(f"vocab_words must be an int >= 1, got {count!r}")
    if count < 1:
        raise ValueError(f"vocab_words must be an int >= 1, got {count!r}")
    return round(count / rate, 2)


def run_model_benchmark(
    selection: ModelSelection,
    device: str = "AUTO",
    deck: Sequence[str] | None = None,
) -> ModelBenchmarkResult:
    """Load ``selection`` and measure load, warmup, throughput, and RAM.

    Does not read or write ``.env`` and does not touch the production model.
    ``throughput_wps`` uses the encoded deck length, so a 500-item deck matches
    ``500 / median_sec``. ``estimated_vocab_sec`` projects ``vocab_en_es.txt``.
    """
    texts = _coerce_deck(deck)
    family, memory_tier = _require_taxonomy(selection)
    resolved = get_optimal_device(device)

    rss_base = _rss_bytes()
    accel_base = _accelerator_bytes(resolved)
    rss_peak = rss_base
    accel_peak = accel_base

    local_only = selection.hub_id in _cached_model_ids()
    _silence_loader_noise()
    started = time.perf_counter()
    model = build_model(selection, resolved, local_files_only=local_only)
    _sync_device(resolved)
    cold_load_sec = time.perf_counter() - started
    rss_peak, accel_peak = _sample_memory(resolved, rss_peak, accel_peak)

    warmup_started = time.perf_counter()
    encode_texts(model, texts[:_WARMUP_ITEMS], selection)
    _sync_device(resolved)
    warmup_sec = time.perf_counter() - warmup_started
    rss_peak, accel_peak = _sample_memory(resolved, rss_peak, accel_peak)

    run_seconds: list[float] = []
    for _ in range(_TIMED_RUNS):
        _sync_device(resolved)
        run_started = time.perf_counter()
        encode_texts(model, texts, selection)
        _sync_device(resolved)
        run_seconds.append(time.perf_counter() - run_started)
        rss_peak, accel_peak = _sample_memory(resolved, rss_peak, accel_peak)

    throughput_wps = median_throughput_wps(len(texts), run_seconds)
    return ModelBenchmarkResult(
        hub_id=selection.hub_id,
        short_label=selection.short_label,
        family=family,
        memory_tier=memory_tier,
        device=resolved,
        cold_load_sec=cold_load_sec,
        warmup_sec=warmup_sec,
        throughput_wps=throughput_wps,
        peak_ram_mb=max(rss_peak - rss_base, accel_peak - accel_base) / _BYTES_PER_MB,
        estimated_vocab_sec=project_vocab_seconds(throughput_wps),
        timestamp_utc=datetime.now(timezone.utc).isoformat(),
    )


def _coerce_deck(deck: Sequence[str] | None) -> tuple[str, ...]:
    source = DEFAULT_BENCHMARK_DECK if deck is None else deck
    texts: list[str] = []
    for item in source:
        if not isinstance(item, str) or not item.strip():
            raise ValueError("benchmark deck items must be non-empty strings")
        texts.append(item.strip())
    if not texts:
        raise ValueError("benchmark deck is empty")
    return tuple(texts)


def _require_taxonomy(selection: ModelSelection) -> tuple[str, str]:
    if selection.family is None or selection.memory_tier is None:
        raise ValueError(
            f"{selection.hub_id} has no measured memory_tier; refusing to invent one"
        )
    return selection.family.value, selection.memory_tier.value


def _cached_model_ids() -> set[str]:
    from huggingface_hub import scan_cache_dir

    return {
        repo.repo_id
        for repo in scan_cache_dir().repos
        if repo.repo_type == "model" and repo.nb_files > 0
    }


def _silence_loader_noise() -> None:
    """Keep the benchmark table free of Hub and weight-load progress bars."""
    os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
    try:
        from huggingface_hub.utils import disable_progress_bars
    except ImportError:
        pass
    else:
        disable_progress_bars()
    try:
        from transformers.utils.logging import disable_progress_bar, set_verbosity_error
    except ImportError:
        return
    disable_progress_bar()
    set_verbosity_error()


def _rss_bytes() -> int:
    return int(psutil.Process().memory_info().rss)


def _accelerator_bytes(device: str) -> int:
    import torch

    if device == "mps":
        driver = getattr(getattr(torch, "mps", None), "driver_allocated_memory", None)
        if driver is None:
            return 0
        return max(0, int(driver()))
    if device == "cuda" and torch.cuda.is_available():
        return max(0, int(torch.cuda.max_memory_allocated()))
    return 0


def _sample_memory(device: str, rss_peak: int, accel_peak: int) -> tuple[int, int]:
    return max(rss_peak, _rss_bytes()), max(accel_peak, _accelerator_bytes(device))


def _sync_device(device: str) -> None:
    import torch

    if device == "mps":
        sync = getattr(getattr(torch, "mps", None), "synchronize", None)
        if sync is not None:
            sync()
        return
    if device == "cuda" and torch.cuda.is_available():
        torch.cuda.synchronize()


_TABLE_HEADERS = (
    "Model",
    "Family",
    "Tier",
    "Device",
    "Load (s)",
    "Throughput (w/s)",
    "Peak RAM",
    "Est. Vocab (10k)",
)


def selection_from_benchmark_token(token: str) -> ModelSelection:
    """Resolve a Hub id, bare name, profile id, or menu token (``P1``, ``M1``)."""
    from backend.model_swap import selection_from_menu_token

    return selection_from_menu_token(token)


def cached_catalog_selections() -> list[ModelSelection]:
    """Catalog models that already have files in the local Hugging Face cache."""
    present = _cached_model_ids()
    return [item for item in list_models() if item.hub_id in present]


def benchmark_targets(
    *,
    model: str | None = None,
    cached_only: bool = False,
    all_models: bool = False,
) -> list[ModelSelection]:
    """Exactly one of Hub/token, local cache, or the full catalog."""
    chosen = (model is not None, cached_only, all_models)
    if sum(chosen) != 1:
        raise ValueError("pass exactly one of --model, --cached-only, or --all")
    if model is not None:
        return [selection_from_benchmark_token(model)]
    if all_models:
        return list(list_models())
    return cached_catalog_selections()


def format_benchmark_table(results: Sequence[ModelBenchmarkResult]) -> str:
    """ASCII table. Empty input still prints the header."""
    rows = [_table_row(result) for result in results]
    widths = [len(header) for header in _TABLE_HEADERS]
    for row in rows:
        for index, cell in enumerate(row):
            widths[index] = max(widths[index], len(cell))

    def render(cells: Sequence[str]) -> str:
        return " | ".join(cell.ljust(widths[index]) for index, cell in enumerate(cells))

    lines = [
        render(_TABLE_HEADERS),
        "-+-".join("-" * width for width in widths),
    ]
    lines.extend(render(row) for row in rows)
    return "\n".join(lines) + "\n"


def results_as_json(results: Sequence[ModelBenchmarkResult]) -> str:
    return json.dumps([asdict(result) for result in results], indent=2) + "\n"


def _table_row(result: ModelBenchmarkResult) -> tuple[str, ...]:
    return (
        result.short_label,
        result.family,
        result.memory_tier,
        result.device,
        f"{result.cold_load_sec:.2f}",
        f"{result.throughput_wps:.1f}",
        f"{result.peak_ram_mb:.1f} MB",
        f"{result.estimated_vocab_sec:.2f} s",
    )


def _vocab_lines(path: Path) -> list[str]:
    lines: list[str] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        text = raw.strip()
        if text:
            lines.append(text)
    return lines


def _fallback_pool() -> tuple[str, ...]:
    """500 unique EN/ES tokens used only when the vocab file is absent."""
    items: list[str] = list(_FALLBACK_EN)
    items.extend(_FALLBACK_ES)
    index = 0
    while len(items) < _DECK_SIZE:
        en = _FALLBACK_EN[index % len(_FALLBACK_EN)]
        es = _FALLBACK_ES[index % len(_FALLBACK_ES)]
        items.append(f"{en} {es} {index}")
        index += 1
    if len(items) != _DECK_SIZE or len(set(items)) != _DECK_SIZE:
        raise RuntimeError("embedded benchmark deck is not 500 unique strings")
    return tuple(items)


DEFAULT_BENCHMARK_DECK: tuple[str, ...] = benchmark_deck()
