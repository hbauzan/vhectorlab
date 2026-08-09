"""
Global App State for VHectorLab 3D.
Manages lazy-loaded SentenceTransformer model and pre-computed vocabulary embeddings in RAM.
"""

import logging
import os
from pathlib import Path
from typing import Any

import numpy as np
from backend.model_catalog import (
    ModelSelection,
    build_model,
    encode_texts,
    resolve_selection_from_env,
)
from backend.vocab_embeddings import (
    load_vocab_embeddings_npz as _load_vocab_cache,
)
from backend.vocab_embeddings import (
    npz_compatible_with_selection,
    save_vocab_embeddings_npz,
)

logger = logging.getLogger(__name__)


def _resolve_path(vocab_path: str) -> Path | None:
    path = Path(vocab_path)
    if path.exists():
        return path
    alt_path = Path(__file__).resolve().parent.parent / vocab_path
    if alt_path.exists():
        return alt_path
    return None


def load_vocab_embeddings_npz(
    npz_path: Path,
) -> tuple[list[str], np.ndarray, str | None]:
    """
    Load precomputed vocab embeddings NPZ.
    Returns (words, embeddings float32 L2-normalized, model_name or None).
    """
    cache = _load_vocab_cache(npz_path)
    return cache.words, cache.embeddings, cache.model_name


class AppState:
    def __init__(self):
        self.model = None
        self.model_name: str = "all-mpnet-base-v2"
        self.model_profile: str | None = None
        self.truncate_dim: int | None = None
        self.embedding_dim: int | None = None
        self.selection: ModelSelection | None = None
        self.vocab_words: list[str] = []
        self.vocab_embeddings: np.ndarray | None = None  # Normalized (N, D)
        self.is_loaded: bool = False
        self.device: str = "cpu"

    def _apply_selection(self, selection: ModelSelection) -> None:
        self.selection = selection
        self.model_name = selection.hub_id
        self.model_profile = selection.profile
        self.truncate_dim = selection.truncate_dim

    def _set_embedding_dim_from_model(self) -> None:
        dim: int | None = None
        if self.model is not None and hasattr(
            self.model, "get_sentence_embedding_dimension"
        ):
            try:
                dim = int(self.model.get_sentence_embedding_dimension())
            except Exception:  # noqa: BLE001
                dim = None
        if dim is None and self.vocab_embeddings is not None:
            dim = int(self.vocab_embeddings.shape[1])
        if dim is not None and self.truncate_dim is not None:
            dim = min(dim, self.truncate_dim)
        self.embedding_dim = dim

    def load_model_and_vocab(
        self,
        model_name: str | None = None,
        vocab_path: str = "public/vocab.txt",
        vocab_embeddings_path: str | None = None,
        device_env: str | None = None,
        *,
        selection: ModelSelection | None = None,
        model_profile: str | None = None,
        truncate_dim: int | None = None,
    ) -> None:
        """
        Lazy loads PyTorch SentenceTransformer model and vocabulary embeddings.
        Prefer VOCAB_EMBEDDINGS_PATH NPZ when present (Docker / HF Space fast path).
        MUST ONLY be called inside lifespan context or explicit initialization, NEVER at top level.
        """
        if self.is_loaded:
            logger.info("AppState is already loaded.")
            return

        from backend.device import get_optimal_device

        if selection is None:
            selection = resolve_selection_from_env(
                profile=model_profile,
                model_name=model_name,
                truncate_dim=truncate_dim,
            )
        self._apply_selection(selection)

        env_device = (
            device_env if device_env is not None else os.getenv("SAE_DEVICE", "AUTO")
        )
        self.device = get_optimal_device(env_device)

        logger.info(
            "Loading SentenceTransformer model: %s (profile=%s truncate_dim=%s device=%s)...",
            selection.hub_id,
            selection.profile,
            selection.truncate_dim,
            self.device,
        )
        self.model = build_model(selection, device=self.device)

        embeddings_env = (
            vocab_embeddings_path
            if vocab_embeddings_path is not None
            else os.getenv("VOCAB_EMBEDDINGS_PATH", "public/vocab_embeddings.npz")
        )
        npz_path = _resolve_path(embeddings_env) if embeddings_env else None
        # Keep unresolved path for write-back after auto-rebuild
        npz_write_path: Path | None = None
        if embeddings_env:
            candidate = Path(embeddings_env)
            npz_write_path = (
                candidate
                if candidate.is_absolute()
                else Path(__file__).resolve().parent.parent / candidate
            )

        if npz_path is not None:
            try:
                cache = _load_vocab_cache(npz_path)
                ok, reason = npz_compatible_with_selection(cache, selection)
                if ok:
                    self.vocab_words = cache.words
                    self.vocab_embeddings = cache.embeddings
                    self.is_loaded = True
                    self._set_embedding_dim_from_model()
                    if self.embedding_dim is None:
                        self.embedding_dim = int(cache.embeddings.shape[1])
                    logger.info(
                        "AppState loading complete (vocab from NPZ: %s words, dim=%s, %s).",
                        len(cache.words),
                        self.embedding_dim,
                        npz_path,
                    )
                    return
                logger.warning(
                    "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n"
                    "VOCAB NPZ MISMATCH — auto-rebuilding embeddings from vocab text.\n"
                    "  npz=%s\n"
                    "  reason=%s\n"
                    "  selection hub=%s truncate_dim=%s\n"
                    "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
                    npz_path,
                    reason,
                    selection.hub_id,
                    selection.truncate_dim,
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "Failed to load vocab NPZ %s (%s); encoding from text.",
                    npz_path,
                    exc,
                )

        path = _resolve_path(vocab_path)
        if path is None:
            logger.warning("Vocab file not found at %s, using empty vocab.", vocab_path)
            self.vocab_words = []
            self.vocab_embeddings = None
            self.is_loaded = True
            self._set_embedding_dim_from_model()
            return

        with open(path, encoding="utf-8") as f:
            words = [line.strip().lower() for line in f if line.strip()]

        self.vocab_words = words
        logger.info("Encoding %s vocabulary words into embeddings...", len(words))

        if words:
            self.vocab_embeddings = encode_texts(
                self.model, words, selection, show_progress_bar=False
            )
            if npz_write_path is not None:
                try:
                    save_vocab_embeddings_npz(
                        npz_write_path,
                        words=words,
                        embeddings=self.vocab_embeddings,
                        model_name=selection.hub_id,
                        truncate_dim=selection.truncate_dim,
                    )
                    logger.warning(
                        "Wrote rebuilt vocab NPZ to %s (shape=%s).",
                        npz_write_path,
                        self.vocab_embeddings.shape,
                    )
                except Exception as exc:  # noqa: BLE001
                    logger.warning(
                        "Could not write rebuilt NPZ %s: %s", npz_write_path, exc
                    )
        else:
            self.vocab_embeddings = None

        self.is_loaded = True
        self._set_embedding_dim_from_model()
        logger.info("AppState loading complete (embedding_dim=%s).", self.embedding_dim)

    def compute_embedding(self, text: str) -> np.ndarray:
        """Computes L2-normalized embedding for a single text query."""
        if self.model is None or self.selection is None:
            raise RuntimeError(
                "Model is not loaded. Ensure lifespan initialized AppState."
            )
        return encode_texts(self.model, text, self.selection)

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

        top1_vec = None
        top1_word = ""
        if results and self.vocab_embeddings is not None:
            top1_idx = results[0]["token_id"]
            top1_word = results[0]["word"]
            top1_vec = self.vocab_embeddings[top1_idx].tolist()

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
                "vec_top1": top1_vec
                if top1_vec is not None
                else normalized_res.tolist(),
            },
            "top1_word": top1_word
            if top1_word
            else (results[0]["word"] if results else ""),
            "results": results,
        }

    def perform_compare(self, texts: list[str]) -> dict[str, Any]:
        """
        Computes L2-normalized embeddings for a sequence of 1 to 1024 token/text items.
        Each item includes cosine_vs_first = dot(emb_i, emb_0) (embeddings already L2-normalized).
        """
        if self.model is None or self.selection is None:
            raise RuntimeError("AppState not initialized with model.")

        cleaned = [t.strip() for t in texts if t.strip()][:1024]
        if not cleaned:
            return {"count": 0, "anchor": None, "items": []}

        normalized = encode_texts(self.model, cleaned, self.selection)

        anchor_vec = normalized[0]
        items = []
        for idx, text in enumerate(cleaned):
            cosine = float(np.dot(normalized[idx], anchor_vec))
            items.append(
                {
                    "id": f"tok_{idx}",
                    "index": idx,
                    "text": text,
                    "embedding": normalized[idx].tolist(),
                    "cosine_vs_first": cosine,
                }
            )

        return {
            "count": len(items),
            "anchor": {"index": 0, "text": cleaned[0]},
            "items": items,
        }


# Global single state instance (lazy loaded)
state = AppState()
