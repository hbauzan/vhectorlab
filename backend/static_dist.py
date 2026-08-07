"""Resolve files under Vite `dist/` for FastAPI static SPA/MPA serving."""

from __future__ import annotations

from pathlib import Path


def resolve_dist_file(dist_path: Path, full_path: str) -> Path:
    """Pick a file under ``dist_path`` for a request path.

    Order:
    1. Exact file match (``dist/<full_path>``).
    2. Directory index (``dist/<full_path>/index.html``) — MPA entries like ``/v25/``.
    3. Fallback to root SPA shell (``dist/index.html``).
    """
    candidate = dist_path / full_path
    if candidate.is_file():
        return candidate
    dir_index = candidate / "index.html"
    if dir_index.is_file():
        return dir_index
    return dist_path / "index.html"
