"""Auto-scale Top-K SAE width + train schedule for small session scopes."""

from __future__ import annotations


def suggest_sae_dims(
    n_vectors: int,
    input_dim: int,
    requested_hidden: int = 8192,
    requested_k: int = 32,
) -> tuple[int, int]:
    """
    Cap hidden_dim / k so a small Compare batch does not train an 8192-wide dictionary.

    Returns (hidden_dim, k) with hidden_dim <= requested_hidden and k <= min(requested_k, hidden_dim).
    """
    if n_vectors < 2:
        raise ValueError("Need at least 2 embedding vectors to train SAE")
    if input_dim < 1:
        raise ValueError("input_dim must be positive")
    if requested_hidden < 16:
        raise ValueError("requested_hidden must be >= 16")
    if requested_k < 1:
        raise ValueError("requested_k must be >= 1")

    # Keep dictionary proportional to sample count (aggressive for interactive UX).
    if n_vectors < 32:
        by_n = max(32, n_vectors * 3)
    elif n_vectors < 64:
        by_n = max(32, n_vectors * 4)
    elif n_vectors < 256:
        by_n = max(64, n_vectors * 5)
    else:
        by_n = max(128, n_vectors * 8)

    by_d = max(input_dim, min(requested_hidden, input_dim * 2))

    if n_vectors >= max(512, requested_hidden // 4):
        hidden = requested_hidden
    else:
        hidden = min(requested_hidden, max(32, min(by_n, by_d)))

    if hidden >= 32:
        hidden = max(32, (hidden // 32) * 32)
    hidden = max(16, min(int(hidden), requested_hidden))

    k = min(requested_k, hidden)
    if hidden >= 4:
        k = min(k, max(1, hidden // 4))
    k = max(1, int(k))
    return hidden, k


def suggest_train_schedule(
    n_vectors: int,
    hidden_dim: int,
    requested_epochs: int = 50,
    requested_batch_size: int = 64,
) -> tuple[int, int]:
    """
    Cap epochs / prefer full-batch for interactive session SAE training.

    Returns (epochs, batch_size).
    """
    if n_vectors < 2:
        raise ValueError("Need at least 2 embedding vectors to train SAE")

    # Smaller dictionaries converge in fewer passes; keep UX snappy.
    if hidden_dim <= 128:
        epochs = min(requested_epochs, 12)
    elif hidden_dim <= 512:
        epochs = min(requested_epochs, 20)
    elif n_vectors < 64:
        epochs = min(requested_epochs, 25)
    else:
        epochs = requested_epochs
    epochs = max(1, int(epochs))

    # Full-batch when N fits — avoids DataLoader overhead on small scopes.
    if n_vectors <= 512:
        batch_size = n_vectors
    else:
        batch_size = min(int(requested_batch_size), n_vectors)
        batch_size = max(8, batch_size)

    return epochs, batch_size
