# Monolithic Dockerfile for VHectorLab 3D on Hugging Face Spaces (Port 7860)
# Target hardware: cpu-basic (2 vCPU / 16 GB / 50 GB) — Arctic-m ~1.2 GB fits.
# Space profile matches local-full so Shared noise / Compare match the Mac lab.
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
COPY backend/pyproject.toml backend/uv.lock backend/README.md ./backend/

# CPU-only torch on Linux via [tool.uv.sources] → pytorch-cpu (not UV_TORCH_BACKEND / uv sync).
RUN npm ci
RUN cd backend && uv sync --frozen

# Copy source code and vocabulary
COPY . .

# Production frontend bundle (same-origin /api)
ENV VITE_API_BASE_URL=/api
RUN npm run build

# Match local-full: Arctic-m-v2 Matryoshka @ 256 + EN∪ES vocab (precompute at image build).
ENV MODEL_PROFILE=local-full
ENV MODEL_NAME=Snowflake/snowflake-arctic-embed-m-v2.0
ENV TRUNCATE_DIM=256
ENV VOCAB_PATH=public/vocab_en_es.txt
ENV VOCAB_EMBEDDINGS_PATH=public/vocab_embeddings.npz
ENV SAE_DEVICE=CPU
RUN uv run --directory backend --frozen python /app/scripts/precompute_vocab_embeddings.py \
    --device CPU \
    --profile local-full \
    --truncate-dim 256 \
    --vocab /app/public/vocab_en_es.txt \
    --out /app/public/vocab_embeddings.npz \
    --model Snowflake/snowflake-arctic-embed-m-v2.0

# Expose Hugging Face Space default port 7860
EXPOSE 7860

# Environment variables for Docker / HF Space mode
ENV HOST=0.0.0.0
ENV PORT=7860
ENV UVICORN_RELOAD=0
ENV MODEL_PROFILE=local-full
ENV MODEL_NAME=Snowflake/snowflake-arctic-embed-m-v2.0
ENV TRUNCATE_DIM=256
ENV VOCAB_PATH=public/vocab_en_es.txt
ENV VOCAB_EMBEDDINGS_PATH=public/vocab_embeddings.npz
ENV SAE_DEVICE=CPU

# Entrypoint: FastAPI serving API + static frontend
CMD ["uv", "run", "--directory", "backend", "--frozen", "python", "-m", "server"]
