#!/bin/bash
# ==========================================
# VHectorLab 3D - CONTROL PANEL & CLI SETUP
# ==========================================

# ANSI Color Palette
RESET="\033[0m"
BOLD="\033[1m"
CYAN="\033[1;36m"
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
BLUE="\033[1;34m"
MAGENTA="\033[1;35m"
RED="\033[1;31m"
DIM="\033[2m"

LOG_FILE="vhectorlab_dev.log"
# Created & tested on macOS 26.5.1 (Darwin 25.5.0, arm64). Not prepared for Windows/Linux.
SUPPORTED_OS_LABEL="macOS 26.5.1 (Darwin 25.5.0)"

# Panel phase for SIGINT: menu | logs | confirm
# Ctrl+C must NEVER stop backend/frontend — only option 10 does that.
PANEL_PHASE="menu"

exit_panel_keep_services() {
    echo -e "\n${CYAN}${BOLD}Goodbye! Services keep running (use option 10 to stop).${RESET}"
    exit 0
}

handle_sigint() {
    case "$PANEL_PHASE" in
        logs)
            # Interrupt tail -f only; follow_backend_logs continues to the confirm prompt.
            echo -e "\n${YELLOW}${BOLD}⏸ Log follow paused. Services still running.${RESET}"
            PANEL_PHASE="confirm"
            ;;
        confirm)
            exit_panel_keep_services
            ;;
        *)
            exit_panel_keep_services
            ;;
    esac
}

trap 'handle_sigint' INT

# Launch a command in a new session (no controlling TTY).
# Avoids: (1) panel Ctrl+C SIGINT killing services, (2) SIGTTOU stop (STAT T) from set -m/job control.
# Usage: launch_detached <workdir> <logfile|-> <cmd...>   ("-" logfile → /dev/null)
launch_detached() {
    local workdir="$1"
    local logfile="$2"
    shift 2
    if [ "$logfile" = "-" ]; then
        logfile="/dev/null"
    fi
    case "$workdir" in
        /*) ;;
        *) workdir="$(pwd)/$workdir" ;;
    esac
    case "$logfile" in
        /*) ;;
        *) logfile="$(pwd)/$logfile" ;;
    esac

    python3 - "$workdir" "$logfile" "$@" <<'PY'
import os, sys, subprocess

workdir, logfile, *cmd = sys.argv[1:]
os.chdir(workdir)
log = open(logfile, "a", buffering=1)
subprocess.Popen(
    cmd,
    stdin=subprocess.DEVNULL,
    stdout=log,
    stderr=subprocess.STDOUT,
    start_new_session=True,
    close_fds=True,
)
PY
}

refresh_path() {
    # uv installer lands in ~/.local/bin; Homebrew on Apple Silicon uses /opt/homebrew.
    export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
    # shellcheck disable=SC1090
    [ -f "$HOME/.local/bin/env" ] && source "$HOME/.local/bin/env"
}

warn_if_unsupported_platform() {
    local os_name
    os_name="$(uname -s 2>/dev/null || echo unknown)"
    if [ "$os_name" != "Darwin" ]; then
        echo -e "${YELLOW}${BOLD}⚠️  Unsupported platform: ${os_name}${RESET}"
        echo -e "${YELLOW}   This project was created and tested on ${SUPPORTED_OS_LABEL}.${RESET}"
        echo -e "${YELLOW}   It was not prepared for Windows or Linux. Small adaptations may make it work.${RESET}"
        echo -e "${YELLOW}   Auto-install of missing tools is macOS-only (Homebrew + official uv installer).${RESET}"
        return 1
    fi
    return 0
}

ensure_homebrew() {
    if command -v brew &> /dev/null; then
        echo -e "  ${GREEN}✓ Homebrew detected.${RESET}"
        return 0
    fi
    echo -e "${YELLOW}▶ Homebrew not found. Installing Homebrew (may ask for your password)...${RESET}"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if [ -x /opt/homebrew/bin/brew ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [ -x /usr/local/bin/brew ]; then
        eval "$(/usr/local/bin/brew shellenv)"
    fi
    refresh_path
    if ! command -v brew &> /dev/null; then
        echo -e "${RED}❌ Failed to install Homebrew. Install it from https://brew.sh and re-run.${RESET}"
        return 1
    fi
    echo -e "  ${GREEN}✓ Homebrew installed.${RESET}"
    return 0
}

ensure_uv() {
    refresh_path
    if command -v uv &> /dev/null; then
        echo -e "  ${GREEN}✓ Python package manager 'uv' detected ($(uv --version 2>/dev/null | head -1)).${RESET}"
        return 0
    fi
    echo -e "${YELLOW}▶ 'uv' not found. Installing via official installer...${RESET}"
    curl -LsSf https://astral.sh/uv/install.sh | sh
    refresh_path
    if ! command -v uv &> /dev/null; then
        echo -e "${RED}❌ Failed to install 'uv'. See https://docs.astral.sh/uv/getting-started/installation/${RESET}"
        return 1
    fi
    echo -e "  ${GREEN}✓ 'uv' installed ($(uv --version 2>/dev/null | head -1)).${RESET}"
    return 0
}

ensure_node_npm() {
    refresh_path
    if command -v npm &> /dev/null && command -v node &> /dev/null; then
        echo -e "  ${GREEN}✓ Node.js $(node --version) / npm $(npm --version) detected.${RESET}"
        return 0
    fi
    if [ "$(uname -s)" != "Darwin" ]; then
        echo -e "${RED}❌ Node.js/npm missing. On this unsupported OS, install Node.js LTS yourself, then re-run.${RESET}"
        return 1
    fi
    ensure_homebrew || return 1
    echo -e "${YELLOW}▶ Node.js/npm not found. Installing Node via Homebrew...${RESET}"
    brew install node
    refresh_path
    if ! command -v npm &> /dev/null || ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Failed to install Node.js/npm. Install the LTS from https://nodejs.org and re-run.${RESET}"
        return 1
    fi
    echo -e "  ${GREEN}✓ Node.js $(node --version) / npm $(npm --version) installed.${RESET}"
    return 0
}

ensure_project_deps() {
    if [ ! -f .env ] && [ -f .env.example ]; then
        echo -e "${YELLOW}▶ Creating .env from .env.example...${RESET}"
        cp .env.example .env
        echo -e "  ${GREEN}✓ .env created (edit values if needed).${RESET}"
    elif [ -f .env ]; then
        echo -e "  ${GREEN}✓ .env present.${RESET}"
    fi

    # After renaming/moving the repo folder, entrypoint scripts in .venv keep absolute
    # shebangs to the old path → `uv run pytest` fails with "No such file or directory".
    if [ -f backend/.venv/bin/pytest ]; then
        local pytest_python
        pytest_python="$(head -1 backend/.venv/bin/pytest | sed 's/^#![[:space:]]*//')"
        if [ -n "$pytest_python" ] && [ ! -e "$pytest_python" ]; then
            echo -e "${YELLOW}▶ Backend .venv is stale (scripts still point to a missing path).${RESET}"
            echo -e "${YELLOW}  Recreating virtualenv after folder move/rename...${RESET}"
            rm -rf backend/.venv
        fi
    fi

    echo -e "${BLUE}▶ Syncing backend Python deps (uv sync --extra dev)...${RESET}"
    (cd backend && uv sync --extra dev) || {
        echo -e "${RED}❌ Backend dependency sync failed.${RESET}"
        return 1
    }
    echo -e "  ${GREEN}✓ Backend deps ready.${RESET}"

    if [ ! -d node_modules ]; then
        echo -e "${YELLOW}▶ Frontend node_modules missing. Running npm install...${RESET}"
        npm install || {
            echo -e "${RED}❌ npm install failed.${RESET}"
            return 1
        }
        echo -e "  ${GREEN}✓ Frontend deps installed.${RESET}"
    else
        echo -e "  ${GREEN}✓ Frontend node_modules present.${RESET}"
    fi
    return 0
}

ensure_prerequisites() {
    echo -e "\n${CYAN}${BOLD}====================================================${RESET}"
    echo -e "${CYAN}${BOLD}🔍 CHECKING / INSTALLING PREREQUISITES...${RESET}"
    echo -e "${CYAN}${BOLD}====================================================${RESET}"
    echo -e "  ${DIM}Supported / tested on: ${SUPPORTED_OS_LABEL}${RESET}"

    warn_if_unsupported_platform
    # On macOS, missing tools are installed automatically. Elsewhere, require them preinstalled.

    ensure_uv || return 1
    ensure_node_npm || return 1
    ensure_project_deps || return 1
    return 0
}

# --- Idempotent service probes (process + health; ports detect "sick") ---
# healthy = matching process AND health OK
# down    = no process, no health, port free
# sick    = anything else (partial / port held / health failing)

BACKEND_URL="http://127.0.0.1:8000"
FRONTEND_URL="http://127.0.0.1:5173"
BACKEND_PORT=8000
FRONTEND_PORT=5173

port_listening() {
    local port="$1"
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

backend_process_running() {
    pgrep -f "server:app|python -m server" >/dev/null 2>&1
}

frontend_process_running() {
    # Prefer the launch signature from this script; avoid bare "vite" (matches vitest).
    pgrep -f "vite --port ${FRONTEND_PORT}" >/dev/null 2>&1
}

backend_health_ok() {
    local body
    body="$(curl -sf --max-time 2 "${BACKEND_URL}/health" 2>/dev/null)" || return 1
    echo "$body" | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"'
}

frontend_health_ok() {
    curl -sf --max-time 2 -o /dev/null "${FRONTEND_URL}/" 2>/dev/null
}

# Prints: healthy | sick | down
probe_backend() {
    local proc=0 health=0 port=0
    backend_process_running && proc=1
    backend_health_ok && health=1
    port_listening "$BACKEND_PORT" && port=1
    if [ "$proc" -eq 1 ] && [ "$health" -eq 1 ]; then
        echo "healthy"
    elif [ "$proc" -eq 0 ] && [ "$health" -eq 0 ] && [ "$port" -eq 0 ]; then
        echo "down"
    else
        echo "sick"
    fi
}

# Prints: healthy | sick | down
probe_frontend() {
    local proc=0 health=0 port=0
    frontend_process_running && proc=1
    frontend_health_ok && health=1
    port_listening "$FRONTEND_PORT" && port=1
    if [ "$proc" -eq 1 ] && [ "$health" -eq 1 ]; then
        echo "healthy"
    elif [ "$proc" -eq 0 ] && [ "$health" -eq 0 ] && [ "$port" -eq 0 ]; then
        echo "down"
    else
        echo "sick"
    fi
}

describe_service_state() {
    local name="$1"
    local state="$2"
    local port="$3"
    case "$state" in
        healthy) echo -e "  ${GREEN}✓ ${name}: healthy (process + health OK on :${port})${RESET}" ;;
        down)    echo -e "  ${DIM}· ${name}: down${RESET}" ;;
        sick)    echo -e "  ${YELLOW}⚠ ${name}: sick (process/port/health mismatch on :${port})${RESET}" ;;
        *)       echo -e "  ${RED}? ${name}: unknown (${state})${RESET}" ;;
    esac
}

ensure_vocab() {
    if [ ! -f "public/vocab.txt" ]; then
        echo -e "${YELLOW}⚠️ Vocabulary missing at public/vocab.txt. Generating 10,000 words...${RESET}"
        python3 scripts/generate_vocab.py --count 10000
    fi
    echo -e "  ${GREEN}✓ public/vocab.txt OK ($(wc -l < public/vocab.txt | tr -d ' ') words).${RESET}"
}

run_full_test_suite() {
    echo -e "\n${CYAN}${BOLD}====================================================${RESET}"
    echo -e "${CYAN}${BOLD}🧪 RUNNING FULL TEST SUITE...${RESET}"
    echo -e "${CYAN}${BOLD}====================================================${RESET}"

    echo -e "${BLUE}${BOLD}▶ [1/2] Backend unit tests (pytest)...${RESET}"
    echo -e "${DIM}Loading PyTorch SentenceTransformer model into memory...${RESET}"
    (cd backend && uv run python -m pytest -v -s)
    if [ $? -ne 0 ]; then
        echo -e "${RED}${BOLD}❌ ERROR: Backend tests failed. Fix them before deploying.${RESET}"
        return 1
    fi
    echo -e "  ${GREEN}${BOLD}✓ Backend tests GREEN.${RESET}"

    echo -e "\n${BLUE}${BOLD}▶ [2/2] Frontend unit tests (Vitest)...${RESET}"
    npx vitest run --reporter=verbose
    if [ $? -ne 0 ]; then
        echo -e "${RED}${BOLD}❌ ERROR: Frontend tests failed. Fix them before deploying.${RESET}"
        return 1
    fi
    echo -e "  ${GREEN}${BOLD}✓ Frontend tests GREEN.${RESET}"
    return 0
}

kill_stack() {
    pkill -f "server:app|python -m server" 2>/dev/null
    pkill -f "vite --port ${FRONTEND_PORT}" 2>/dev/null
    # Fallback for older/manual vite launches on the same port
    pkill -f "vite" 2>/dev/null
    sleep 1
}

wait_backend_healthy() {
    echo -n "  Loading model [waiting for /health status=ok]"
    local i
    for i in {1..60}; do
        if backend_health_ok; then
            echo -e " ${GREEN}${BOLD}MODEL LOADED OK!${RESET}"
            return 0
        fi
        echo -n " ⏳"
        sleep 1
    done
    echo -e " ${RED}${BOLD}TIMEOUT${RESET}"
    return 1
}

start_backend() {
    echo -e "${BLUE}▶ Starting Backend FastAPI (${BACKEND_URL})...${RESET}"
    launch_detached "backend" "$LOG_FILE" uv run python -m server
    wait_backend_healthy
}

start_frontend() {
    echo -e "${BLUE}▶ Starting Frontend WebGL (Vite Dev Server)...${RESET}"
    launch_detached "." "-" npx vite --port "$FRONTEND_PORT" --host 127.0.0.1
    local i
    for i in {1..20}; do
        if frontend_health_ok; then
            echo -e "  ${GREEN}✓ Frontend responding on ${FRONTEND_URL}${RESET}"
            return 0
        fi
        sleep 0.5
    done
    echo -e "${YELLOW}  Frontend started but not responding yet on ${FRONTEND_URL}${RESET}"
    return 1
}

open_app_browser() {
    echo -e "${YELLOW}🌐 Opening browser at ${FRONTEND_URL}...${RESET}"
    if command -v open &> /dev/null; then
        open "$FRONTEND_URL"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$FRONTEND_URL"
    fi
}

follow_backend_logs() {
    echo -e "\n${MAGENTA}${BOLD}====================================================${RESET}"
    echo -e "${MAGENTA}${BOLD}📜 LIVE BACKEND LOGS${RESET}"
    echo -e "${MAGENTA}${BOLD}====================================================${RESET}"
    echo -e " ${DIM}Ctrl+C pauses logs (does NOT stop services).${RESET}\n"

    PANEL_PHASE="logs"
    # SIGINT interrupts this pipeline; handle_sigint keeps the panel alive.
    tail -f "$LOG_FILE" 2>/dev/null | sed \
        -e "s/INFO/${GREEN}INFO${RESET}/g" \
        -e "s/WARNING/${YELLOW}WARNING${RESET}/g" \
        -e "s/ERROR/${RED}ERROR${RESET}/g" \
        -e "s/200 OK/${GREEN}200 OK${RESET}/g" \
        -e "s/POST /${CYAN}POST ${RESET}/g" \
        -e "s/GET /${CYAN}GET ${RESET}/g" \
        || true

    PANEL_PHASE="confirm"
    echo -e "\n${YELLOW}${BOLD}Press Enter to return to the menu, or Ctrl+C again to exit the panel.${RESET}"
    echo -e "${DIM}Services stay up either way. Use option 10 to stop them.${RESET}"
    if read -r _; then
        PANEL_PHASE="menu"
        return 0
    fi
    exit_panel_keep_services
}

print_ready_banner() {
    echo -e "\n${GREEN}${BOLD}====================================================${RESET}"
    echo -e "${GREEN}${BOLD}        🎉 Ready to go!${RESET}"
    echo -e "${GREEN}${BOLD}====================================================${RESET}"
    echo -e " ${BOLD}The tool is running at:${RESET}"
    echo -e " ${CYAN}${BOLD}👉 ${FRONTEND_URL}${RESET}\n"
}

show_menu() {
    clear
    echo -e "${CYAN}${BOLD}====================================================${RESET}"
    echo -e "${CYAN}${BOLD}       🌐 VHectorLab 3D - CONTROL PANEL${RESET}"
    echo -e "${CYAN}${BOLD}====================================================${RESET}"
    echo -e " ${GREEN}${BOLD}1. 🚀 Deploy / Start Tool${RESET} ${DIM}(Idempotent: skip start if already healthy)${RESET}"
    echo -e " ${GREEN}2.${RESET} ${BOLD}Start Bare-metal Backend${RESET} ${DIM}(FastAPI on 127.0.0.1:8000 · skip if healthy)${RESET}"
    echo -e " ${BLUE}3.${RESET} ${BOLD}Run System Heartbeat${RESET} ${DIM}(Health Check & Arithmetic)${RESET}"
    echo -e " ${BLUE}4.${RESET} ${BOLD}Run Frontend Unit Tests${RESET} ${DIM}(Vitest)${RESET}"
    echo -e " ${BLUE}5.${RESET} ${BOLD}Run Backend Unit Tests${RESET} ${DIM}(pytest)${RESET}"
    echo -e " ${MAGENTA}6.${RESET} ${BOLD}Manage Vocabulary${RESET} ${DIM}(Custom vocab.txt / N words)${RESET}"
    echo -e " ${YELLOW}7.${RESET} ${BOLD}Build Hugging Face Space Docker Image${RESET} ${DIM}(Docker Desktop · torch CPU · :7860)${RESET}"
    echo -e " ${YELLOW}8.${RESET} ${BOLD}Publish Hugging Face Space${RESET} ${DIM}(hf CLI · docker sdk · cpu-basic)${RESET}"
    echo -e " ${CYAN}9.${RESET} ${BOLD}View Logs${RESET} ${DIM}(Live backend logs)${RESET}"
    echo -e " ${RED}10.${RESET} ${BOLD}Stop / Clean Services${RESET}"
    echo -e " ${MAGENTA}11.${RESET} ${BOLD}Select Embedding Model / Profile${RESET} ${DIM}(catalog · rebuild NPZ · restart backend)${RESET}"
    echo -e " ${DIM}0. Exit${RESET}"
    echo -e "${CYAN}${BOLD}====================================================${RESET}"
}

deploy_and_start() {
    local be_state fe_state force_restart=0
    be_state="$(probe_backend)"
    fe_state="$(probe_frontend)"

    echo -e "\n${CYAN}${BOLD}====================================================${RESET}"
    echo -e "${CYAN}${BOLD}📡 SERVICE STATUS${RESET}"
    echo -e "${CYAN}${BOLD}====================================================${RESET}"
    describe_service_state "Backend " "$be_state" "$BACKEND_PORT"
    describe_service_state "Frontend" "$fe_state" "$FRONTEND_PORT"

    # Both already healthy: skip prereqs, tests, and start — just open the app.
    if [ "$be_state" = "healthy" ] && [ "$fe_state" = "healthy" ]; then
        echo -e "\n${GREEN}${BOLD}✓ Stack already up — skipping prerequisites, tests, and start.${RESET}"
        print_ready_banner
        open_app_browser
        echo -e "${DIM}Services left running as-is. Use options 4/5 for tests, 9 for logs, 10 to stop.${RESET}"
        read -p "Press Enter to return to menu..."
        return
    fi

    # Sick or partial → recycle both (don't leave the user stuck on a frozen port).
    if [ "$be_state" = "sick" ] || [ "$fe_state" = "sick" ]; then
        force_restart=1
        echo -e "\n${YELLOW}${BOLD}⚠ Sick stack detected (e.g. frozen process on a live port). Recycling BOTH services.${RESET}"
    elif { [ "$be_state" = "healthy" ] && [ "$fe_state" = "down" ]; } || \
         { [ "$be_state" = "down" ] && [ "$fe_state" = "healthy" ]; }; then
        force_restart=1
        echo -e "\n${YELLOW}${BOLD}⚠ Partial stack detected — restarting BOTH services.${RESET}"
    fi

    echo -e "\n${CYAN}${BOLD}====================================================${RESET}"
    echo -e "${CYAN}${BOLD}🔍 VERIFYING ENVIRONMENT & REQUIREMENTS...${RESET}"
    echo -e "${CYAN}${BOLD}====================================================${RESET}"

    if ! ensure_prerequisites; then
        read -p "Press Enter..."
        return
    fi

    ensure_vocab

    if ! run_full_test_suite; then
        read -p "Press Enter..."
        return
    fi

    echo -e "\n${CYAN}${BOLD}====================================================${RESET}"
    echo -e "${CYAN}${BOLD}🚀 STARTING SERVICES (BACKEND + FRONTEND)...${RESET}"
    echo -e "${CYAN}${BOLD}====================================================${RESET}"

    if [ "$force_restart" -eq 1 ]; then
        echo -e "${YELLOW}▶ Stopping existing services before full restart...${RESET}"
    fi
    kill_stack

    if ! start_backend; then
        echo -e "${RED}${BOLD}❌ Backend failed to become healthy. Check ${LOG_FILE}.${RESET}"
        read -p "Press Enter..."
        return
    fi
    start_frontend

    print_ready_banner
    open_app_browser
    follow_backend_logs
}

start_bare_metal_backend() {
    local be_state
    be_state="$(probe_backend)"
    describe_service_state "Backend " "$be_state" "$BACKEND_PORT"

    if [ "$be_state" = "healthy" ]; then
        echo -e "${GREEN}${BOLD}✓ Backend already healthy — skipping start.${RESET}"
        read -p "Press Enter..."
        return
    fi

    if [ "$be_state" = "sick" ]; then
        echo -e "\n${YELLOW}${BOLD}⚠ Backend sick — stopping and restarting.${RESET}"
        pkill -f "server:app|python -m server" 2>/dev/null
        sleep 1
    fi

    echo -e "${GREEN}Starting Bare-metal Backend...${RESET}"
    if ! ensure_prerequisites; then
        read -p "Press Enter..."
        return
    fi
    start_backend
    echo -e "${GREEN}Backend started in background (Logs: $LOG_FILE)${RESET}"
    read -p "Press Enter..."
}

manage_vocab() {
    echo ""
    echo -e "${MAGENTA}${BOLD}--- Manage Vocabulary ---${RESET}"
    echo -e " ${GREEN}1)${RESET} Load Custom vocab.txt file"
    echo -e " ${GREEN}2)${RESET} Generate new vocab.txt with custom word count"
    read -p "Select option [1-2]: " vopt
    case $vopt in
        1)
            read -p "Enter path to your custom vocab.txt: " custom_path
            if [ -f "$custom_path" ]; then
                cp "$custom_path" public/vocab.txt
                echo -e "${GREEN}✅ Successfully copied $custom_path to public/vocab.txt${RESET}"
            else
                echo -e "${RED}❌ Error: File $custom_path does not exist.${RESET}"
            fi
            ;;
        2)
            read -p "Enter target word count (default 10000): " count
            count=${count:-10000}
            python3 scripts/generate_vocab.py --count "$count"
            ;;
        *)
            echo -e "${RED}Invalid option.${RESET}"
            ;;
    esac
    read -p "Press Enter to return to menu..."
}

select_embedding_model() {
    echo ""
    echo -e "${MAGENTA}${BOLD}--- Select Embedding Model / Profile ---${RESET}"
    echo -e "${DIM}Swap always regenerates vocab NPZ, writes .env, and restarts the backend.${RESET}"
    echo -e "${DIM}EN∪ES vocab is ensured (public/vocab_en_es.txt). No HF Space changes.${RESET}"
    echo ""

    if [ -f .env ]; then
        echo -e "${BOLD}Current .env:${RESET}"
        grep -E '^(MODEL_PROFILE|MODEL_NAME|TRUNCATE_DIM|VOCAB_PATH|VOCAB_EMBEDDINGS_PATH)=' .env 2>/dev/null \
            | sed 's/^/  /' || true
    else
        echo -e "${YELLOW}No .env yet — will create/update on apply.${RESET}"
    fi
    echo ""

    if ! uv run --directory backend python "$(pwd)/scripts/select_embedding_model.py" list; then
        echo -e "${RED}Failed to load embedding catalog.${RESET}"
        read -p "Press Enter to return to menu..."
        return
    fi
    echo ""
    echo -e " ${DIM}Enter P# (profile), M# (model), or Cancel.${RESET}"
    read -p "Choice [e.g. P1 / M2 / cancel]: " choice
    case "$choice" in
        ""|c|C|cancel|Cancel|CANCEL|0)
            echo -e "${YELLOW}Cancelled.${RESET}"
            read -p "Press Enter to return to menu..."
            return
            ;;
    esac

    echo -e "\n${CYAN}▶ Staging .env + precomputing vocab embeddings (may download the model)…${RESET}"
    if ! uv run --directory backend python "$(pwd)/scripts/select_embedding_model.py" apply --choice "$choice" --device "${SAE_DEVICE:-AUTO}"; then
        echo -e "${RED}${BOLD}❌ Swap failed — previous .env restored.${RESET}"
        echo -e "${DIM}Gated models need: hf auth login + accept license on the Hub.${RESET}"
        read -p "Press Enter to return to menu..."
        return
    fi

    echo -e "${CYAN}▶ Restarting backend to load the new model…${RESET}"
    pkill -f "server:app|python -m server" 2>/dev/null
    sleep 1
    if ! start_backend; then
        echo -e "${RED}${BOLD}❌ Backend failed to become healthy after swap. Check ${LOG_FILE}.${RESET}"
        read -p "Press Enter to return to menu..."
        return
    fi

    echo -e "\n${GREEN}${BOLD}✓ /health after swap:${RESET}"
    curl -sS --max-time 5 "${BACKEND_URL}/health" | python3 -m json.tool 2>/dev/null \
        || curl -sS --max-time 5 "${BACKEND_URL}/health"
    echo ""
    read -p "Press Enter to return to menu..."
}

ensure_docker() {
    refresh_path
    if command -v docker &> /dev/null && docker info &> /dev/null; then
        echo -e "  ${GREEN}✓ Docker is available ($(docker --version 2>/dev/null)).${RESET}"
        return 0
    fi

    if command -v docker &> /dev/null && ! docker info &> /dev/null; then
        echo -e "${YELLOW}▶ Docker CLI found but the daemon is not running.${RESET}"
        if [ "$(uname -s)" = "Darwin" ]; then
            echo -e "${YELLOW}  Opening Docker Desktop — wait until it says running, then retry option 7.${RESET}"
            open -a Docker 2>/dev/null || true
        fi
        echo -e "${RED}❌ Start Docker Desktop (whale icon in the menu bar), then re-run option 7.${RESET}"
        return 1
    fi

    if [ "$(uname -s)" != "Darwin" ]; then
        echo -e "${RED}❌ Docker is required for this option but is not installed.${RESET}"
        echo -e "${RED}   Local daily use (option 1) does not need Docker. Install Docker yourself on this OS.${RESET}"
        return 1
    fi

    ensure_homebrew || return 1
    echo -e "${YELLOW}▶ Docker not found. Installing Docker Desktop via Homebrew (cask)...${RESET}"
    echo -e "${DIM}  Note: Docker Desktop is optional — only needed for HF Space image builds (option 7).${RESET}"
    brew install --cask docker || {
        echo -e "${RED}❌ Failed to install Docker Desktop. Install from https://www.docker.com/products/docker-desktop/${RESET}"
        return 1
    }
    echo -e "${YELLOW}  Opening Docker Desktop for first-time setup...${RESET}"
    open -a Docker 2>/dev/null || true
    echo -e "${YELLOW}  Wait until Docker Desktop finishes starting, then re-run option 7.${RESET}"
    return 1
}

ensure_hf_cli() {
    refresh_path
    if command -v hf &> /dev/null; then
        echo -e "  ${GREEN}✓ Hugging Face CLI available ($(hf version 2>/dev/null | head -1 || echo hf)).${RESET}"
        return 0
    fi
    echo -e "${YELLOW}▶ Installing Hugging Face Hub CLI via uv…${RESET}"
    uv tool install huggingface_hub[cli] 2>/dev/null || uv pip install --system 'huggingface_hub[cli]' 2>/dev/null || {
        echo -e "${RED}❌ Could not install hf CLI. Run: uv tool install 'huggingface_hub[cli]' then hf auth login${RESET}"
        return 1
    }
    refresh_path
    if ! command -v hf &> /dev/null; then
        echo -e "${RED}❌ hf not on PATH after install. Open a new terminal or run: uv tool update-shell${RESET}"
        return 1
    fi
    return 0
}

ensure_hf_auth() {
    local out ec=0
    out="$(hf auth whoami 2>&1)" || ec=$?
    if [ "$ec" -ne 0 ] || echo "$out" | grep -qiE 'invalid user token|not logged in|no token|unauthorized|401|error:'; then
        echo -e "${RED}❌ Hugging Face auth failed.${RESET}"
        echo -e "${DIM}$(echo "$out" | head -4)${RESET}"
        echo -e "${YELLOW}  Fix: hf auth login --force --add-to-git-credential${RESET}"
        echo -e "${DIM}  Create a Write token at https://huggingface.co/settings/tokens${RESET}"
        return 1
    fi
    echo -e "  ${GREEN}✓ HF auth OK${RESET} ${DIM}$(echo "$out" | head -3 | tr '\n' ' ')${RESET}"
    return 0
}

build_hf_docker() {
    echo -e "${YELLOW}${BOLD}Compiling Hugging Face Spaces Docker Image (cpu-basic / torch CPU)…${RESET}"
    if ! ensure_docker; then
        read -p "Press Enter to return to menu..."
        return
    fi
    echo -e "${DIM}  UV_TORCH_BACKEND=cpu · port 7860 · precomputes vocab_embeddings.npz in-image${RESET}"
    docker build -t vhectorlab-3d:latest .
    if [ $? -ne 0 ]; then
        echo -e "${RED}${BOLD}❌ Docker build failed.${RESET}"
        read -p "Press Enter to return to menu..."
        return
    fi
    echo -e "${GREEN}${BOLD}✅ Image tagged vhectorlab-3d:latest${RESET}"
    read -p "Smoke-test locally on :7860 now? [y/N]: " smoke
    if [[ "$smoke" =~ ^[Yy]$ ]]; then
        echo -e "${CYAN}▶ docker run --rm -p 7860:7860 vhectorlab-3d:latest${RESET}"
        echo -e "${DIM}  Open http://127.0.0.1:7860 — Ctrl+C stops the container.${RESET}"
        docker run --rm -p 7860:7860 vhectorlab-3d:latest
    fi
    read -p "Press Enter to return to menu..."
}

# Normalize user input to Hugging Face Space id: "namespace/name".
# Accepts bare id, or URLs like https://huggingface.co/spaces/ns/name
normalize_hf_space_id() {
    local raw="$1"
    raw="$(echo "$raw" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    # Strip common URL prefixes (order matters: spaces/ before bare hub host)
    raw="$(echo "$raw" | sed -E \
        -e 's#^https?://huggingface\.co/spaces/##' \
        -e 's#^https?://hf\.co/spaces/##' \
        -e 's#^https?://huggingface\.co/##' \
        -e 's#^https?://hf\.co/##' \
        -e 's#/$##')"
    echo "$raw"
}

validate_hf_space_id() {
    local id="$1"
    if [[ ! "$id" =~ ^[A-Za-z0-9_-]+/[A-Za-z0-9._-]+$ ]]; then
        return 1
    fi
    return 0
}

load_dotenv() {
    # Export KEY=VAL from .env (ignore comments / blank lines). Used for option 8 defaults.
    if [ ! -f .env ]; then
        return 0
    fi
    local line key val
    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
            ''|\#*) continue ;;
        esac
        if [[ "$line" != *=* ]]; then
            continue
        fi
        key="${line%%=*}"
        val="${line#*=}"
        key="$(echo "$key" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
        val="$(echo "$val" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
        if [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
            export "$key=$val"
        fi
    done < .env
}

publish_hf_space() {
    load_dotenv
    local default_space="${HF_SPACE_ID:-hbauzan/llm-semantic-visualizer}"
    local force_push="${HF_SPACE_FORCE_PUSH:-1}"

    echo -e "${YELLOW}${BOLD}--- Hugging Face Spaces Publisher (Docker · cpu-basic) ---${RESET}"
    echo -e "${DIM}  Defaults from .env — press Enter to accept.${RESET}"
    echo -e "${DIM}  Space: ${default_space}  ·  force-push: ${force_push}${RESET}"
    if ! ensure_hf_cli; then
        read -p "Press Enter..."
        return
    fi
    if ! ensure_hf_auth; then
        read -p "Press Enter..."
        return
    fi

    local space_raw
    read -p "Enter Space id [${default_space}]: " space_raw
    space_raw="${space_raw:-$default_space}"
    local space_id
    space_id="$(normalize_hf_space_id "$space_raw")"
    if [ -z "$space_id" ]; then
        echo -e "${RED}Space ID required.${RESET}"
        read -p "Press Enter..."
        return
    fi
    if ! validate_hf_space_id "$space_id"; then
        echo -e "${RED}❌ Invalid Space id: ${space_raw}${RESET}"
        echo -e "${RED}   Use namespace/name only, e.g. hbauzan/llm-semantic-visualizer${RESET}"
        echo -e "${DIM}   (You pasted a profile/URL; that is not a Space repository.)${RESET}"
        read -p "Press Enter..."
        return
    fi
    if [ "$space_id" != "$space_raw" ]; then
        echo -e "${CYAN}  Normalized to: ${BOLD}${space_id}${RESET}"
    fi

    # Prefer reusing an existing Space. `hf repos create` now returns 402 without PRO
    # even with --exist-ok, so never call create when the Space is already there.
    if hf spaces info "$space_id" &> /dev/null; then
        echo -e "  ${GREEN}✓ Space exists — skipping create (push-only).${RESET}"
        echo -e "${DIM}  https://huggingface.co/spaces/${space_id}${RESET}"
    else
        echo -e "${CYAN}▶ Space not found. Creating (sdk=docker, flavor=cpu-basic)…${RESET}"
        echo -e "${DIM}  Note: new Gradio/Docker Spaces require HF PRO since mid-2026.${RESET}"
        if ! hf repos create "$space_id" --type space --space-sdk docker --flavor cpu-basic --exist-ok; then
            if ! hf repos create "$space_id" --type space --space-sdk docker --exist-ok; then
                echo -e "${RED}❌ Cannot create Space (often HTTP 402 without PRO).${RESET}"
                echo -e "${YELLOW}  Reuse an existing Docker Space id, or subscribe: https://huggingface.co/pro${RESET}"
                read -p "Press Enter..."
                return
            fi
            echo -e "${YELLOW}⚠ Created without --flavor; set hardware to cpu-basic in Space Settings if needed.${RESET}"
        fi
    fi

    echo -e "${CYAN}Building production frontend bundle…${RESET}"
    npm run build || {
        echo -e "${RED}❌ Frontend build failed.${RESET}"
        read -p "Press Enter..."
        return
    }

    local space_url="https://huggingface.co/spaces/${space_id}"
    echo -e "${CYAN}Pushing HEAD → ${space_url} (main)…${RESET}"
    echo -e "${DIM}  HF builds the Docker image from this repo (Dockerfile + README sdk: docker).${RESET}"

    # Space git history is independent of GitHub. Default force-push replaces the old
    # Space tree (e.g. predecessor app) with this repo — does NOT touch origin/main.
    if [ "$force_push" = "1" ] || [ "$force_push" = "true" ] || [ "$force_push" = "yes" ]; then
        echo -e "${DIM}  Using --force (HF_SPACE_FORCE_PUSH=${force_push}); GitHub main is untouched.${RESET}"
        if ! git push --force "$space_url" HEAD:main; then
            echo -e "${RED}❌ git push --force to Space failed.${RESET}"
            echo -e "${DIM}  Tip: hf auth login --force --add-to-git-credential ; token needs Write scope.${RESET}"
            read -p "Press Enter..."
            return
        fi
    else
        if ! git push "$space_url" HEAD:main; then
            echo -e "${RED}❌ git push to Space failed (divergent history?).${RESET}"
            echo -e "${DIM}  Set HF_SPACE_FORCE_PUSH=1 in .env to overwrite the Space remote.${RESET}"
            read -p "Press Enter..."
            return
        fi
    fi

    echo -e "${GREEN}${BOLD}✅ Published.${RESET}"
    echo -e "  Space URL: ${CYAN}${space_url}${RESET}"
    echo -e "${DIM}  Build may take several minutes (torch CPU + model + vocab NPZ).${RESET}"
    read -p "Press Enter to return to menu..."
}

stop_services() {
    echo -e "${RED}${BOLD}Stopping background services...${RESET}"
    kill_stack
    echo -e "${GREEN}✅ Services stopped.${RESET}"
    read -p "Press Enter to return to menu..."
}

view_logs() {
    if [ -f "$LOG_FILE" ]; then
        echo -e "${MAGENTA}${BOLD}📜 Mostrando últimos logs del backend...${RESET}"
        tail -n 40 "$LOG_FILE" | sed \
            -e "s/INFO/${GREEN}INFO${RESET}/g" \
            -e "s/WARNING/${YELLOW}WARNING${RESET}/g" \
            -e "s/ERROR/${RED}ERROR${RESET}/g" \
            -e "s/200 OK/${GREEN}200 OK${RESET}/g"
    else
        echo -e "${RED}No log file found.${RESET}"
    fi
    read -p "Press Enter..."
}

while true; do
    show_menu
    echo -ne "${BOLD}Choose an option [0-11]: ${RESET}"
    read choice
    case $choice in
        1)
            deploy_and_start
            ;;
        2)
            start_bare_metal_backend
            ;;
        3)
            (cd backend && uv run python perform_tests.py)
            read -p "Press Enter..."
            ;;
        4)
            npx vitest run --reporter=verbose
            read -p "Press Enter..."
            ;;
        5)
            (cd backend && uv run python -m pytest -v -s)
            read -p "Press Enter..."
            ;;
        6)
            manage_vocab
            ;;
        7)
            build_hf_docker
            ;;
        8)
            publish_hf_space
            ;;
        9)
            view_logs
            ;;
        10)
            stop_services
            ;;
        11)
            select_embedding_model
            ;;
        0)
            exit_panel_keep_services
            ;;
        *)
            echo -e "${RED}Invalid choice.${RESET}"
            sleep 1
            ;;
    esac
done
