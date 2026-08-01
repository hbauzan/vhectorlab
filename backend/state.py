"""
Global App State for VectorLab 3D.
Manages lazy-loaded SentenceTransformer model and pre-computed vocabulary embeddings in RAM.
"""

import logging
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


class AppState:
    def __init__(self):
        self.model = None
        self.model_name: str = "all-mpnet-base-v2"
        self.vocab_words: list[str] = []
        self.vocab_embeddings: np.ndarray | None = None  # Normalized (N, D)
        self.is_loaded: bool = False

    def load_model_and_vocab(
        self,
        model_name: str = "all-mpnet-base-v2",
        vocab_path: str = "public/vocab.txt",
    ) -> None:
        """
        Lazy loads PyTorch SentenceTransformer model and computes normalized vocabulary embeddings.
        MUST ONLY be called inside lifespan context or explicit initialization, NEVER at top level.
        """
        if self.is_loaded:
            logger.info("AppState is already loaded.")
            return

        logger.info(f"Loading SentenceTransformer model: {model_name}...")
        from sentence_transformers import SentenceTransformer

        self.model_name = model_name
        self.model = SentenceTransformer(model_name)

        # Load vocab words
        path = Path(vocab_path)
        if not path.exists():
            # Fallback to root or default location if relative path differs
            alt_path = Path(__file__).resolve().parent.parent / vocab_path
            if alt_path.exists():
                path = alt_path
            else:
                logger.warning(
                    f"Vocab file not found at {vocab_path}, using empty vocab."
                )
                self.vocab_words = []
                self.vocab_embeddings = None
                self.is_loaded = True
                return

        with open(path, "r", encoding="utf-8") as f:
            words = [line.strip().lower() for line in f if line.strip()]

        self.vocab_words = words
        logger.info(f"Encoding {len(words)} vocabulary words into embeddings...")

        if words:
            raw_embeddings = self.model.encode(
                words, show_progress_bar=False, convert_to_numpy=True
            )
            # L2 Normalize for cosine similarity via dot product: Sim(A, B) = A_norm . B_norm^T
            norms = np.linalg.norm(raw_embeddings, axis=1, keepdims=True)
            norms[norms == 0] = 1e-9
            self.vocab_embeddings = raw_embeddings / norms
        else:
            self.vocab_embeddings = None

        self.is_loaded = True
        logger.info("AppState loading complete.")

    def compute_embedding(self, text: str) -> np.ndarray:
        """Computes L2-normalized embedding for a single text query."""
        if self.model is None:
            raise RuntimeError(
                "Model is not loaded. Ensure lifespan initialized AppState."
            )
        raw = self.model.encode(text, convert_to_numpy=True)
        norm = np.linalg.norm(raw)
        if norm == 0:
            norm = 1e-9
        return raw / norm

    def perform_arithmetic(
        self, word_a: str, word_b: str, word_c: str, top_k: int = 10
    ) -> dict[str, Any]:
        """
        Computes V_res = V_A - V_B + V_C and finds top_k nearest vocabulary words by cosine similarity.
        """
        if self.model is None or self.vocab_embeddings is None:
            raise RuntimeError("AppState not initialized with model and vocabulary.")

        vec_a = self.compute_embedding(word_a)
        vec_b = self.compute_embedding(word_b)
        vec_c = self.compute_embedding(word_c)

        res_vec = vec_a - vec_b + vec_c
        res_norm = np.linalg.norm(res_vec)
        if res_norm == 0:
            res_norm = 1e-9
        normalized_res = res_vec / res_norm

        # Cosine similarity against all vocab words: (1, D) @ (D, N) -> (1, N)
        similarities = np.dot(self.vocab_embeddings, normalized_res)

        # Words to exclude from top_k results (inputs)
        exclude_set = {
            word_a.lower().strip(),
            word_b.lower().strip(),
            word_c.lower().strip(),
        }

        # Sort indices descending
        sorted_indices = np.argsort(similarities)[::-1]

        results = []
        for idx in sorted_indices:
            word = self.vocab_words[idx]
            if word.lower() in exclude_set:
                continue
            results.append(
                {"word": word, "score": float(similarities[idx]), "token_id": int(idx)}
            )
            if len(results) >= top_k:
                break

        return {
            "inputs": {
                "word_a": word_a,
                "word_b": word_b,
                "word_c": word_c,
            },
            "vector_res": normalized_res.tolist(),
            "components": {
                "vec_a": vec_a.tolist(),
                "vec_b": vec_b.tolist(),
                "vec_c": vec_c.tolist(),
            },
            "results": results,
        }


# Global single state instance (lazy loaded)
state = AppState()
