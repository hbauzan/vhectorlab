# Prompt — Multiplatform setup (Linux / Windows)

Copy-paste when the human says this epic is **next** (after higher-priority work).  
Canonical roadmap: [`multiplatform-setup.md`](./multiplatform-setup.md).

**Work mode:** **decide first, code later.** This is a parked epic. Default first session = **revalidate + re-present options**. Do **not** implement until the human picks an architecture and says OK.

---

## Session kickoff — paste this

```text
Using dev-protocol.

## Task
Re-open the parked epic: multiplatform setup (Linux / Windows) for VHectorLab 3D.
Do NOT implement yet. Do NOT pick A/B/C/D silently.

## Canonical roadmap (read completely)
`roadmap/multiplatform-setup.md`

## Mandatory order
1. **Revalidate first** — run checklist §3 of that roadmap against the LIVE repo:
   - Current `setup.sh` (or successor): menu, platform guards, process/port helpers
   - `README.md` platform claims
   - Grep: Darwin, Homebrew, lsof, pgrep, xdg-open, warn_if_unsupported
   - `backend/pyproject.toml` Linux torch markers
   - Any existing `setup-linux.*` / `setup.ps1` / `setup.bat`
   - Note drift vs the 2026-08-26 snapshot in §2
2. Summarize what is still true vs what changed (short table).
3. **Then** re-show architecture options A/B/C/D (+ `.bat` vs `.ps1`) from roadmap §4, amended if needed.
4. Give ONE updated recommendation + risk — options stay OPEN until I choose.
5. STOP. Wait for my explicit choice + OK before any branch/code.

## Locked process rules
- Architecture A/B/C/D is still pending (roadmap L1).
- Priority was parking behind more important work — don’t expand into product features.
- No README “official Linux/Windows support” claim without a chosen path + smoke.

## Style
No-fluff. Spanish rioplatense. One recommendation after the matrix, not a six-way tie.
If the repo already has multiplatform scripts, say so and propose whether to absorb or supersede — don’t duplicate.
```

---

## After the human picks A/B/C/D — paste this

```text
Using dev-protocol, implement multiplatform setup as I chose.

Roadmap: `roadmap/multiplatform-setup.md` (update §2 snapshot date if you already revalidated).
My choice: <paste A / B / C / D / hybrid + Windows .ps1|.bat>.

## Do
- Branch `feat/multiplatform-setup` (or narrower name matching the choice).
- Implement ONLY the chosen surface. Keep macOS `setup.sh` behavior intact unless the choice explicitly merges Unix.
- Smoke: deps sync + start backend/frontend OR document exact manual smoke on the target OS.
- Sync README platform section only as far as the choice justifies.
- APPROVAL GATE before push/merge.

## Do NOT
- Implement unchosen options “while we’re here”.
- Change HF Space options 7/8 policy unless the choice requires it and I OK’d that.
- Claim full official support without a real smoke pass on that OS.
```
