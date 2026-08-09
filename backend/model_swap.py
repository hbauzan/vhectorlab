"""
Embedding model swap helpers for setup.sh option 11.

Stage .env → precompute vocab NPZ → commit on success; restore backup on failure.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

from backend.model_catalog import (
    ModelSelection,
    get_model,
    list_models,
    list_profiles,
    resolve_profile,
    resolve_selection,
)
from backend.progress_cli import print_fail, print_ok, print_phase
from backend.vocab_merge import merge_en_es_files

_ENV_KEY_RE = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$")

# ANSI (safe for most terminals used with setup.sh)
_BOLD = "\033[1m"
_DIM = "\033[2m"
_CYAN = "\033[36m"
_MAGENTA = "\033[35m"
_GREEN = "\033[32m"
_YELLOW = "\033[33m"
_RESET = "\033[0m"


@dataclass(frozen=True, slots=True)
class EnvSnapshot:
    path: Path
    backup_path: Path | None


@dataclass(frozen=True, slots=True)
class MenuEntry:
    """One selectable row in option 11."""

    index: int
    token: str  # P1 / M3 / etc.
    kind: str  # profile | model
    selection: ModelSelection
    title: str
    subtitle: str


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def read_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        match = _ENV_KEY_RE.match(stripped)
        if not match:
            continue
        key, raw = match.group(1), match.group(2)
        if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in ("'", '"'):
            raw = raw[1:-1]
        values[key] = raw
    return values


def upsert_dotenv(path: Path, updates: dict[str, str | None]) -> None:
    """
    Upsert keys in a .env file. Value None removes the key line.
    Preserves unrelated lines/comments; appends missing keys at end.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    lines: list[str] = []
    if path.is_file():
        lines = path.read_text(encoding="utf-8").splitlines()

    seen: set[str] = set()
    out: list[str] = []
    for line in lines:
        stripped = line.strip()
        match = (
            _ENV_KEY_RE.match(stripped)
            if stripped and not stripped.startswith("#")
            else None
        )
        if match is None:
            out.append(line)
            continue
        key = match.group(1)
        if key not in updates:
            out.append(line)
            continue
        seen.add(key)
        value = updates[key]
        if value is None:
            continue
        out.append(f"{key}={value}")

    for key, value in updates.items():
        if key in seen or value is None:
            continue
        out.append(f"{key}={value}")

    text = "\n".join(out)
    if text and not text.endswith("\n"):
        text += "\n"
    path.write_text(text, encoding="utf-8")


def stage_env(path: Path, updates: dict[str, str | None]) -> EnvSnapshot:
    backup = path.with_suffix(path.suffix + ".multillm.bak")
    if path.is_file():
        shutil.copy2(path, backup)
    else:
        backup.write_text("", encoding="utf-8")
        path.write_text("", encoding="utf-8")
    upsert_dotenv(path, updates)
    return EnvSnapshot(path=path, backup_path=backup)


def commit_env(snapshot: EnvSnapshot) -> None:
    if snapshot.backup_path and snapshot.backup_path.is_file():
        snapshot.backup_path.unlink()


def rollback_env(snapshot: EnvSnapshot) -> None:
    if snapshot.backup_path is None:
        return
    if snapshot.backup_path.is_file():
        shutil.copy2(snapshot.backup_path, snapshot.path)
        snapshot.backup_path.unlink()


def resolve_choice(
    *, profile: str | None = None, model: str | None = None
) -> ModelSelection:
    if profile:
        return resolve_profile(profile)
    if model:
        try:
            return get_model(model)
        except ValueError:
            return resolve_selection(model_name=model)
    raise ValueError("Provide --profile or --model")


def ensure_en_es_vocab(root: Path | None = None) -> Path:
    root = root or repo_root()
    out = root / "public" / "vocab_en_es.txt"
    en = root / "public" / "vocab.txt"
    es = root / "public" / "vocab_es.txt"
    if not out.is_file():
        merge_en_es_files(en, es, out)
    return out


def selection_env_updates(
    selection: ModelSelection, *, vocab_path: str
) -> dict[str, str | None]:
    truncate = str(selection.truncate_dim) if selection.truncate_dim is not None else ""
    return {
        "MODEL_PROFILE": selection.profile or "",
        "MODEL_NAME": selection.hub_id,
        "TRUNCATE_DIM": truncate,
        "VOCAB_PATH": vocab_path,
    }


def run_precompute(
    selection: ModelSelection,
    *,
    root: Path | None = None,
    vocab_path: Path,
    out_path: Path,
    device: str = "AUTO",
) -> None:
    """Run precompute with live stdout/stderr (tqdm + phase logs visible)."""
    root = root or repo_root()
    cmd = [
        "uv",
        "run",
        "python",
        str(root / "scripts" / "precompute_vocab_embeddings.py"),
        "--model",
        selection.hub_id,
        "--vocab",
        str(vocab_path),
        "--out",
        str(out_path),
        "--device",
        device,
    ]
    if selection.profile:
        cmd.extend(["--profile", selection.profile])
    if selection.truncate_dim is not None:
        cmd.extend(["--truncate-dim", str(selection.truncate_dim)])
    env = os.environ.copy()
    env.setdefault("PYTHONUNBUFFERED", "1")
    completed = subprocess.run(
        cmd,
        cwd=str(root),
        env=env,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(f"precompute failed (exit {completed.returncode})")


def apply_model_swap(
    selection: ModelSelection,
    *,
    root: Path | None = None,
    env_path: Path | None = None,
    device: str = "AUTO",
    skip_precompute: bool = False,
    quiet: bool = False,
) -> ModelSelection:
    """
    Stage .env, ensure EN∪ES vocab, precompute NPZ, commit env.
    Rolls back .env on any failure after staging.
    """
    root = root or repo_root()
    env_path = env_path or (root / ".env")
    total = 4 if not skip_precompute else 3
    step = 0

    def _phase(title: str, detail: str = "") -> None:
        nonlocal step
        step += 1
        if not quiet:
            print_phase(step, total, title, detail=detail)

    _phase(
        "Ensure EN∪ES vocabulary",
        detail="public/vocab_en_es.txt (merge if missing)",
    )
    vocab_en_es = ensure_en_es_vocab(root)
    if not quiet:
        n_words = sum(1 for line in vocab_en_es.open(encoding="utf-8") if line.strip())
        print_ok(f"Vocab ready — {n_words} words at {vocab_en_es.name}")

    vocab_rel = "public/vocab_en_es.txt"
    npz_rel = read_dotenv(env_path).get(
        "VOCAB_EMBEDDINGS_PATH", "public/vocab_embeddings.npz"
    )
    updates = selection_env_updates(selection, vocab_path=vocab_rel)

    _phase(
        "Stage .env (backup → write)",
        detail=f"MODEL_NAME={selection.hub_id}",
    )
    snapshot = stage_env(env_path, updates)
    if not quiet:
        print_ok(f"Staged {env_path.name} (rollback available on failure)")

    try:
        if not skip_precompute:
            _phase(
                "Precompute vocab embeddings NPZ",
                detail="download/load model + encode (progress bar below)",
            )
            run_precompute(
                selection,
                root=root,
                vocab_path=vocab_en_es,
                out_path=root / npz_rel,
                device=device,
            )
            if not quiet:
                print_ok(f"NPZ written → {npz_rel}")

        _phase("Commit .env (drop backup)")
        commit_env(snapshot)
        if not quiet:
            print_ok("Environment committed")
            print()
            trunc = (
                selection.truncate_dim
                if selection.truncate_dim is not None
                else "—"
            )
            print(
                f"  {_GREEN}{_BOLD}Swap prepare OK{_RESET}  "
                f"model={selection.short_label}  "
                f"profile={selection.profile or '—'}  "
                f"truncate={trunc}"
            )
    except Exception:
        if not quiet:
            print_fail("Failure — restoring previous .env")
        rollback_env(snapshot)
        raise
    return selection


def _entry_subtitle(sel: ModelSelection, *, kind: str) -> str:
    bits: list[str] = []
    if kind == "profile" and sel.profile:
        bits.append(sel.profile)
    hub_short = sel.hub_id.split("/")[-1]
    bits.append(hub_short)
    if sel.truncate_dim is not None:
        bits.append(f"MRL→{sel.truncate_dim}D")
    if sel.e5_mode:
        bits.append("E5")
    if sel.gated:
        bits.append("gated")
    if sel.trust_remote_code:
        bits.append("trust_remote")
    return " · ".join(bits)


def build_menu_entries() -> list[MenuEntry]:
    entries: list[MenuEntry] = []
    idx = 1
    for i, p in enumerate(list_profiles(), start=1):
        sel = resolve_profile(p.id)
        entries.append(
            MenuEntry(
                index=idx,
                token=f"P{i}",
                kind="profile",
                selection=sel,
                title=sel.short_label,
                subtitle=_entry_subtitle(sel, kind="profile"),
            )
        )
        idx += 1
    for i, m in enumerate(list_models(), start=1):
        entries.append(
            MenuEntry(
                index=idx,
                token=f"M{i}",
                kind="model",
                selection=m,
                title=m.short_label,
                subtitle=_entry_subtitle(m, kind="model"),
            )
        )
        idx += 1
    return entries


def format_menu_lines(*, color: bool = True) -> list[str]:
    """Pretty catalog listing for option 11 (profiles then models)."""
    b = _BOLD if color else ""
    d = _DIM if color else ""
    c = _CYAN if color else ""
    m = _MAGENTA if color else ""
    g = _GREEN if color else ""
    y = _YELLOW if color else ""
    r = _RESET if color else ""

    entries = build_menu_entries()
    lines: list[str] = []
    lines.append(f"{c}{b}╭────────────────────────────────────────────────────────────╮{r}")
    lines.append(f"{c}{b}│{r}  {b}Embedding profiles{r}  {d}(recommended presets){r}")
    lines.append(f"{c}{b}╰────────────────────────────────────────────────────────────╯{r}")

    for e in entries:
        if e.kind != "profile":
            continue
        mark = f"{g}★{r}" if color else "*"
        lines.append(
            f"  {b}{e.index:>2}){r} {mark} {m}{e.token:<4}{r}  "
            f"{b}{e.title:<22}{r}  {d}{e.subtitle}{r}"
        )

    lines.append("")
    lines.append(f"{c}{b}╭────────────────────────────────────────────────────────────╮{r}")
    lines.append(f"{c}{b}│{r}  {b}Catalog models{r}  {d}(pick any one){r}")
    lines.append(f"{c}{b}╰────────────────────────────────────────────────────────────╯{r}")

    for e in entries:
        if e.kind != "model":
            continue
        lines.append(
            f"  {b}{e.index:>2}){r}   {y}{e.token:<4}{r}  "
            f"{b}{e.title:<22}{r}  {d}{e.subtitle}{r}"
        )

    lines.append("")
    lines.append(f"  {b} 0){r}  {d}Cancel{r}")
    lines.append(
        f"  {d}Enter a number (1–{entries[-1].index}), or P# / M# token.{r}"
    )
    return lines


def selection_from_menu_token(token: str) -> ModelSelection:
    raw = token.strip()
    if not raw:
        raise ValueError("empty choice")

    if raw.isdigit():
        n = int(raw)
        for e in build_menu_entries():
            if e.index == n:
                return e.selection
        raise ValueError(f"unknown menu index: {n}")

    t = raw.upper()
    profiles = list(list_profiles())
    models = list(list_models())
    if t.startswith("P") and t[1:].isdigit():
        idx = int(t[1:]) - 1
        if 0 <= idx < len(profiles):
            return resolve_profile(profiles[idx].id)
    if t.startswith("M") and t[1:].isdigit():
        idx = int(t[1:]) - 1
        if 0 <= idx < len(models):
            return models[idx]
    lower = raw
    try:
        return resolve_profile(lower)
    except ValueError:
        pass
    return resolve_choice(model=lower)


def describe_selection(selection: ModelSelection) -> str:
    trunc = (
        str(selection.truncate_dim) if selection.truncate_dim is not None else "—"
    )
    return (
        f"{selection.short_label}  ·  profile={selection.profile or '—'}  "
        f"·  truncate={trunc}  ·  {selection.hub_id}"
    )


def main(argv: list[str] | None = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    list_p = sub.add_parser("list", help="Print profiles + catalog short labels")
    list_p.add_argument(
        "--plain",
        action="store_true",
        help="Disable ANSI colors",
    )

    apply_p = sub.add_parser(
        "apply", help="Stage env, precompute, commit (or rollback)"
    )
    apply_p.add_argument("--profile", default=None)
    apply_p.add_argument("--model", default=None)
    apply_p.add_argument("--choice", default=None, help="Menu token e.g. P1 / M3 / 2")
    apply_p.add_argument("--device", default=os.getenv("SAE_DEVICE", "AUTO"))
    apply_p.add_argument(
        "--skip-precompute",
        action="store_true",
        help="Only upsert .env (tests / dry wiring)",
    )
    apply_p.add_argument("--env", type=Path, default=None)
    apply_p.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress phase progress (tests)",
    )

    describe_p = sub.add_parser(
        "describe", help="Resolve a choice and print a one-line summary"
    )
    describe_p.add_argument("--choice", required=True)

    args = parser.parse_args(argv)
    root = repo_root()

    if args.cmd == "list":
        print("\n".join(format_menu_lines(color=not args.plain)))
        return 0

    if args.cmd == "describe":
        try:
            selection = selection_from_menu_token(args.choice)
        except Exception as exc:  # noqa: BLE001
            print(f"ERROR: {exc}", file=sys.stderr)
            return 1
        print(describe_selection(selection))
        return 0

    if args.cmd == "apply":
        if args.choice:
            selection = selection_from_menu_token(args.choice)
        else:
            selection = resolve_choice(profile=args.profile, model=args.model)
        env_path = args.env or (root / ".env")
        if not args.quiet:
            print()
            print(f"  {_BOLD}Target{_RESET}: {describe_selection(selection)}")
            print(
                f"  {_DIM}Pipeline: vocab → stage .env → encode NPZ → commit{_RESET}"
            )
            print()
        try:
            apply_model_swap(
                selection,
                root=root,
                env_path=env_path,
                device=args.device,
                skip_precompute=args.skip_precompute,
                quiet=args.quiet,
            )
        except Exception as exc:  # noqa: BLE001
            print(f"ERROR: {exc}", file=sys.stderr)
            if "gated" in selection.hub_id.lower() or selection.gated:
                print(
                    "Gated model tip: run `hf auth login` and accept the model license on Hugging Face.",
                    file=sys.stderr,
                )
            return 1
        print(
            f"OK model={selection.hub_id} profile={selection.profile!r} "
            f"truncate_dim={selection.truncate_dim!r}"
        )
        return 0

    return 2


if __name__ == "__main__":
    raise SystemExit(main())
