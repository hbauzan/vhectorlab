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
from backend.vocab_merge import merge_en_es_files

_ENV_KEY_RE = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$")


@dataclass(frozen=True, slots=True)
class EnvSnapshot:
    path: Path
    backup_path: Path | None


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
        # Prefer catalog lookup (bare or hub); fall back to resolve_selection passthrough.
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
    # Prefer repo backend uv project
    completed = subprocess.run(
        cmd,
        cwd=str(root),
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "").strip()
        raise RuntimeError(
            f"precompute failed (exit {completed.returncode}): {detail[-2000:]}"
        )


def apply_model_swap(
    selection: ModelSelection,
    *,
    root: Path | None = None,
    env_path: Path | None = None,
    device: str = "AUTO",
    skip_precompute: bool = False,
) -> ModelSelection:
    """
    Stage .env, ensure EN∪ES vocab, precompute NPZ, commit env.
    Rolls back .env on any failure after staging.
    """
    root = root or repo_root()
    env_path = env_path or (root / ".env")
    vocab_en_es = ensure_en_es_vocab(root)
    vocab_rel = "public/vocab_en_es.txt"
    npz_rel = read_dotenv(env_path).get(
        "VOCAB_EMBEDDINGS_PATH", "public/vocab_embeddings.npz"
    )
    updates = selection_env_updates(selection, vocab_path=vocab_rel)
    snapshot = stage_env(env_path, updates)
    try:
        if not skip_precompute:
            run_precompute(
                selection,
                root=root,
                vocab_path=vocab_en_es,
                out_path=root / npz_rel,
                device=device,
            )
        commit_env(snapshot)
    except Exception:
        rollback_env(snapshot)
        raise
    return selection


def format_menu_lines() -> list[str]:
    lines = ["PROFILES:"]
    for i, p in enumerate(list_profiles(), start=1):
        sel = resolve_profile(p.id)
        trunc = f" truncate={sel.truncate_dim}" if sel.truncate_dim else ""
        lines.append(
            f"  P{i}. {p.id} → {sel.short_label} ({sel.hub_id.split('/')[-1]}){trunc}"
        )
    lines.append("MODELS:")
    for i, m in enumerate(list_models(), start=1):
        flags = []
        if m.trust_remote_code:
            flags.append("trust_remote_code")
        if m.e5_mode:
            flags.append("e5")
        if m.gated:
            flags.append("gated")
        if m.truncate_dim:
            flags.append(f"truncate={m.truncate_dim}")
        flag_s = f" [{', '.join(flags)}]" if flags else ""
        lines.append(f"  M{i}. {m.short_label} — {m.hub_id}{flag_s}")
    return lines


def selection_from_menu_token(token: str) -> ModelSelection:
    t = token.strip().upper()
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
    # Also accept profile id or hub id directly
    lower = token.strip()
    try:
        return resolve_profile(lower)
    except ValueError:
        pass
    return resolve_choice(model=lower)


def main(argv: list[str] | None = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list", help="Print profiles + catalog short labels")

    apply_p = sub.add_parser(
        "apply", help="Stage env, precompute, commit (or rollback)"
    )
    apply_p.add_argument("--profile", default=None)
    apply_p.add_argument("--model", default=None)
    apply_p.add_argument("--choice", default=None, help="Menu token e.g. P1 / M3")
    apply_p.add_argument("--device", default=os.getenv("SAE_DEVICE", "AUTO"))
    apply_p.add_argument(
        "--skip-precompute",
        action="store_true",
        help="Only upsert .env (tests / dry wiring)",
    )
    apply_p.add_argument("--env", type=Path, default=None)

    args = parser.parse_args(argv)
    root = repo_root()

    if args.cmd == "list":
        print("\n".join(format_menu_lines()))
        return 0

    if args.cmd == "apply":
        if args.choice:
            selection = selection_from_menu_token(args.choice)
        else:
            selection = resolve_choice(profile=args.profile, model=args.model)
        env_path = args.env or (root / ".env")
        try:
            apply_model_swap(
                selection,
                root=root,
                env_path=env_path,
                device=args.device,
                skip_precompute=args.skip_precompute,
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
