"""Unit tests for embedding model swap env staging (no model download)."""

from __future__ import annotations

from pathlib import Path

import pytest
from backend.model_catalog import resolve_profile
from backend.model_swap import (
    apply_model_swap,
    commit_env,
    format_menu_lines,
    read_dotenv,
    rollback_env,
    selection_from_menu_token,
    stage_env,
    upsert_dotenv,
)


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
    assert "BAAI/bge-m3" not in text
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
