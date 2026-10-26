"""Unit tests for embedding model swap env staging (no model download)."""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from backend.model_catalog import resolve_profile
from backend.model_swap import (
    apply_dotenv,
    apply_model_swap,
    commit_env,
    format_menu_lines,
    read_dotenv,
    rollback_env,
    selection_from_menu_token,
    stage_env,
    upsert_dotenv,
)


def test_apply_dotenv_sets_missing_keys(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    path = tmp_path / ".env"
    path.write_text(
        "MODEL_PROFILE=local-comfort\n"
        "MODEL_NAME=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2\n",
        encoding="utf-8",
    )
    monkeypatch.delenv("MODEL_PROFILE", raising=False)
    monkeypatch.delenv("MODEL_NAME", raising=False)
    monkeypatch.setenv("HOST", "keep-me")

    apply_dotenv(path)

    assert os.environ["MODEL_PROFILE"] == "local-comfort"
    assert (
        os.environ["MODEL_NAME"]
        == "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    )
    assert os.environ["HOST"] == "keep-me"


def test_apply_dotenv_override(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    path = tmp_path / ".env"
    path.write_text("MODEL_NAME=from-file\n", encoding="utf-8")
    monkeypatch.setenv("MODEL_NAME", "from-process")

    apply_dotenv(path)
    assert os.environ["MODEL_NAME"] == "from-process"

    apply_dotenv(path, override=True)
    assert os.environ["MODEL_NAME"] == "from-file"


def test_backend_proc_pattern_matches_python3_m_server():
    """Regression: setup.sh used to pkill only `python -m server`, missing python3."""
    import re

    # Mirrors setup.sh BACKEND_PROC_PATTERN (POSIX [[:space:]] ≈ \\s here).
    pattern = re.compile(r"backend\.server:app|-m\s+server")
    assert pattern.search("/venv/bin/python3 -m server")
    assert pattern.search("uv run python -m server")
    assert not pattern.search("python -m pytest")



def test_upsert_dotenv_preserves_comments(tmp_path: Path):
    path = tmp_path / ".env"
    path.write_text("# hello\nHOST=127.0.0.1\nMODEL_NAME=old\n", encoding="utf-8")
    upsert_dotenv(
        path,
        {
            "MODEL_NAME": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
            "MODEL_PROFILE": "local-comfort",
            "TRUNCATE_DIM": "",
        },
    )
    text = path.read_text(encoding="utf-8")
    assert "# hello" in text
    assert "HOST=127.0.0.1" in text
    assert "MODEL_PROFILE=local-comfort" in text
    assert (
        "MODEL_NAME=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2" in text
    )
    vals = read_dotenv(path)
    assert vals["HOST"] == "127.0.0.1"
    assert vals["MODEL_PROFILE"] == "local-comfort"


def test_stage_rollback_restores_previous(tmp_path: Path):
    path = tmp_path / ".env"
    path.write_text("MODEL_NAME=all-mpnet-base-v2\n", encoding="utf-8")
    snap = stage_env(path, {"MODEL_NAME": "broken-model", "MODEL_PROFILE": "x"})
    assert read_dotenv(path)["MODEL_NAME"] == "broken-model"
    rollback_env(snap)
    assert read_dotenv(path)["MODEL_NAME"] == "all-mpnet-base-v2"
    assert snap.backup_path is None or not snap.backup_path.exists()


def test_stage_commit_drops_backup(tmp_path: Path):
    path = tmp_path / ".env"
    path.write_text("A=1\n", encoding="utf-8")
    snap = stage_env(path, {"A": "2"})
    assert snap.backup_path is not None and snap.backup_path.is_file()
    commit_env(snap)
    assert not snap.backup_path.exists()
    assert read_dotenv(path)["A"] == "2"


def test_selection_from_menu_tokens():
    comfort = selection_from_menu_token("P1")
    assert comfort.profile == "local-comfort"
    full = selection_from_menu_token("P2")
    assert full.profile == "local-full"
    assert full.truncate_dim == 256
    first_model = selection_from_menu_token("M1")
    assert (
        "mpnet" in first_model.hub_id.lower()
        or "mpnet" in first_model.short_label.lower()
    )
    # Unified numeric index: 1 == first profile
    assert selection_from_menu_token("1").profile == "local-comfort"


def test_format_menu_has_profiles_and_models():
    text = "\n".join(format_menu_lines(color=False))
    assert "local-comfort" in text
    assert "MiniLM-multi" in text
    assert "Arctic-m-v2" in text
    assert "BGE-M3" in text
    assert "jina-embeddings-v3" not in text
    assert "Cancel" in text


def test_apply_skip_precompute_updates_env(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    root = tmp_path
    (root / "public").mkdir()
    (root / "public" / "vocab.txt").write_text("king\n", encoding="utf-8")
    (root / "public" / "vocab_es.txt").write_text("rey\n", encoding="utf-8")
    env_path = root / ".env"
    env_path.write_text(
        "MODEL_NAME=old\nVOCAB_PATH=public/vocab.txt\n", encoding="utf-8"
    )

    monkeypatch.setattr("backend.model_swap.repo_root", lambda: root)
    sel = resolve_profile("local-comfort")
    apply_model_swap(
        sel,
        root=root,
        env_path=env_path,
        skip_precompute=True,
        quiet=True,
    )
    vals = read_dotenv(env_path)
    assert vals["MODEL_PROFILE"] == "local-comfort"
    assert "MiniLM" in vals["MODEL_NAME"] or "minilm" in vals["MODEL_NAME"].lower()
    assert vals["VOCAB_PATH"] == "public/vocab_en_es.txt"
    assert (root / "public" / "vocab_en_es.txt").is_file()


def test_progress_bar_bounds():
    from backend.progress_cli import progress_bar

    assert len(progress_bar(0, 4, width=10)) == 10
    assert progress_bar(4, 4, width=10) == "█" * 10
    assert "█" in progress_bar(1, 4, width=10)


# GB matches the hardware banner: 17179869184 bytes prints as 16.0 GB.
_GIB = 1024**3
_MIB = 1024**2


def _host(free_bytes: int, *, accelerated: bool = True):
    from backend.hardware_inspector import HardwareProfile

    total = max(free_bytes, 16 * _GIB)
    if accelerated:
        return HardwareProfile(
            platform_name="Darwin",
            cpu_brand="Apple M4",
            cpu_cores=10,
            total_ram_bytes=total,
            available_ram_bytes=free_bytes,
            accelerator="mps",
            accelerator_device_name="Apple Metal (MPS)",
            is_accelerated=True,
        )
    return HardwareProfile(
        platform_name="Linux",
        cpu_brand="AMD Ryzen 9",
        cpu_cores=16,
        total_ram_bytes=total,
        available_ram_bytes=free_bytes,
        accelerator="cpu",
        accelerator_device_name="Host CPU",
        is_accelerated=False,
    )


def _cached_minilm(*, throughput_wps: float, estimated_vocab_sec: float):
    from backend.benchmark_runner import ModelBenchmarkResult

    return ModelBenchmarkResult(
        hub_id="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        short_label="MiniLM-multi",
        family="UKPLab (Sentence-Transformers)",
        memory_tier="LIGERO (<500MB)",
        device="mps",
        cold_load_sec=1.2,
        warmup_sec=0.2,
        throughput_wps=throughput_wps,
        peak_ram_mb=400.0,
        estimated_vocab_sec=estimated_vocab_sec,
        timestamp_utc="2026-10-26T15:00:00+00:00",
    )


def test_format_hardware_banner_uses_injected_profile(monkeypatch):
    from backend.model_swap import format_hardware_banner

    monkeypatch.setattr(
        "backend.model_swap.get_hardware_profile",
        lambda: _host(int(6.5 * _GIB)),
    )
    monkeypatch.setattr("backend.model_swap.platform.machine", lambda: "arm64")

    lines = format_hardware_banner(color=False)
    text = "\n".join(lines)

    assert lines[0].startswith("╔") and lines[0].endswith("╗")
    assert len(lines[0]) == len(lines[1]) == len(lines[2])
    assert "Live Host Hardware Profile" in text
    assert "Apple M4" in text
    assert "10 cores" in text
    assert "Darwin arm64" in text
    assert "16.0 GB" in text
    assert "6.5 GB" in text
    assert "disponible viva" in text
    assert "mps" in text
    assert "Apple Metal (MPS)" in text
    assert "aceleración activa" in text


def test_format_hardware_banner_marks_cpu_as_not_accelerated(monkeypatch):
    from backend.model_swap import format_hardware_banner

    monkeypatch.setattr(
        "backend.model_swap.get_hardware_profile",
        lambda: _host(2 * _GIB, accelerated=False),
    )
    text = "\n".join(format_hardware_banner(color=False))
    assert "AMD Ryzen 9" in text
    assert "16 cores" in text
    assert "cpu" in text
    assert "Host CPU" in text
    assert "sin aceleración" in text
    assert "aceleración activa" not in text


def test_format_hardware_banner_matches_live_probe():
    from backend.hardware_inspector import get_hardware_profile
    from backend.model_swap import format_hardware_banner

    profile = get_hardware_profile()
    text = "\n".join(format_hardware_banner(color=False))
    assert profile.cpu_brand in text
    assert f"{profile.cpu_cores} cores" in text
    assert profile.platform_name in text
    assert profile.accelerator in text
    assert profile.accelerator_device_name in text
    assert "GB" in text
    assert "disponible viva" in text


def test_format_menu_shows_family_tier_and_cached_throughput(monkeypatch):
    from backend.model_swap import build_menu_entries, format_menu_lines

    monkeypatch.setattr(
        "backend.model_swap.load_benchmark_cache",
        lambda cache_path=None: {
            "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2": _cached_minilm(
                throughput_wps=4387,
                estimated_vocab_sec=2.36,
            )
        },
    )
    text = "\n".join(format_menu_lines(color=False))
    assert build_menu_entries()[-1].index == 13
    assert "UKPLab (Sentence-Transformers)" in text
    assert "LIGERO" in text
    assert "MEDIO" in text
    assert "COMPLETO" in text
    assert "B) Correr benchmark local" in text
    assert "B = modelos en caché" in text
    assert "B all = catálogo" in text
    assert "Elección [1-13 / P# / M# / B / 0]:" in text
    assert "Cancelar" in text

    measured = [line for line in text.splitlines() if "MiniLM-multi" in line]
    assert len(measured) == 3
    assert all("LIGERO" in line for line in measured)
    assert all("⚡ 4387 w/s (2.4s vocab)" in line for line in measured)

    arctic = [line for line in text.splitlines() if "Arctic-m-v2" in line]
    assert len(arctic) == 2
    assert all("Snowflake" in line and "MEDIO" in line for line in arctic)
    assert all("—" in line and "4387" not in line for line in arctic)

    bge = [line for line in text.splitlines() if "BGE-M3" in line]
    assert len(bge) == 1
    assert "BAAI" in bge[0]
    assert "COMPLETO" in bge[0]
    assert "—" in bge[0]


def test_list_command_prints_banner_then_menu(monkeypatch, capsys):
    from backend.model_swap import main

    monkeypatch.setattr(
        "backend.model_swap.get_hardware_profile",
        lambda: _host(int(6.5 * _GIB)),
    )
    monkeypatch.setattr("backend.model_swap.platform.machine", lambda: "arm64")
    monkeypatch.setattr(
        "backend.model_swap.load_benchmark_cache",
        lambda cache_path=None: {},
    )
    assert main(["list", "--plain"]) == 0
    out = capsys.readouterr().out
    assert out.index("Live Host Hardware Profile") < out.index("MiniLM-multi")
    assert "Apple M4" in out
    assert "Elección [1-13 / P# / M# / B / 0]:" in out
    assert "—" in out


def test_memory_gate_optimal_tight_warning_and_edges():
    from backend.model_catalog import ModelSelection, get_model
    from backend.model_swap import evaluate_memory_gate

    light = get_model("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    medium = get_model("sentence-transformers/all-mpnet-base-v2")
    full = get_model("BAAI/bge-m3")

    level, message = evaluate_memory_gate(light, _host(8 * _GIB))
    assert level == "OPTIMAL"
    assert "8.0" in message
    assert "ALERTA" not in message
    assert "justa" not in message

    level, message = evaluate_memory_gate(medium, _host(int(1.8 * _GIB)))
    assert level == "TIGHT"
    assert "Memoria libre justa pero suficiente" in message
    assert "1.8" in message
    assert "1.5" in message

    level, message = evaluate_memory_gate(full, _host(800 * _MIB))
    assert level == "WARNING"
    assert "ALERTA DE MEMORIA" in message
    assert "3.0" in message
    assert "0.8" in message
    assert "Riesgo de swap a disco o lentitud en inferencia." in message

    light_weight = 500 * _MIB
    assert evaluate_memory_gate(light, _host(2 * light_weight))[0] == "OPTIMAL"
    assert evaluate_memory_gate(light, _host(2 * light_weight - 1))[0] == "TIGHT"
    assert evaluate_memory_gate(light, _host(light_weight))[0] == "TIGHT"
    assert evaluate_memory_gate(light, _host(light_weight - 1))[0] == "WARNING"
    assert evaluate_memory_gate(light, _host(1))[0] == "WARNING"

    medium_weight = (3 * _GIB) // 2
    assert evaluate_memory_gate(medium, _host(2 * medium_weight))[0] == "OPTIMAL"
    assert evaluate_memory_gate(medium, _host(medium_weight))[0] == "TIGHT"
    assert evaluate_memory_gate(medium, _host(medium_weight - 1))[0] == "WARNING"

    full_weight = 3 * _GIB
    assert evaluate_memory_gate(full, _host(2 * full_weight))[0] == "OPTIMAL"
    assert evaluate_memory_gate(full, _host(full_weight - 1))[0] == "WARNING"

    unmeasured = ModelSelection(
        hub_id="org/custom-unmeasured",
        profile=None,
        trust_remote_code=False,
        e5_mode=False,
        truncate_dim=None,
        gated=False,
        short_label="custom-unmeasured",
        family=None,
        memory_tier=None,
    )
    level, message = evaluate_memory_gate(unmeasured, _host(32 * _GIB))
    assert level == "WARNING"
    assert "no se inventa" in message
    assert "0.5" not in message
    assert "1.5" not in message
    assert "3.0" not in message


def test_memory_gate_probes_host_only_when_profile_is_omitted(monkeypatch):
    from backend.model_catalog import get_model
    from backend.model_swap import evaluate_memory_gate

    light = get_model("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

    def _boom():
        raise AssertionError("host probe")

    monkeypatch.setattr("backend.model_swap.get_hardware_profile", _boom)
    assert evaluate_memory_gate(light, _host(8 * _GIB))[0] == "OPTIMAL"

    monkeypatch.setattr(
        "backend.model_swap.get_hardware_profile",
        lambda: _host(400 * _MIB),
    )
    assert evaluate_memory_gate(light)[0] == "WARNING"


def test_selection_token_b_is_not_a_model():
    from backend.model_swap import (
        benchmark_target_from_choice,
        selection_from_menu_token,
    )

    with pytest.raises(ValueError, match="benchmark"):
        selection_from_menu_token("B")
    with pytest.raises(ValueError, match="benchmark"):
        selection_from_menu_token("b")
    with pytest.raises(ValueError, match="benchmark"):
        selection_from_menu_token("B P1")
    assert selection_from_menu_token("bge-m3").hub_id == "BAAI/bge-m3"
    assert benchmark_target_from_choice("bge-m3") is None
    assert benchmark_target_from_choice("B") == "cached"
    assert benchmark_target_from_choice("benchmark") == "cached"
    assert benchmark_target_from_choice("B P1") == "P1"
    assert benchmark_target_from_choice("B 4") == "4"
    assert benchmark_target_from_choice("B all") == "all"
    assert benchmark_target_from_choice("  b   M2  ") == "M2"
    assert benchmark_target_from_choice("benchmark all") == "all"
    assert benchmark_target_from_choice("") is None
    assert benchmark_target_from_choice("1") is None
    assert benchmark_target_from_choice("P1") is None


def test_benchmark_cli_routes_targets_and_rejects_bare_b(monkeypatch, capsys):
    from backend.model_catalog import get_model
    from backend.model_swap import main

    calls: list[tuple[object, ...]] = []

    def fake_targets(*, model=None, cached_only=False, all_models=False):
        calls.append((model, cached_only, all_models))
        if model == "M1":
            return [get_model("sentence-transformers/all-mpnet-base-v2")]
        return []

    seen: dict[str, object] = {}

    def fake_run(selection, device="AUTO", deck=None):
        seen["device"] = device
        seen["hub_id"] = selection.hub_id
        return _cached_minilm(throughput_wps=10, estimated_vocab_sec=1.0)

    monkeypatch.setattr("backend.model_swap.benchmark_targets", fake_targets)
    monkeypatch.setattr("backend.model_swap.run_model_benchmark", fake_run)
    monkeypatch.setattr(
        "backend.model_swap.save_benchmark_cache",
        lambda result, cache_path=None: seen.setdefault("saved", result.hub_id),
    )

    assert main(["benchmark"]) == 0
    assert calls[-1] == (None, True, False)
    assert "No catalog models in the local Hugging Face cache." in capsys.readouterr().out

    assert main(["benchmark", "--target", "all"]) == 0
    assert calls[-1] == (None, False, True)

    assert main(["benchmark", "--target", "M1", "--device", "CPU"]) == 0
    assert calls[-1] == ("M1", False, False)
    assert seen["device"] == "CPU"
    assert seen["hub_id"] == "sentence-transformers/all-mpnet-base-v2"
    assert seen["saved"] == "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    assert "Throughput (w/s)" in capsys.readouterr().out

    assert main(["describe", "--choice", "B"]) == 1
    err = capsys.readouterr().err
    assert "benchmark" in err.lower() or "ERROR" in err


def test_benchmark_cli_refuses_unmeasured_model_without_saving(monkeypatch, capsys):
    from backend.model_swap import main

    def _saved(*_args, **_kwargs):
        raise AssertionError("cache write")

    monkeypatch.setattr("backend.model_swap.save_benchmark_cache", _saved)
    assert main(["benchmark", "--target", "not-a-publisher/not-in-catalog"]) == 1
    err = capsys.readouterr().err
    assert "memory_tier" in err


def test_describe_prints_gate_level(monkeypatch, capsys):
    from backend.model_swap import main

    monkeypatch.setattr(
        "backend.model_swap.get_hardware_profile",
        lambda: _host(8 * _GIB),
    )
    assert main(["describe", "--choice", "P1"]) == 0
    out = capsys.readouterr().out
    first, gate, *_rest = out.splitlines()
    assert "MiniLM-multi" in first
    assert gate == "GATE OPTIMAL"


def _setup_export(name: str) -> str:
    text = Path(__file__).resolve().parents[2].joinpath("setup.sh").read_text(
        encoding="utf-8"
    )
    start = f"# BEGIN TEST_EXPORT {name}\n"
    end = f"# END TEST_EXPORT {name}\n"
    assert start in text, name
    assert end in text, name
    return text.split(start, 1)[1].split(end, 1)[0]


def test_setup_sh_benchmark_choice_matches_python():
    import subprocess

    from backend.model_swap import benchmark_target_from_choice

    shell_fn = _setup_export("benchmark_target_from_choice")
    cases = [
        ("B", "cached"),
        ("b", "cached"),
        ("benchmark", "cached"),
        ("B P1", "P1"),
        ("B 4", "4"),
        ("B all", "all"),
        ("  b   M2  ", "M2"),
        ("benchmark all", "all"),
        ("bge-m3", None),
        ("BGE-M3", None),
        ("", None),
        ("1", None),
        ("P1", None),
    ]
    for raw, expected in cases:
        assert benchmark_target_from_choice(raw) == expected
        completed = subprocess.run(
            [
                "bash",
                "-c",
                shell_fn + '\nbenchmark_target_from_choice "$1"',
                "bash",
                raw,
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        if expected is None:
            assert completed.returncode != 0, raw
            assert completed.stdout.strip() == ""
        else:
            assert completed.returncode == 0, completed.stderr
            assert completed.stdout.strip() == expected


def test_setup_sh_memory_gate_confirmation():
    import subprocess

    shell_fn = _setup_export("memory_gate_allows_proceed")
    cases = [
        ("WARNING", "CONFIRMAR", 0),
        ("WARNING", "confirmar", 0),
        ("WARNING", "y", 0),
        ("WARNING", "Y", 0),
        ("WARNING", "", 1),
        ("WARNING", "yes", 1),
        ("WARNING", "n", 1),
        ("TIGHT", "", 0),
        ("TIGHT", "n", 1),
        ("TIGHT", "NO", 1),
        ("OPTIMAL", "", 0),
        ("OPTIMAL", "Y", 0),
        ("OPTIMAL", "n", 1),
        ("BOGUS", "y", 1),
    ]
    for level, typed, expect in cases:
        completed = subprocess.run(
            [
                "bash",
                "-c",
                shell_fn + '\nmemory_gate_allows_proceed "$1" "$2"',
                "bash",
                level,
                typed,
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        assert completed.returncode == expect, (level, typed, completed.stderr)
