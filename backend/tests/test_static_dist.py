from __future__ import annotations

from pathlib import Path

from backend.static_dist import resolve_dist_file


def test_resolve_exact_file(tmp_path: Path):
    (tmp_path / "assets").mkdir()
    asset = tmp_path / "assets" / "app.js"
    asset.write_text("ok", encoding="utf-8")
    assert resolve_dist_file(tmp_path, "assets/app.js") == asset


def test_resolve_v25_directory_index(tmp_path: Path):
    v25 = tmp_path / "v25"
    v25.mkdir()
    index = v25 / "index.html"
    index.write_text("<html>v25</html>", encoding="utf-8")
    (tmp_path / "index.html").write_text("<html>legacy</html>", encoding="utf-8")

    assert resolve_dist_file(tmp_path, "v25") == index
    assert resolve_dist_file(tmp_path, "v25/") == index


def test_resolve_v25_index_html_exact(tmp_path: Path):
    v25 = tmp_path / "v25"
    v25.mkdir()
    index = v25 / "index.html"
    index.write_text("<html>v25</html>", encoding="utf-8")
    assert resolve_dist_file(tmp_path, "v25/index.html") == index


def test_resolve_unknown_falls_back_to_root_index(tmp_path: Path):
    root_index = tmp_path / "index.html"
    root_index.write_text("<html>legacy</html>", encoding="utf-8")
    assert resolve_dist_file(tmp_path, "missing/route") == root_index
