#!/bin/bash
# ==========================================
# VECTORLAB 3D - CONTROL PANEL & CLI SETUP
# ==========================================

LOG_FILE="vectorlab_dev.log"

show_menu() {
    clear
    echo "=========================================="
    echo "       🌐 VECTORLAB 3D - CONTROL PANEL"
    echo "=========================================="
    echo "1. Start Development Mode (Vite + FastAPI Hot-Reload)"
    echo "2. Start Bare-metal Backend (FastAPI on 127.0.0.1:8000)"
    echo "3. Run System Heartbeat (Health Check & Arithmetic)"
    echo "4. Run Frontend Unit Tests (Vitest)"
    echo "5. Run Backend Unit Tests (pytest)"
    echo "6. Manage Vocabulary (Load Custom vocab.txt or Generate N Words)"
    echo "7. Build Hugging Face Space Docker Image (Port 7860)"
    echo "8. Publish Hugging Face Space (Interactive HF Hub Wizard)"
    echo "9. View Logs"
    echo "10. Stop / Clean Services"
    echo "0. Exit"
    echo "=========================================="
}

manage_vocab() {
    echo ""
    echo "--- Manage Vocabulary ---"
    echo "1) Load Custom vocab.txt file"
    echo "2) Generate new vocab.txt with custom word count"
    read -p "Select option [1-2]: " vopt
    case $vopt in
        1)
            read -p "Enter path to your custom vocab.txt: " custom_path
            if [ -f "$custom_path" ]; then
                cp "$custom_path" public/vocab.txt
                echo "✅ Successfully copied $custom_path to public/vocab.txt"
            else
                echo "❌ Error: File $custom_path does not exist."
            fi
            ;;
        2)
            read -p "Enter target word count (default 10000): " count
            count=${count:-10000}
            python3 scripts/generate_vocab.py --count "$count"
            ;;
        *)
            echo "Invalid option."
            ;;
    esac
    read -p "Press Enter to return to menu..."
}

build_hf_docker() {
    echo "Compiling Hugging Face Spaces Monolithic Docker Image..."
    docker build -t vectorlab-3d:latest .
    echo "✅ Docker build complete! Container ready on port 7860."
    read -p "Press Enter to return to menu..."
}

publish_hf_space() {
    echo "--- Hugging Face Spaces Publisher Wizard ---"
    read -p "Enter your Hugging Face Space repository ID (e.g. username/vectorlab-3d): " space_id
    if [ -z "$space_id" ]; then
        echo "Space ID required."
        read -p "Press Enter..."
        return
    fi
    
    echo "Building production frontend bundle..."
    npm run build
    
    echo "Initializing git sync to Hugging Face Hub (https://huggingface.co/spaces/$space_id)..."
    git push https://huggingface.co/spaces/$space_id main
    echo "✅ Sync complete!"
    read -p "Press Enter to return to menu..."
}

stop_services() {
    echo "Stopping background services..."
    pkill -f "uvicorn backend.server:app" 2>/dev/null
    pkill -f "vite" 2>/dev/null
    echo "✅ Services stopped."
    read -p "Press Enter to return to menu..."
}

while true; do
    show_menu
    read -p "Choose an option [0-10]: " choice
    case $choice in
        1)
            echo "Starting Development Mode..."
            (cd backend && uv run python -m server) > "$LOG_FILE" 2>&1 &
            npm run dev
            ;;
        2)
            echo "Starting Bare-metal Backend..."
            (cd backend && uv run python -m server) > "$LOG_FILE" 2>&1 &
            echo "Backend started in background (Logs: $LOG_FILE)"
            read -p "Press Enter..."
            ;;
        3)
            python3 backend/perform_tests.py
            read -p "Press Enter..."
            ;;
        4)
            npm test
            read -p "Press Enter..."
            ;;
        5)
            (cd backend && uv run pytest)
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
            if [ -f "$LOG_FILE" ]; then
                tail -n 40 "$LOG_FILE"
            else
                echo "No log file found."
            fi
            read -p "Press Enter..."
            ;;
        10)
            stop_services
            ;;
        0)
            echo "Goodbye!"
            exit 0
            ;;
        *)
            echo "Invalid choice."
            sleep 1
            ;;
    esac
done
