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

show_menu() {
    clear
    echo -e "${CYAN}${BOLD}====================================================${RESET}"
    echo -e "${CYAN}${BOLD}       🌐 VHectorLab 3D - CONTROL PANEL${RESET}"
    echo -e "${CYAN}${BOLD}====================================================${RESET}"
    echo -e " ${DIM}Tested on ${SUPPORTED_OS_LABEL} · macOS only (Windows/Linux unsupported)${RESET}"
    echo -e " ${GREEN}${BOLD}1. 🚀 Deploy / Start Tool${RESET} ${DIM}(Check/Install, Test, Start, Open Browser)${RESET}"
    echo -e " ${GREEN}2.${RESET} ${BOLD}Start Bare-metal Backend${RESET} ${DIM}(FastAPI on 127.0.0.1:8000)${RESET}"
    echo -e " ${BLUE}3.${RESET} ${BOLD}Run System Heartbeat${RESET} ${DIM}(Health Check & Arithmetic)${RESET}"
    echo -e " ${BLUE}4.${RESET} ${BOLD}Run Frontend Unit Tests${RESET} ${DIM}(Vitest)${RESET}"
    echo -e " ${BLUE}5.${RESET} ${BOLD}Run Backend Unit Tests${RESET} ${DIM}(pytest)${RESET}"
    echo -e " ${MAGENTA}6.${RESET} ${BOLD}Manage Vocabulary${RESET} ${DIM}(Custom vocab.txt / N words)${RESET}"
    echo -e " ${YELLOW}7.${RESET} ${BOLD}Build Hugging Face Space Docker Image${RESET} ${DIM}(Port 7860)${RESET}"
    echo -e " ${YELLOW}8.${RESET} ${BOLD}Publish Hugging Face Space${RESET} ${DIM}(Interactive HF Hub wizard)${RESET}"
    echo -e " ${CYAN}9.${RESET} ${BOLD}View Logs${RESET} ${DIM}(Live backend logs)${RESET}"
    echo -e " ${RED}10.${RESET} ${BOLD}Stop / Clean Services${RESET}"
    echo -e " ${DIM}0. Exit${RESET}"
    echo -e "${CYAN}${BOLD}====================================================${RESET}"
}

deploy_and_start() {
    echo -e "\n${CYAN}${BOLD}====================================================${RESET}"
    echo -e "${CYAN}${BOLD}🔍 1/4 VERIFYING ENVIRONMENT & REQUIREMENTS...${RESET}"
    echo -e "${CYAN}${BOLD}====================================================${RESET}"

    if ! ensure_prerequisites; then
        read -p "Press Enter..."
        return
    fi

    # Vocabulary file
    if [ ! -f "public/vocab.txt" ]; then
        echo -e "${YELLOW}⚠️ Vocabulary missing at public/vocab.txt. Generating 10,000 words...${RESET}"
        python3 scripts/generate_vocab.py --count 10000
    fi
    echo -e "  ${GREEN}✓ public/vocab.txt OK ($(wc -l < public/vocab.txt | tr -d ' ') words).${RESET}"

    echo -e "\n${CYAN}${BOLD}====================================================${RESET}"
    echo -e "${CYAN}${BOLD}🧪 2/4 RUNNING FULL TEST SUITE...${RESET}"
    echo -e "${CYAN}${BOLD}====================================================${RESET}"

    # Run Backend pytest with verbose streaming output
    echo -e "${BLUE}${BOLD}▶ [1/2] Backend unit tests (pytest)...${RESET}"
    echo -e "${DIM}Loading PyTorch SentenceTransformer model into memory...${RESET}"
    (cd backend && uv run pytest -v -s)
    if [ $? -ne 0 ]; then
        echo -e "${RED}${BOLD}❌ ERROR: Backend tests failed. Fix them before deploying.${RESET}"
        read -p "Press Enter..."
        return
    fi
    echo -e "  ${GREEN}${BOLD}✓ Backend tests GREEN.${RESET}"

    # Run Frontend vitest with verbose output
    echo -e "\n${BLUE}${BOLD}▶ [2/2] Frontend unit tests (Vitest)...${RESET}"
    npx vitest run --reporter=verbose
    if [ $? -ne 0 ]; then
        echo -e "${RED}${BOLD}❌ ERROR: Frontend tests failed. Fix them before deploying.${RESET}"
        read -p "Press Enter..."
        return
    fi
    echo -e "  ${GREEN}${BOLD}✓ Frontend tests GREEN.${RESET}"

    echo -e "\n${CYAN}${BOLD}====================================================${RESET}"
    echo -e "${CYAN}${BOLD}🚀 3/4 STARTING SERVICES (BACKEND + FRONTEND)...${RESET}"
    echo -e "${CYAN}${BOLD}====================================================${RESET}"

    # Stop any previous instance
    pkill -f "server:app|python -m server" 2>/dev/null
    pkill -f "vite" 2>/dev/null

    # Launch Backend FastAPI
    echo -e "${BLUE}▶ Starting Backend FastAPI (http://127.0.0.1:8000)...${RESET}"
    (cd backend && uv run python -m server) > "$LOG_FILE" 2>&1 &
    BACKEND_PID=$!

    # Wait for backend health check with progress indicators
    echo -n "  Loading model [waiting for /health]"
    for i in {1..30}; do
        if curl -s http://127.0.0.1:8000/health | grep -q "status"; then
            echo -e " ${GREEN}${BOLD}MODEL LOADED OK!${RESET}"
            break
        fi
        echo -n " ⏳"
        sleep 1
    done

    # Launch Frontend Vite Server
    echo -e "${BLUE}▶ Starting Frontend WebGL (Vite Dev Server)...${RESET}"
    npx vite --port 5173 --host 127.0.0.1 > /dev/null 2>&1 &
    FRONTEND_PID=$!
    sleep 2

    APP_URL="http://127.0.0.1:5173"

    echo -e "\n${GREEN}${BOLD}====================================================${RESET}"
    echo -e "${GREEN}${BOLD}        🎉 Ready to go!${RESET}"
    echo -e "${GREEN}${BOLD}====================================================${RESET}"
    echo -e " ${BOLD}The tool is running at:${RESET}"
    echo -e " ${CYAN}${BOLD}👉 ${APP_URL}${RESET}\n"

    # Open Browser on macOS / OS
    echo -e "${YELLOW}🌐 Opening browser at ${APP_URL}...${RESET}"
    if command -v open &> /dev/null; then
        open "$APP_URL"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$APP_URL"
    fi

    echo -e "\n${MAGENTA}${BOLD}====================================================${RESET}"
    echo -e "${MAGENTA}${BOLD}📜 LIVE BACKEND LOGS (Ctrl+C to exit)${RESET}"
    echo -e "${MAGENTA}${BOLD}====================================================${RESET}\n"

    # Pretty colorized tail log
    tail -f "$LOG_FILE" | sed \
        -e "s/INFO/${GREEN}INFO${RESET}/g" \
        -e "s/WARNING/${YELLOW}WARNING${RESET}/g" \
        -e "s/ERROR/${RED}ERROR${RESET}/g" \
        -e "s/200 OK/${GREEN}200 OK${RESET}/g" \
        -e "s/POST /${CYAN}POST ${RESET}/g" \
        -e "s/GET /${CYAN}GET ${RESET}/g"
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

build_hf_docker() {
    echo -e "${YELLOW}${BOLD}Compiling Hugging Face Spaces Monolithic Docker Image...${RESET}"
    docker build -t vhectorlab-3d:latest .
    echo -e "${GREEN}${BOLD}✅ Docker build complete! Container ready on port 7860.${RESET}"
    read -p "Press Enter to return to menu..."
}

publish_hf_space() {
    echo -e "${YELLOW}${BOLD}--- Hugging Face Spaces Publisher Wizard ---${RESET}"
    read -p "Enter your Hugging Face Space repository ID (e.g. username/vhectorlab-3d): " space_id
    if [ -z "$space_id" ]; then
        echo -e "${RED}Space ID required.${RESET}"
        read -p "Press Enter..."
        return
    fi
    
    echo -e "${CYAN}Building production frontend bundle...${RESET}"
    npm run build
    
    echo -e "${CYAN}Initializing git sync to Hugging Face Hub (https://huggingface.co/spaces/$space_id)...${RESET}"
    git push https://huggingface.co/spaces/$space_id main
    echo -e "${GREEN}${BOLD}✅ Sync complete!${RESET}"
    read -p "Press Enter to return to menu..."
}

stop_services() {
    echo -e "${RED}${BOLD}Stopping background services...${RESET}"
    pkill -f "server:app|python -m server" 2>/dev/null
    pkill -f "vite" 2>/dev/null
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
    echo -ne "${BOLD}Choose an option [0-10]: ${RESET}"
    read choice
    case $choice in
        1)
            deploy_and_start
            ;;
        2)
            echo -e "${GREEN}Starting Bare-metal Backend...${RESET}"
            (cd backend && uv run python -m server) > "$LOG_FILE" 2>&1 &
            echo -e "${GREEN}Backend started in background (Logs: $LOG_FILE)${RESET}"
            read -p "Press Enter..."
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
            (cd backend && uv run pytest -v -s)
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
        0)
            echo -e "${CYAN}${BOLD}Goodbye!${RESET}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid choice.${RESET}"
            sleep 1
            ;;
    esac
done
