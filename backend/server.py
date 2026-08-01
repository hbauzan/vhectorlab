"""
FastAPI Server Entrypoint for VectorLab 3D.
Handles application lifespan, lazy-loading models, CORS configuration, and router binding.
"""

import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Ensure parent directory is in sys.path so 'backend.*' package imports resolve correctly
_root_dir = str(Path(__file__).resolve().parent.parent)
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)

from backend.routers.core import router as core_router
from backend.state import state
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vectorlab")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing VectorLab 3D backend lifespan...")
    model_name = os.getenv("MODEL_NAME", "all-mpnet-base-v2")
    vocab_path = os.getenv("VOCAB_PATH", "public/vocab.txt")

    # Lazy load model and vocabulary into AppState
    try:
        state.load_model_and_vocab(model_name=model_name, vocab_path=vocab_path)
    except Exception as e:  # noqa: BLE001
        logger.error(f"Error loading model/vocab in lifespan: {e}")

    yield

    logger.info("Shutting down VectorLab 3D backend...")


app = FastAPI(
    title="VectorLab 3D API",
    description="Backend API for 3D Vector Arithmetic & Semantic Embedding Visualizer",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS Policy Alignment: allow_origins=["*"] combined with allow_credentials=False
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(core_router, prefix="/api")
app.include_router(core_router)  # Also expose without /api prefix for convenience

# Mount static frontend files if dist/ exists (Docker / Production mode)
from pathlib import Path

from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

dist_path = Path(__file__).resolve().parent.parent / "dist"
if dist_path.exists():
    logger.info(f"Serving static frontend files from {dist_path}")
    app.mount("/assets", StaticFiles(directory=dist_path / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = dist_path / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(dist_path / "index.html")


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("backend.server:app", host=host, port=port, reload=True)
