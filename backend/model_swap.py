"""
Embedding model swap helpers for setup.sh option 11.

Stage .env → precompute vocab NPZ → commit on success; restore backup on failure.
"""

from __future__ import annotations

import os
import platform
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

from backend.benchmark_runner import (
    NO_CACHED_MODELS_MESSAGE,
    ModelBenchmarkResult,
    benchmark_targets,
    format_benchmark_table,
    load_benchmark_cache,
    run_model_benchmark,
    save_benchmark_cache,
)
from backend.hardware_inspector import HardwareProfile, get_hardware_profile
from backend.model_catalog import (
    MemoryTier,
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

# Banner divisor: hw.memsize 17179869184 prints as 16.0 GB.
# Tier weights are the option-11 estimates (500 MiB, 1.5 GiB, 3 GiB).
# OPTIMAL is ≥ 2× that weight, TIGHT is ≥ 1×, WARNING is below 1×.
_GIB = 1024**3
_MIB = 1024**2
_TIER_WEIGHT_BYTES: dict[MemoryTier, int] = {
    MemoryTier.LIGHT: 500 * _MIB,
    MemoryTier.MEDIUM: (3 * _GIB) // 2,
    MemoryTier.FULL: 3 * _GIB,
}
_BANNER_INNER = 60


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


def apply_dotenv(path: Path, *, override: bool = False) -> dict[str, str]:
    """
    Load KEY=VAL from a .env file into os.environ.

    By default does not override variables already set in the process environment
    (explicit exports / systemd / CI win). Used by the backend so option 1 and
    option 11 honor the repo-root `.env` even when `uv run` cwd is `backend/`.
    """
    values = read_dotenv(path)
    for key, value in values.items():
        if override or key not in os.environ:
            os.environ[key] = value
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


def _gb(num_bytes: int) -> str:
    return f"{num_bytes / _GIB:.1f}"


def format_hardware_banner(*, color: bool = True) -> list[str]:
    """Live CPU, RAM, and accelerator lines for option 11."""
    profile = get_hardware_profile()
    b = _BOLD if color else ""
    c = _CYAN if color else ""
    r = _RESET if color else ""
    machine = platform.machine().strip()
    platform_bits = profile.platform_name
    if machine:
        platform_bits = f"{profile.platform_name} {machine}"
    accel_state = (
        "aceleración activa" if profile.is_accelerated else "sin aceleración"
    )
    rows = (
        (
            "Platform & CPU:",
            f"{profile.cpu_brand} ({profile.cpu_cores} cores) · {platform_bits}",
        ),
        (
            "RAM Memory:",
            (
                f"{_gb(profile.total_ram_bytes)} GB total · "
                f"{_gb(profile.available_ram_bytes)} GB free (disponible viva)"
            ),
        ),
        (
            "Accelerator:",
            (
                f"{profile.accelerator} · {profile.accelerator_device_name} "
                f"({accel_state})"
            ),
        ),
    )
    label_width = max(len(label) for label, _value in rows)
    bar = "═" * _BANNER_INNER
    title = "  Live Host Hardware Profile"
    padded = title + (" " * (_BANNER_INNER - len(title)))
    lines = [
        f"{c}{b}╔{bar}╗{r}",
        f"{c}{b}║{r}{padded}{c}{b}║{r}",
        f"{c}{b}╚{bar}╝{r}",
    ]
    lines.extend(
        f"  • {label:<{label_width}}  {value}" for label, value in rows
    )
    return lines


def _format_throughput(result: ModelBenchmarkResult | None) -> str:
    if result is None:
        return "—"
    rate = (
        f"{result.throughput_wps:.0f}"
        if result.throughput_wps >= 100
        else f"{result.throughput_wps:.1f}"
    )
    return f"⚡ {rate} w/s ({result.estimated_vocab_sec:.1f}s vocab)"


def _menu_taxonomy(selection: ModelSelection) -> tuple[str, str]:
    family = selection.family.value if selection.family is not None else "—"
    tier = selection.memory_tier.value if selection.memory_tier is not None else "—"
    return family, tier


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
    cache = load_benchmark_cache()
    lines: list[str] = []
    lines.append(f"{c}{b}╭────────────────────────────────────────────────────────────╮{r}")
    lines.append(f"{c}{b}│{r}  {b}Embedding profiles{r}  {d}(recommended presets){r}")
    lines.append(f"{c}{b}╰────────────────────────────────────────────────────────────╯{r}")

    for entry in entries:
        if entry.kind != "profile":
            continue
        family, tier = _menu_taxonomy(entry.selection)
        star = f"{g}★{r}" if color else "*"
        throughput = _format_throughput(cache.get(entry.selection.hub_id))
        lines.append(
            f"  {b}{entry.index:>2}){r} {star} {m}{entry.token:<4}{r}  "
            f"{b}{entry.title:<22}{r}  {family:<32}  {tier:<22}  "
            f"{throughput:<28}  {d}{entry.subtitle}{r}"
        )

    lines.append("")
    lines.append(f"{c}{b}╭────────────────────────────────────────────────────────────╮{r}")
    lines.append(f"{c}{b}│{r}  {b}Catalog models{r}  {d}(pick any one){r}")
    lines.append(f"{c}{b}╰────────────────────────────────────────────────────────────╯{r}")

    for entry in entries:
        if entry.kind != "model":
            continue
        family, tier = _menu_taxonomy(entry.selection)
        throughput = _format_throughput(cache.get(entry.selection.hub_id))
        lines.append(
            f"  {b}{entry.index:>2}){r}   {y}{entry.token:<4}{r}  "
            f"{b}{entry.title:<22}{r}  {family:<32}  {tier:<22}  "
            f"{throughput:<28}  {d}{entry.subtitle}{r}"
        )

    last = entries[-1].index if entries else 0
    lines.append("")
    lines.append(f"  {b}0){r} {d}Cancelar{r}")
    lines.append(
        "  B) Correr benchmark local "
        "[B = modelos en caché, B <token> = modelo específico, B all = catálogo]"
    )
    lines.append(f"  Elección [1-{last} / P# / M# / B / 0]:")
    return lines


def evaluate_memory_gate(
    selection: ModelSelection,
    profile: HardwareProfile | None = None,
) -> tuple[str, str]:
    """Compare free RAM with the catalog tier weight.

    An unmeasured tier stays WARNING. The weight is not invented.
    """
    host = profile if profile is not None else get_hardware_profile()
    free = host.available_ram_bytes
    tier = selection.memory_tier
    if tier is None:
        return (
            "WARNING",
            (
                "⚠️  ALERTA DE MEMORIA: este modelo no tiene un memory tier medido; "
                f"no se inventa un peso. RAM libre: {_gb(free)} GB.\n"
                "Riesgo de swap a disco o lentitud en inferencia."
            ),
        )
    weight = _TIER_WEIGHT_BYTES[tier]
    free_gb = _gb(free)
    weight_gb = _gb(weight)
    tier_label = tier.value
    if free >= 2 * weight:
        return (
            "OPTIMAL",
            (
                f"Memoria óptima: {free_gb} GB libres frente a ~{weight_gb} GB "
                f"estimados ({tier_label})."
            ),
        )
    if free >= weight:
        return (
            "TIGHT",
            (
                "Memoria libre justa pero suficiente: "
                f"{free_gb} GB libres frente a ~{weight_gb} GB estimados "
                f"({tier_label})."
            ),
        )
    return (
        "WARNING",
        (
            "⚠️  ALERTA DE MEMORIA: El modelo seleccionado requiere "
            f"~{weight_gb} GB pero solo hay {free_gb} GB libres.\n"
            "Riesgo de swap a disco o lentitud en inferencia."
        ),
    )


def benchmark_target_from_choice(raw: str) -> str | None:
    """Return a benchmark target, or None when ``raw`` is a model choice.

    ``b`` / ``benchmark`` means the local Hugging Face cache.
    ``bge-m3`` stays a catalog selection: the command is a whole word.
    """
    parts = raw.strip().split()
    if not parts:
        return None
    head = parts[0].casefold()
    if head not in {"b", "benchmark"}:
        return None
    if len(parts) == 1:
        return "cached"
    return " ".join(parts[1:])


def run_menu_benchmark(target: str, *, device: str = "AUTO") -> str:
    """Time one target and store each result. Does not touch ``.env``."""
    normalized = target.strip() or "cached"
    key = normalized.casefold()
    if key == "cached":
        selections = benchmark_targets(cached_only=True)
    elif key == "all":
        selections = benchmark_targets(all_models=True)
    else:
        selections = benchmark_targets(model=normalized)
    if not selections:
        return NO_CACHED_MODELS_MESSAGE + "\n"
    results: list[ModelBenchmarkResult] = []
    for selection in selections:
        result = run_model_benchmark(selection, device=device)
        save_benchmark_cache(result)
        results.append(result)
    return format_benchmark_table(results)


def selection_from_menu_token(token: str) -> ModelSelection:
    raw = token.strip()
    if not raw:
        raise ValueError("empty choice")
    if benchmark_target_from_choice(raw) is not None:
        raise ValueError(f"{raw!r} is a benchmark command, not a model selection")

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
        "describe", help="Resolve a choice and print the memory gate"
    )
    describe_p.add_argument("--choice", required=True)

    bench_p = sub.add_parser(
        "benchmark",
        help="Measure throughput into benchmark_cache.json (does not edit .env)",
    )
    bench_p.add_argument(
        "--target",
        default="cached",
        help="cached (default), all, or a menu token / hub id / bare name",
    )
    bench_p.add_argument("--device", default=os.getenv("SAE_DEVICE", "AUTO"))

    args = parser.parse_args(argv)
    root = repo_root()

    if args.cmd == "list":
        color = not args.plain
        print(
            "\n".join(
                [
                    *format_hardware_banner(color=color),
                    "",
                    *format_menu_lines(color=color),
                ]
            )
        )
        return 0

    if args.cmd == "describe":
        try:
            selection = selection_from_menu_token(args.choice)
        except Exception as exc:  # noqa: BLE001
            print(f"ERROR: {exc}", file=sys.stderr)
            return 1
        level, message = evaluate_memory_gate(selection)
        print(describe_selection(selection))
        print(f"GATE {level}")
        print(message)
        return 0

    if args.cmd == "benchmark":
        try:
            sys.stdout.write(run_menu_benchmark(args.target, device=args.device))
        except ValueError as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            return 1
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
