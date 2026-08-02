"""Top-K Sparse Autoencoder (trained) for Clean/Denoise."""

from backend.sae.sae_model import SAEManager, TopKSAE
from backend.sae.suggest_dims import suggest_sae_dims, suggest_train_schedule
from backend.sae.train_sae import get_optimal_device, train_sae

__all__ = [
    "TopKSAE",
    "SAEManager",
    "train_sae",
    "get_optimal_device",
    "suggest_sae_dims",
    "suggest_train_schedule",
]
