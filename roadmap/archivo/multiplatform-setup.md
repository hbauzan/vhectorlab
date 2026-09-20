# Roadmap — Multiplatform setup (Linux / Windows)

**Status:** Parking / deferred — **do not implement** until higher-priority work is done **and** the human re-opens this epic.  
**Date captured:** 2026-08-26  
**Product:** VHectorLab 3D (local control panel + deps bootstrap)  
**Related:** `setup.sh` (macOS control panel), `README.md` § Platform support, `backend/pyproject.toml` (torch CPU on Linux)

> **Goal (one sentence):** When the lab is ready for it, decide how to support **Linux desktop** and **Windows** entrypoints for the same control-panel / bootstrap experience that `./setup.sh` gives on macOS — without guessing which architecture (A–D) until a fresh revalidation.

---

## 0. Priority

This epic is **below** active product/research work (Shared noise drafts, multillm follow-ups, etc.).  
Parked on purpose. Do **not** start coding because this file exists.

---

## 1. Locked (process only)

| ID | Decision |
| :--- | :--- |
| L1 | **Architecture choice A/B/C/D is still open.** Do not pick one in silence. Re-show options after revalidation. |
| L2 | Agent that picks this up must **revalidate §3 against the live repo first**, then present options again (updated if the codebase drifted). |
| L3 | No implementation until the human **explicitly** chooses an option (or a hybrid) and says OK. |
| L4 | Prefer documenting drift over inventing new designs. If `setup.sh` shrank/grew, update this roadmap’s snapshot, don’t cargo-cult 2026-08-26 line counts. |

---

## 2. Snapshot at capture time (2026-08-26) — revalidate, don’t trust blindly

### 2.1 What exists

| Asset | Role |
| :--- | :--- |
| `setup.sh` (~1130 lines) | Full **control panel** (menu 0–11): prereqs, deploy, tests, vocab, HF Docker build/publish, logs, stop, embedding swap |
| `README.md` | Declares **macOS-only** local support; HF Space = Linux **in Docker**, not a Linux desktop install guide |
| `backend/pyproject.toml` | Already has `pytorch-cpu` index when `sys_platform == 'linux'` |
| Stack | Python/`uv` + Node/npm + Vite/Three.js + FastAPI — inherently cross-platform |

### 2.2 What is macOS-specific today (likely still true — check)

- Auto-install: Homebrew → Node; official `uv` installer; Docker Desktop cask (option 7)
- Process/port control: `lsof`, `pgrep`, `pkill`
- Browser open: `open` (Linux already has a `xdg-open` branch in the script)
- Explicit warning: `warn_if_unsupported_platform` when `uname ≠ Darwin`
- Non-Darwin: Node not auto-installed; Docker install refused with “install yourself”
- Detached launch: Python `subprocess.Popen(..., start_new_session=True)`
- Ctrl+C panel policy: trap INT — must **not** kill backend/frontend (only option 10)

### 2.3 What already helps Linux / HF

- Torch CPU wheels for Linux via uv index markers
- Dockerfile / option 7–8 path targets HF Linux CPU runtime
- `xdg-open` fallback for browser

### 2.4 Hard parts by OS (at capture)

| Layer | macOS | Linux desktop | Windows |
| :--- | :--- | :--- | :--- |
| Deps (`uv sync`, `npm i`, `.env`) | OK | Small path/PATH tweaks | Paths; `python` vs `python3` |
| Start/kill services | `lsof`/`pgrep`/`pkill` | `ss`/`fuser` or same Unix tools | PowerShell process/port APIs |
| Open browser | `open` | `xdg-open` | `Start-Process` |
| Auto-install Node | Homebrew | apt/dnf/pacman **or** require preinstalled | winget/choco **or** require preinstalled |
| Options 7–8 | Mac-centric helpers | Feasible | Feasible if Docker Desktop + git |

---

## 3. Agent checklist — revalidate FIRST

Before presenting options or writing code, the agent **must**:

1. Read current `setup.sh` (or whatever replaced it) — size, menu options, platform guards.
2. Read `README.md` § Platform support / Quick start — still macOS-only?
3. Grep for: `Darwin`, `Homebrew`, `lsof`, `pgrep`, `xdg-open`, `warn_if_unsupported`.
4. Check `backend/pyproject.toml` torch Linux markers still present.
5. Confirm whether any `setup-linux.*` / `setup.ps1` / `setup.bat` already appeared (avoid duplicate epics).
6. Note SemVer / `CHANGELOG.md` if platform claims changed.
7. Update this file’s **§2 snapshot date + deltas** if reality diverged (doc-sync when the human re-opens the epic; not before).

Only after that → §4 options (possibly amended).

---

## 4. Architecture options (choice still pending)

Present these again to the human after §3. Amend if the repo changed.

### A. Three sibling scripts (full menu mirror)

- `setup.sh` → macOS (keep)
- `setup-linux.sh` → bash Linux
- `setup.ps1` → Windows

**Pros:** native tools per OS.  
**Cons:** 3× panel logic; high drift risk.

### B. One Unix `setup.sh` (Mac+Linux) + `setup.ps1` Windows

- Bash branches on `uname` (brew vs apt/precheck).
- Windows only in PowerShell.

**Pros:** two surfaces; Linux ≈ Mac.  
**Cons:** bash grows; Windows still separate.

### C. Thin OS wrappers + shared Python control panel

- Wrappers only launch e.g. `python scripts/control_panel.py`.
- Process/port logic in Python (`psutil` or stdlib).

**Pros:** one menu; less long-term drift.  
**Cons:** large refactor; panel stops being “bash-only”.

### D. Bootstrap-only scripts (no full menu parity)

- Per-OS: check `uv`/Node, `.env`, `uv sync`, `npm i`, print how to start.
- Full menu 0–11 stays macOS-only for now.

**Pros:** cheap, unblocks clone-and-run.  
**Cons:** not a real control-panel port.

### Windows file format (sub-decision)

| | `.bat` | `.ps1` |
| :--- | :--- | :--- |
| Menu + colors + port kill | Fragile | Adequate |
| Parity with `setup.sh` complexity | No | Yes |
| UX | Easy double-click | May need `ExecutionPolicy` |

**Bias at capture (not locked):** prefer `setup.ps1`; optional one-line `.bat` launcher only if double-click matters.

### Capture-time recommendation (not locked — re-argue after §3)

| Horizon | Lean |
| :--- | :--- |
| Short | **D** if goal is “clone and stand up” |
| Panel parity | **B** over cloning A |
| Multi-year maintain | **C** |

Linux = easiest port. Windows = hardest (process control + PATH).

---

## 5. Out of scope (until human expands)

- Claiming “officially supported” on Linux/Windows in README without a chosen option + smoke pass
- Changing HF Space Docker contract just to “fix” desktop Linux
- Rewriting the macOS panel “for fun” without a chosen architecture
- Implementing any of A–D before explicit OK

---

## 6. Next (when human re-opens)

1. Agent runs §3 revalidation.  
2. Agent shows §4 options (updated) + one fresh recommendation.  
3. Human picks A/B/C/D (or hybrid) + Windows `.ps1` vs `.bat`.  
4. Only then: branch + implement under `dev-protocol` (approval gate before push/merge).

Kickoff paste: [`PROMPT-multiplatform-setup.md`](./PROMPT-multiplatform-setup.md).
