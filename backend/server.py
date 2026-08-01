"""
FastAPI Server Entrypoint for VectorLab 3D.
Handles application lifespan, lazy-loading models, CORS configuration, and router binding.
"""

import logging
import os
from contextlib import asynccontextmanager

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

if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("backend.server:app", host=host, port=port, reload=True)
