# VHectorLab 3D

3D visualization (WebGL/Three.js) and semantic embedding vector arithmetic (`A − B + C`).

---

## Platform support

**Created and tested on macOS 26.5.1 (Darwin 25.5.0, Apple Silicon).**

This project was **not** prepared or validated for Windows or Linux. It may work there with a few adjustments (package managers, paths, process control), but that is unsupported. Prefer a Mac matching the versions above.

---

## Quick start (recommended)

Everything goes through `./setup.sh`. On macOS, **option 1 installs missing tools for you** when needed.

```bash
# 1. Clone the repo (folder name matches the GitHub repo)
git clone https://github.com/hbauzan/VHectorLab-3D.git
cd VHectorLab-3D

# 2. Open the control panel
chmod +x setup.sh   # first time only, if needed
./setup.sh
```

Choose **option `1`** (`Deploy / Start Tool`).

That option will:

1. Detect the OS and warn if you are not on macOS
2. **Check and install** missing prerequisites on macOS:
   - `uv` (official installer) if missing
   - Homebrew (if needed) + Node.js/`npm` if missing
   - Create `.env` from `.env.example` if missing
   - Sync backend deps (`uv sync --extra dev`)
   - Run `npm install` if `node_modules` is missing
3. Generate `public/vocab.txt` if missing
4. Run backend + frontend tests
5. Start backend (`http://127.0.0.1:8000`) + frontend (`http://127.0.0.1:5173`)
6. Open the browser

App URL when ready:

👉 **http://127.0.0.1:5173**

- Leave live logs: `Ctrl+C`
- Stop services: run `./setup.sh` again → option **`10`**

> First run can take a while: it may download Homebrew/Node/`uv`, Python packages, and the embedding model.

---

## What `setup.sh` expects (and installs on Mac)

| Tool | Role | If missing on macOS |
| :--- | :--- | :--- |
| **uv** | Python deps / run backend | Installed via [official uv installer](https://docs.astral.sh/uv/) |
| **Node.js + npm** | Frontend (Vite / Vitest) | Installed via Homebrew (`brew install node`) |
| **Homebrew** | Used only to install Node if needed | Installed from [brew.sh](https://brew.sh) |
| **`.env`** | Runtime config | Copied from `.env.example` |
| **Backend deps** | FastAPI / PyTorch stack | `uv sync --extra dev` in `backend/` |
| **Frontend deps** | Three.js / Vite | `npm install` when `node_modules` is absent |
| **Docker Desktop** | **Optional** — only for option **7** (HF Spaces image build) | Not installed by option 1. Option 7 checks Docker; on macOS it can install the Docker Desktop cask via Homebrew and asks you to start the app |

**Daily local use (option 1) does not need Docker Desktop** — only `uv` + Node/`npm` (+ network).

You do **not** need to install `uv` or Node by hand on a typical Mac — option 1 handles that. You *do* need network access and (for Homebrew) permission to install software.

### Optional: Docker Desktop (options 7 only)

Install [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/) if you want to build the Hugging Face Spaces image locally. After install, open Docker Desktop and wait until the engine is running (whale icon steady), then use option **7**.

Option **8** (publish to HF Hub) uses `npm run build` + `git push` to the Space — it does **not** require Docker.

---

## `setup.sh` menu

| Option | What it does |
| :--- | :--- |
| **1** | Full flow: check/install → test → start → open browser (**no Docker**) |
| **2** | Backend only (FastAPI on `:8000`) |
| **3** | System heartbeat / health check |
| **4** | Frontend unit tests (Vitest) |
| **5** | Backend unit tests (pytest) |
| **6** | Vocabulary: load a custom file or generate N words |
| **7** | Build Hugging Face Spaces Docker image (**requires Docker Desktop**) |
| **8** | Publish to Hugging Face Space (git sync; no Docker) |
| **9** | View backend logs |
| **10** | Stop / clean services |
| **0** | Exit |

---

## Environment variables

Copy `.env.example` → `.env` (option 1 does this if `.env` is missing). Common keys:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `HOST` / `PORT` | `127.0.0.1` / `8000` | Backend listen address |
| `MODEL_NAME` | `all-mpnet-base-v2` | Embedding model |
| `VOCAB_PATH` | `public/vocab.txt` | App vocabulary file |
| `VITE_API_BASE_URL` | `/api` | Browser API base URL |
| `VITE_SHOW_CAM_POSE` | `false` | Live camera POS/ROT overlay (debug) |

---

## Manual start (without the panel)

Only if you prefer not to use `setup.sh` (still assumes macOS + tools already available):

```bash
# Backend
cd backend
uv sync --extra dev
uv run python -m server

# Frontend (another terminal, repo root)
npm install
npx vite --port 5173 --host 127.0.0.1
```

---

## Troubleshooting

| Symptom | What to check |
| :--- | :--- |
| Unsupported platform warning | You are not on Darwin/macOS — unsupported; adapt paths/package managers yourself |
| Homebrew install asks for a password | Normal on first install; approve locally |
| `uv` / `npm` still missing after option 1 | Open a **new** terminal (PATH refresh), then re-run `./setup.sh` |
| Backend tests slow / fail on first run | Model download needs network; wait and retry |
| Browser does not open | Open http://127.0.0.1:5173 manually |
| Port already in use | Option `10` in `setup.sh`, then start again |
| Option 7 fails / “Docker daemon not running” | Install/open **Docker Desktop**, wait until it is running, retry option 7 |
| `Failed to spawn: pytest` / No such file | Stale `backend/.venv` after renaming the folder. Option 1 now recreates it; or run `rm -rf backend/.venv && cd backend && uv sync --extra dev` |
