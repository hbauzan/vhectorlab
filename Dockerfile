# Monolithic Dockerfile for VHectorLab 3D on Hugging Face Spaces (Port 7860)
# Target hardware: cpu-basic — install PyTorch CPU wheels only (UV_TORCH_BACKEND=cpu).
FROM python:3.10-slim

# Install system dependencies & Node.js
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install uv for Python package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy configuration and package files
COPY package.json package-lock.json ./
COPY backend/pyproject.toml backend/pyproject.toml
COPY backend/README.md backend/README.md

# CPU-only torch for HF cpu-basic (avoids multi-GB NVIDIA wheels)
ENV UV_TORCH_BACKEND=cpu

# Install Node and Python dependencies
RUN npm ci
RUN cd backend && UV_TORCH_BACKEND=cpu uv sync

# Copy source code and vocabulary
COPY . .

# Production frontend bundle (same-origin /api)
ENV VITE_API_BASE_URL=/api
RUN npm run build

# Precompute vocab embeddings so Space cold start skips encoding ~10k tokens
ENV MODEL_NAME=all-mpnet-base-v2
ENV VOCAB_PATH=public/vocab.txt
ENV VOCAB_EMBEDDINGS_PATH=public/vocab_embeddings.npz
ENV SAE_DEVICE=CPU
RUN UV_TORCH_BACKEND=cpu uv run --directory backend python /app/scripts/precompute_vocab_embeddings.py \
    --device CPU \
    --vocab /app/public/vocab.txt \
    --out /app/public/vocab_embeddings.npz \
    --model all-mpnet-base-v2

# Expose Hugging Face Space default port 7860
EXPOSE 7860

# Environment variables for Docker / HF Space mode
ENV HOST=0.0.0.0
ENV PORT=7860
ENV UVICORN_RELOAD=0
ENV MODEL_NAME=all-mpnet-base-v2
ENV VOCAB_PATH=public/vocab.txt
ENV VOCAB_EMBEDDINGS_PATH=public/vocab_embeddings.npz
ENV SAE_DEVICE=CPU

# Entrypoint: FastAPI serving API + static frontend
CMD ["uv", "run", "--directory", "backend", "python", "-m", "server"]
