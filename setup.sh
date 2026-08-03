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

show_menu() {
    clear
    echo -e "${CYAN}${BOLD}====================================================${RESET}"
    echo -e "${CYAN}${BOLD}       🌐 VHectorLab 3D - CONTROL PANEL${RESET}"
    echo -e "${CYAN}${BOLD}====================================================${RESET}"
    echo -e " ${GREEN}${BOLD}1. 🚀 Desplegar / Iniciar Herramienta${RESET} ${DIM}(Verifica, Testea, Inicia y Abre Browser)${RESET}"
    echo -e " ${GREEN}2.${RESET} ${BOLD}Start Bare-metal Backend${RESET} ${DIM}(FastAPI en 127.0.0.1:8000)${RESET}"
    echo -e " ${BLUE}3.${RESET} ${BOLD}Run System Heartbeat${RESET} ${DIM}(Health Check & Arithmetic)${RESET}"
    echo -e " ${BLUE}4.${RESET} ${BOLD}Run Frontend Unit Tests${RESET} ${DIM}(Vitest)${RESET}"
    echo -e " ${BLUE}5.${RESET} ${BOLD}Run Backend Unit Tests${RESET} ${DIM}(pytest)${RESET}"
    echo -e " ${MAGENTA}6.${RESET} ${BOLD}Manage Vocabulary${RESET} ${DIM}(Cargar propio vocab.txt / N Palabras)${RESET}"
    echo -e " ${YELLOW}7.${RESET} ${BOLD}Build Hugging Face Space Docker Image${RESET} ${DIM}(Puerto 7860)${RESET}"
    echo -e " ${YELLOW}8.${RESET} ${BOLD}Publish Hugging Face Space${RESET} ${DIM}(Wizard interactivo HF Hub)${RESET}"
    echo -e " ${CYAN}9.${RESET} ${BOLD}View Logs${RESET} ${DIM}(Ver logs en vivo)${RESET}"
    echo -e " ${RED}10.${RESET} ${BOLD}Stop / Clean Services${RESET}"
    echo -e " ${DIM}0. Exit${RESET}"
    echo -e "${CYAN}${BOLD}====================================================${RESET}"
}

deploy_and_start() {
    echo -e "\n${CYAN}${BOLD}====================================================${RESET}"
    echo -e "${CYAN}${BOLD}🔍 1/4 VERIFICANDO ENTORNO Y REQUISITOS...${RESET}"
    echo -e "${CYAN}${BOLD}====================================================${RESET}"

    # 1. Check Python / uv
    if ! command -v uv &> /dev/null; then
        echo -e "${RED}❌ Error: 'uv' no está instalado. Por favor instalalo antes de continuar.${RESET}"
        read -p "Presioná Enter..."
        return
    fi
    echo -e "  ${GREEN}✓ Gestor Python 'uv' detectado.${RESET}"

    # 2. Check Node / npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ Error: 'npm' no está instalado. Por favor instalalo antes de continuar.${RESET}"
        read -p "Presioná Enter..."
        return
    fi
    echo -e "  ${GREEN}✓ Gestor Node 'npm' detectado.${RESET}"

    # 3. Check vocabulary file
    if [ ! -f "public/vocab.txt" ]; then
        echo -e "${YELLOW}⚠️ Vocabulario no detectado en public/vocab.txt. Generando 10,000 palabras por defecto...${RESET}"
        python3 scripts/generate_vocab.py --count 10000
    fi
    echo -e "  ${GREEN}✓ Archivo public/vocab.txt OK ($(wc -l < public/vocab.txt | tr -d ' ') palabras).${RESET}"

    echo -e "\n${CYAN}${BOLD}====================================================${RESET}"
    echo -e "${CYAN}${BOLD}🧪 2/4 EJECUTANDO SUITE COMPLETA DE TESTS (CON PROGRESO)...${RESET}"
    echo -e "${CYAN}${BOLD}====================================================${RESET}"

    # Run Backend pytest with verbose streaming output
    echo -e "${BLUE}${BOLD}▶ [1/2] Ejecutando pruebas unitarias de backend (pytest)...${RESET}"
    echo -e "${DIM}Cargando modelo PyTorch SentenceTransformer en memoria...${RESET}"
    (cd backend && uv run pytest -v -s)
    if [ $? -ne 0 ]; then
        echo -e "${RED}${BOLD}❌ ERROR: Las pruebas de backend fallaron. Corrige los errores antes de desplegar.${RESET}"
        read -p "Presioná Enter..."
        return
    fi
    echo -e "  ${GREEN}${BOLD}✓ Pruebas de Backend 100% EN VERDE.${RESET}"

    # Run Frontend vitest with verbose output
    echo -e "\n${BLUE}${BOLD}▶ [2/2] Ejecutando pruebas unitarias de matemática 3D (Vitest)...${RESET}"
    npx vitest run --reporter=verbose
    if [ $? -ne 0 ]; then
        echo -e "${RED}${BOLD}❌ ERROR: Las pruebas de frontend fallaron. Corrige los errores antes de desplegar.${RESET}"
        read -p "Presioná Enter..."
        return
    fi
    echo -e "  ${GREEN}${BOLD}✓ Pruebas de Frontend 100% EN VERDE.${RESET}"

    echo -e "\n${CYAN}${BOLD}====================================================${RESET}"
    echo -e "${CYAN}${BOLD}🚀 3/4 INICIANDO SERVICIOS (BACKEND + FRONTEND)...${RESET}"
    echo -e "${CYAN}${BOLD}====================================================${RESET}"

    # Stop any previous instance
    pkill -f "server:app|python -m server" 2>/dev/null
    pkill -f "vite" 2>/dev/null

    # Launch Backend FastAPI
    echo -e "${BLUE}▶ Arrancando Backend FastAPI (http://127.0.0.1:8000)...${RESET}"
    (cd backend && uv run python -m server) > "$LOG_FILE" 2>&1 &
    BACKEND_PID=$!

    # Wait for backend health check with progress indicators
    echo -n "  Cargando modelo en backend [esperando respuesta /health]"
    for i in {1..30}; do
        if curl -s http://127.0.0.1:8000/health | grep -q "status"; then
            echo -e " ${GREEN}${BOLD}¡MODELO CARGADO OK!${RESET}"
            break
        fi
        echo -n " ⏳"
        sleep 1
    done

    # Launch Frontend Vite Server
    echo -e "${BLUE}▶ Arrancando Frontend WebGL (Vite Dev Server)...${RESET}"
    npx vite --port 5173 --host 127.0.0.1 > /dev/null 2>&1 &
    FRONTEND_PID=$!
    sleep 2

    APP_URL="http://127.0.0.1:5173"

    echo -e "\n${GREEN}${BOLD}====================================================${RESET}"
    echo -e "${GREEN}${BOLD}        🎉 vamo arriba nomá' !!!${RESET}"
    echo -e "${GREEN}${BOLD}====================================================${RESET}"
    echo -e " ${BOLD}La herramienta está lista y corriendo en:${RESET}"
    echo -e " ${CYAN}${BOLD}👉 ${APP_URL}${RESET}\n"

    # Open Browser on macOS / OS
    echo -e "${YELLOW}🌐 Abriendo navegador en ${APP_URL}...${RESET}"
    if command -v open &> /dev/null; then
        open "$APP_URL"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$APP_URL"
    fi

    echo -e "\n${MAGENTA}${BOLD}====================================================${RESET}"
    echo -e "${MAGENTA}${BOLD}📜 MOSTRANDO LOGS EN VIVO DEL BACKEND (Presioná Ctrl+C para salir)${RESET}"
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
