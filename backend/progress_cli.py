"""Terminal progress helpers for operator-facing CLIs (option 11, precompute)."""

from __future__ import annotations

import sys


def progress_bar(current: int, total: int, *, width: int = 28) -> str:
    total = max(int(total), 1)
    current = max(0, min(int(current), total))
    filled = round(width * current / total)
    filled = max(0, min(filled, width))
    return "█" * filled + "░" * (width - filled)


def print_phase(
    current: int,
    total: int,
    title: str,
    *,
    detail: str = "",
    file=sys.stdout,
) -> None:
    bar = progress_bar(current, total)
    line = f"  [{bar}]  {current}/{total}  {title}"
    print(line, file=file, flush=True)
    if detail:
        print(f"           {detail}", file=file, flush=True)


def print_ok(message: str, *, file=sys.stdout) -> None:
    print(f"  ✓  {message}", file=file, flush=True)


def print_fail(message: str, *, file=sys.stderr) -> None:
    print(f"  ✗  {message}", file=file, flush=True)
