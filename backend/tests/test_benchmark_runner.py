"""Benchmark cache, deck math, live MiniLM run, and CLI JSON."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest
from backend.benchmark_runner import (
    DEFAULT_BENCHMARK_DECK,
    ModelBenchmarkResult,
    benchmark_deck,
    benchmark_targets,
    cached_catalog_selections,
    format_benchmark_table,
    load_benchmark_cache,
    median_throughput_wps,
    project_vocab_seconds,
    run_model_benchmark,
    save_benchmark_cache,
    selection_from_benchmark_token,
    vocab_projection_words,
)
from backend.model_catalog import get_model, list_models, resolve_selection


def _result(**overrides: object) -> ModelBenchmarkResult:
    payload: dict[str, object] = {
        "hub_id": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        "short_label": "MiniLM-multi",
        "family": "UKPLab (Sentence-Transformers)",
        "memory_tier": "LIGERO (<500MB)",
        "device": "mps",
        "cold_load_sec": 1.25,
        "warmup_sec": 0.5,
        "throughput_wps": 800.5,
        "peak_ram_mb": 512.25,
        "estimated_vocab_sec": 12.91,
        "timestamp_utc": "2026-10-26T12:00:00+00:00",
    }
    payload.update(overrides)
    return ModelBenchmarkResult(**payload)  # type: ignore[arg-type]


def test_save_and_load_roundtrip_preserves_every_field(tmp_path: Path) -> None:
    path = tmp_path / "benchmark_cache.json"
    first = _result()
    second = _result(
        hub_id="BAAI/bge-m3",
        short_label="BGE-M3",
        family="BAAI",
        memory_tier="COMPLETO (>1.5GB)",
        device="cpu",
        cold_load_sec=3.5,
        warmup_sec=1.0,
        throughput_wps=40.0,
        peak_ram_mb=2048.0,
        estimated_vocab_sec=258.45,
        timestamp_utc="2026-10-26T13:00:00+00:00",
    )

    save_benchmark_cache(first, path)
    save_benchmark_cache(second, path)

    raw = json.loads(path.read_text(encoding="utf-8"))
    assert set(raw) == {first.hub_id, second.hub_id}
    for result in (first, second):
        entry = raw[result.hub_id]
        assert entry == {
            "hub_id": result.hub_id,
            "short_label": result.short_label,
            "family": result.family,
            "memory_tier": result.memory_tier,
            "device": result.device,
            "cold_load_sec": result.cold_load_sec,
            "warmup_sec": result.warmup_sec,
            "throughput_wps": result.throughput_wps,
            "peak_ram_mb": result.peak_ram_mb,
            "estimated_vocab_sec": result.estimated_vocab_sec,
            "timestamp_utc": result.timestamp_utc,
        }

    loaded = load_benchmark_cache(path)
    assert loaded[first.hub_id] == first
    assert loaded[second.hub_id] == second
    assert not path.with_name(path.name + ".tmp").exists()

    replaced = _result(throughput_wps=900.0, estimated_vocab_sec=11.49)
    save_benchmark_cache(replaced, path)
    again = load_benchmark_cache(path)
    assert again[first.hub_id] == replaced
    assert again[second.hub_id] == second


def test_missing_or_corrupt_cache_returns_empty_dict(tmp_path: Path) -> None:
    missing = tmp_path / "does-not-exist.json"
    assert load_benchmark_cache(missing) == {}

    empty = tmp_path / "empty.json"
    empty.write_text("", encoding="utf-8")
    assert load_benchmark_cache(empty) == {}

    broken = tmp_path / "broken.json"
    broken.write_text("{not json", encoding="utf-8")
    assert load_benchmark_cache(broken) == {}

    array = tmp_path / "array.json"
    array.write_text("[1, 2, 3]", encoding="utf-8")
    assert load_benchmark_cache(array) == {}

    null_doc = tmp_path / "null.json"
    null_doc.write_text("null", encoding="utf-8")
    assert load_benchmark_cache(null_doc) == {}

    mixed = tmp_path / "mixed.json"
    good = _result()
    mixed.write_text(
        json.dumps(
            {
                good.hub_id: {
                    "hub_id": good.hub_id,
                    "short_label": good.short_label,
                    "family": good.family,
                    "memory_tier": good.memory_tier,
                    "device": good.device,
                    "cold_load_sec": good.cold_load_sec,
                    "warmup_sec": good.warmup_sec,
                    "throughput_wps": good.throughput_wps,
                    "peak_ram_mb": good.peak_ram_mb,
                    "estimated_vocab_sec": good.estimated_vocab_sec,
                    "timestamp_utc": good.timestamp_utc,
                },
                "bad/row": {"hub_id": "bad/row", "device": "tpu"},
                "mismatch/key": {
                    "hub_id": "other/id",
                    "short_label": "x",
                    "family": "BAAI",
                    "memory_tier": "LIGERO (<500MB)",
                    "device": "cpu",
                    "cold_load_sec": 1.0,
                    "warmup_sec": 1.0,
                    "throughput_wps": 1.0,
                    "peak_ram_mb": 1.0,
                    "estimated_vocab_sec": 1.0,
                    "timestamp_utc": "2026-10-26T00:00:00+00:00",
                },
            }
        ),
        encoding="utf-8",
    )
    loaded = load_benchmark_cache(mixed)
    assert list(loaded) == [good.hub_id]
    assert loaded[good.hub_id] == good


def test_default_deck_is_seeded_sample_of_vocab_file() -> None:
    vocab = Path(__file__).resolve().parents[2] / "public" / "vocab_en_es.txt"
    lines = [
        line.strip()
        for line in vocab.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    assert vocab_projection_words(vocab) == len(lines) == 10338

    deck = DEFAULT_BENCHMARK_DECK
    assert len(deck) == 500
    assert len(set(deck)) == 500
    assert set(deck) <= set(lines)
    assert benchmark_deck(vocab_path=vocab, seed=42) == deck
    assert benchmark_deck(vocab_path=vocab, seed=43) != deck


def test_deck_rejects_empty_or_oversized_request(tmp_path: Path) -> None:
    vocab = tmp_path / "tiny.txt"
    vocab.write_text("alpha\nbeta\n\ngamma\n", encoding="utf-8")
    assert vocab_projection_words(vocab) == 3
    with pytest.raises(ValueError):
        benchmark_deck(0, vocab_path=vocab)
    with pytest.raises(ValueError):
        benchmark_deck(4, vocab_path=vocab)
    drawn = benchmark_deck(3, vocab_path=vocab, seed=42)
    assert sorted(drawn) == ["alpha", "beta", "gamma"]


def test_missing_vocab_file_uses_embedded_bilingual_fallback(tmp_path: Path) -> None:
    missing = tmp_path / "absent.txt"
    deck = benchmark_deck(500, vocab_path=missing, seed=42)
    assert len(deck) == 500
    assert len(set(deck)) == 500
    assert benchmark_deck(500, vocab_path=missing, seed=42) == deck
    folded = " ".join(deck).casefold()
    assert "king" in folded
    assert "rey" in folded


def test_throughput_is_deck_length_over_median_run() -> None:
    assert median_throughput_wps(500, [1.0, 3.0, 2.0]) == 250.0
    assert median_throughput_wps(50, [2.0, 2.0, 2.0]) == 25.0
    assert project_vocab_seconds(250.0, vocab_words=10338) == round(10338.0 / 250.0, 2)
    with pytest.raises(ValueError):
        median_throughput_wps(0, [1.0])
    with pytest.raises(ValueError):
        median_throughput_wps(500, [])
    with pytest.raises(ValueError):
        median_throughput_wps(500, [0.0, 0.0, 0.0])
    with pytest.raises(ValueError):
        project_vocab_seconds(0.0)


def test_run_model_benchmark_rejects_empty_deck_and_unmeasured_tier() -> None:
    selection = get_model("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    with pytest.raises(ValueError, match="deck"):
        run_model_benchmark(selection, deck=[])

    unmeasured = resolve_selection(model_name="not-a-publisher/not-in-catalog")
    assert unmeasured.memory_tier is None
    with pytest.raises(ValueError, match="memory_tier"):
        run_model_benchmark(unmeasured, deck=["token"])


def test_run_model_benchmark_on_cached_minilm() -> None:
    selection = get_model("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    deck = list(DEFAULT_BENCHMARK_DECK[:50])
    result = run_model_benchmark(selection, device="AUTO", deck=deck)

    assert isinstance(result, ModelBenchmarkResult)
    assert result.hub_id == selection.hub_id
    assert result.short_label == selection.short_label
    assert result.family == selection.family.value
    assert result.memory_tier == selection.memory_tier.value
    assert result.device in {"mps", "cuda", "cpu"}
    assert result.cold_load_sec > 0
    assert result.warmup_sec > 0
    assert result.throughput_wps > 0
    assert result.peak_ram_mb > 0
    assert result.estimated_vocab_sec > 0
    assert result.estimated_vocab_sec == round(10338.0 / result.throughput_wps, 2)
    assert result.timestamp_utc.endswith("+00:00")


def test_run_model_benchmark_throughput_follows_deck_length(monkeypatch) -> None:
    """A one-item deck must not be scored as if it were the 500-item deck."""
    ticks = {"t": 0.0}

    def clock() -> float:
        ticks["t"] += 0.25
        return ticks["t"]

    rss_calls = {"n": 0}

    def rss() -> int:
        rss_calls["n"] += 1
        return rss_calls["n"] * 8 * 1024 * 1024

    monkeypatch.setattr("backend.benchmark_runner.time.perf_counter", clock)
    monkeypatch.setattr(
        "backend.benchmark_runner.build_model",
        lambda selection, device, **kwargs: object(),
    )
    monkeypatch.setattr(
        "backend.benchmark_runner.encode_texts",
        lambda *args, **kwargs: None,
    )
    monkeypatch.setattr("backend.benchmark_runner._rss_bytes", rss)
    monkeypatch.setattr(
        "backend.benchmark_runner._accelerator_bytes",
        lambda device: 0,
    )

    selection = get_model("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    result = run_model_benchmark(selection, device="CPU", deck=["solo"])

    assert result.device == "cpu"
    assert result.cold_load_sec == 0.25
    assert result.warmup_sec == 0.25
    assert result.throughput_wps == 4.0
    assert result.estimated_vocab_sec == round(10338.0 / 4.0, 2)
    assert result.peak_ram_mb > 0


def test_cli_json_minilm_exits_zero_and_prints_json() -> None:
    root = Path(__file__).resolve().parents[2]
    script = root / "scripts" / "benchmark_models.py"
    completed = subprocess.run(
        [
            sys.executable,
            str(script),
            "--json",
            "--model",
            "paraphrase-multilingual-MiniLM-L12-v2",
        ],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    assert completed.returncode == 0, completed.stderr
    assert "Loading weights" not in completed.stderr
    assert "unauthenticated" not in completed.stderr
    payload = json.loads(completed.stdout)
    assert isinstance(payload, list)
    assert len(payload) == 1
    row = payload[0]
    assert row["hub_id"] == (
        "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    )
    assert row["short_label"] == "MiniLM-multi"
    assert row["family"] == "UKPLab (Sentence-Transformers)"
    assert row["memory_tier"] == "LIGERO (<500MB)"
    assert row["device"] in {"mps", "cuda", "cpu"}
    assert row["cold_load_sec"] > 0
    assert row["warmup_sec"] > 0
    assert row["throughput_wps"] > 0
    assert row["peak_ram_mb"] > 0
    assert row["estimated_vocab_sec"] == round(10338.0 / row["throughput_wps"], 2)
    cache = root / "backend" / "artifacts" / "benchmark_cache.json"
    stored = json.loads(cache.read_text(encoding="utf-8"))
    assert stored[row["hub_id"]]["throughput_wps"] == row["throughput_wps"]


def test_table_header_matches_contract() -> None:
    text = format_benchmark_table([_result()])
    cells = [cell.strip() for cell in text.splitlines()[0].split("|")]
    assert cells == [
        "Model",
        "Family",
        "Tier",
        "Device",
        "Load (s)",
        "Throughput (w/s)",
        "Peak RAM",
        "Est. Vocab (10k)",
    ]
    assert "MiniLM-multi" in text
    assert "UKPLab (Sentence-Transformers)" in text
    assert "LIGERO (<500MB)" in text
    assert "512.2 MB" in text
    assert "12.91 s" in text
    empty = [
        cell.strip() for cell in format_benchmark_table([]).splitlines()[0].split("|")
    ]
    assert empty == cells


def test_benchmark_tokens_resolve_profile_and_catalog_names() -> None:
    comfort = selection_from_benchmark_token("P1")
    assert comfort.profile == "local-comfort"
    assert comfort.hub_id.endswith("paraphrase-multilingual-MiniLM-L12-v2")
    bare = selection_from_benchmark_token("bge-m3")
    assert bare.hub_id == "BAAI/bge-m3"
    assert bare.memory_tier is not None
    first = selection_from_benchmark_token("M1")
    assert first.hub_id == next(iter(list_models())).hub_id


def test_cached_catalog_selections_include_the_three_local_models() -> None:
    found = {item.hub_id for item in cached_catalog_selections()}
    assert {
        "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        "sentence-transformers/all-mpnet-base-v2",
        "BAAI/bge-m3",
    } <= found
    assert found <= {item.hub_id for item in list_models()}
    assert benchmark_targets(cached_only=True) == cached_catalog_selections()
    assert len(benchmark_targets(all_models=True)) == len(list(list_models()))
    with pytest.raises(ValueError):
        benchmark_targets()
    with pytest.raises(ValueError):
        benchmark_targets(model="P1", all_models=True)


def test_cli_rejects_missing_selector_and_unmeasured_model() -> None:
    root = Path(__file__).resolve().parents[2]
    script = root / "scripts" / "benchmark_models.py"
    missing = subprocess.run(
        [sys.executable, str(script), "--json"],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    assert missing.returncode != 0

    unmeasured = subprocess.run(
        [
            sys.executable,
            str(script),
            "--json",
            "--model",
            "not-a-publisher/not-in-catalog",
        ],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    assert unmeasured.returncode == 1
    payload = json.loads(unmeasured.stdout)
    assert "memory_tier" in payload["error"]
