# Monolithic Dockerfile for VectorLab 3D on Hugging Face Spaces (Port 7860)
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

# Install Node and Python dependencies
RUN npm ci
RUN cd backend && uv sync

# Copy source code and vocabulary
COPY . .

# Pre-build WebGL Frontend bundle into dist/
RUN npm run build

# Expose Hugging Face Space default port 7860
EXPOSE 7860

# Environment variables for Docker mode
ENV HOST=0.0.0.0
ENV PORT=7860
ENV MODEL_NAME=all-mpnet-base-v2
ENV VOCAB_PATH=public/vocab.txt

# Entrypoint to launch FastAPI backend serving API & static frontend files
CMD ["uv", "run", "--directory", "backend", "python", "-m", "server"]
