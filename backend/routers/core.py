"""
Core API Router for VectorLab 3D.
Provides /health, /embed, /tokenize, and /arithmetic endpoints.
"""

from typing import Any

from backend.state import state
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()


class EmbedRequest(BaseModel):
    text: str = Field(..., description="Text to compute embedding for")


class TokenizeRequest(BaseModel):
    text: str = Field(..., description="Text to tokenize")


class ArithmeticRequest(BaseModel):
    word_a: str = Field(
        ..., json_schema_extra={"example": "king"}, description="Positive base word (A)"
    )
    word_b: str = Field(
        ..., json_schema_extra={"example": "man"}, description="Subtracted word (B)"
    )
    word_c: str = Field(
        ..., json_schema_extra={"example": "woman"}, description="Added word (C)"
    )
    top_k: int = Field(
        default=10, ge=1, le=100, description="Number of nearest neighbors to return"
    )


class CompareRequest(BaseModel):
    texts: list[str] = Field(
        ...,
        description="List of texts/tokens to compute batch embeddings for (1 to 1024 items)",
    )


@router.get("/health")
def health_check() -> dict[str, Any]:
    return {
        "status": "ok" if state.is_loaded else "uninitialized",
        "model": state.model_name,
        "vocab_size": len(state.vocab_words),
        "is_loaded": state.is_loaded,
    }


@router.post("/embed")
def embed_text(req: EmbedRequest) -> dict[str, Any]:
    if not state.is_loaded or state.model is None:
        raise HTTPException(status_code=503, detail="Backend model is not loaded yet")
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    vec = state.compute_embedding(req.text)
    return {"text": req.text, "embedding": vec.tolist(), "dimension": len(vec)}


@router.post("/tokenize")
def tokenize_text(req: TokenizeRequest) -> dict[str, Any]:
    if not state.is_loaded or state.model is None:
        raise HTTPException(status_code=503, detail="Backend model is not loaded yet")

    # SentenceTransformer uses underlying Hugging Face tokenizer
    tokenizer = getattr(state.model, "tokenizer", None)
    if tokenizer is not None:
        tokens = tokenizer.tokenize(req.text)
        input_ids = tokenizer.encode(req.text)
    else:
        # Fallback space tokenization
        tokens = req.text.split()
        input_ids = list(range(len(tokens)))

    return {
        "text": req.text,
        "tokens": tokens,
        "input_ids": input_ids,
        "count": len(tokens),
    }


@router.post("/arithmetic")
def perform_arithmetic(req: ArithmeticRequest) -> dict[str, Any]:
    if not state.is_loaded or state.model is None:
        raise HTTPException(status_code=503, detail="Backend model is not loaded yet")

    if not (req.word_a.strip() and req.word_b.strip() and req.word_c.strip()):
        raise HTTPException(
            status_code=400, detail="Words A, B, and C must not be empty"
        )

    try:
        res = state.perform_arithmetic(req.word_a, req.word_b, req.word_c, req.top_k)
        return res
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/compare")
def perform_compare(req: CompareRequest) -> dict[str, Any]:
    if not state.is_loaded or state.model is None:
        raise HTTPException(status_code=503, detail="Backend model is not loaded yet")

    if not req.texts:
        raise HTTPException(status_code=400, detail="Texts list cannot be empty")

    try:
        return state.perform_compare(req.texts)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))

