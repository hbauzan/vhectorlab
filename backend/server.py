"""
FastAPI Server Entrypoint for VHectorLab 3D.
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
from backend.routers.sae import router as sae_router
from backend.state import state
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vhectorlab")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing VHectorLab 3D backend lifespan...")
    model_name = os.getenv("MODEL_NAME", "all-mpnet-base-v2")
    vocab_path = os.getenv("VOCAB_PATH", "public/vocab.txt")
    vocab_embeddings_path = os.getenv(
        "VOCAB_EMBEDDINGS_PATH", "public/vocab_embeddings.npz"
    )

    # Lazy load model and vocabulary into AppState
    try:
        state.load_model_and_vocab(
            model_name=model_name,
            vocab_path=vocab_path,
            vocab_embeddings_path=vocab_embeddings_path,
        )
    except Exception as e:  # noqa: BLE001
        logger.error(f"Error loading model/vocab in lifespan: {e}")

    yield

    logger.info("Shutting down VHectorLab 3D backend...")


app = FastAPI(
    title="VHectorLab 3D API",
    description="Backend API for 3D Vector Arithmetic & Semantic Embedding Visualizer",
    version="2.4.1",
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
app.include_router(sae_router, prefix="/api")
app.include_router(core_router)  # Also expose without /api prefix for convenience
app.include_router(sae_router)

# Mount static frontend files if dist/ exists (Docker / Production mode)
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.static_dist import resolve_dist_file

dist_path = Path(__file__).resolve().parent.parent / "dist"
if dist_path.exists():
    logger.info(f"Serving static frontend files from {dist_path}")
    app.mount("/assets", StaticFiles(directory=dist_path / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        return FileResponse(resolve_dist_file(dist_path, full_path))


def _want_reload(host: str) -> bool:
    """Local bare-metal defaults to reload; Docker/HF (0.0.0.0 or UVICORN_RELOAD=0) does not."""
    env = os.getenv("UVICORN_RELOAD")
    if env is not None:
        return env.strip().lower() in ("1", "true", "yes")
    return host in ("127.0.0.1", "localhost")


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    reload = _want_reload(host)
    logger.info("Starting uvicorn host=%s port=%s reload=%s", host, port, reload)
    uvicorn.run("backend.server:app", host=host, port=port, reload=reload)
