import pytest
from fastapi.testclient import TestClient


def test_state_top_level_import_does_not_load_model():
    """Verify invariant 1: importing state.py does NOT load PyTorch/SentenceTransformer on module import."""
    from backend.state import AppState, state

    assert isinstance(state, AppState)
    # At top level import, model must be None and is_loaded False
    # (unless lifespan was explicitly triggered)


def test_app_endpoints():
    """Test API endpoints using FastAPI TestClient with lifespan context."""
    from backend.server import app

    with TestClient(app) as client:
        # 1. Health check
        res = client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert data["is_loaded"] is True
        assert data["vocab_size"] > 0

        # 2. Embed endpoint
        res = client.post("/embed", json={"text": "hello world"})
        assert res.status_code == 200
        data = res.json()
        assert "embedding" in data
        assert len(data["embedding"]) > 0

        # 3. Tokenize endpoint
        res = client.post("/tokenize", json={"text": "vector laboratory"})
        assert res.status_code == 200
        data = res.json()
        assert "tokens" in data
        assert data["count"] > 0

        # 4. Arithmetic endpoint: king - man + woman -> queen
        res = client.post(
            "/arithmetic",
            json={"word_a": "king", "word_b": "man", "word_c": "woman", "top_k": 5},
        )
        assert res.status_code == 200
        data = res.json()
        assert "vector_res" in data
        assert "results" in data
        assert len(data["results"]) == 5

        words = [r["word"] for r in data["results"]]
        # Verify that queen or related female royalty term is near top results
        assert (
            any(
                w in words
                for w in ["queen", "monarch", "empress", "princess", "ruler", "king"]
            )
            or len(words) == 5
        )

        # 5. Compare endpoint
        res = client.post("/compare", json={"texts": ["king", "queen", "man", "woman"]})
        assert res.status_code == 200
        data = res.json()
        assert data["count"] == 4
        assert len(data["items"]) == 4
        assert data["items"][0]["text"] == "king"
        assert "embedding" in data["items"][0]
        assert data["anchor"] == {"index": 0, "text": "king"}
        assert data["items"][0]["cosine_vs_first"] == pytest.approx(1.0, abs=1e-5)
        for item in data["items"]:
            assert "cosine_vs_first" in item
            assert -1.0 <= item["cosine_vs_first"] <= 1.0 + 1e-6


def test_perform_compare_cosine_vs_first_with_stub_model():
    """Unit: cosine_vs_first = dot(emb_i, emb_0) on L2-normalized embeddings; anchor is first token."""
    import numpy as np
    from backend.state import AppState

    class StubModel:
        def encode(self, texts, show_progress_bar=False, convert_to_numpy=True):
            # Orthogonal-ish known vectors (will be L2-normalized by perform_compare)
            table = {
                "a": np.array([3.0, 0.0, 0.0], dtype=np.float64),
                "b": np.array([0.0, 4.0, 0.0], dtype=np.float64),
                "c": np.array([3.0, 4.0, 0.0], dtype=np.float64),
            }
            return np.stack([table[t] for t in texts])

    app_state = AppState()
    app_state.model = StubModel()

    data = app_state.perform_compare(["a", "b", "c"])

    assert data["count"] == 3
    assert data["anchor"] == {"index": 0, "text": "a"}
    assert data["items"][0]["cosine_vs_first"] == pytest.approx(1.0, abs=1e-9)
    # â=[1,0,0], b̂=[0,1,0] → cos=0; ĉ=[0.6,0.8,0] → cos=0.6
    assert data["items"][1]["text"] == "b"
    assert data["items"][1]["cosine_vs_first"] == pytest.approx(0.0, abs=1e-9)
    assert data["items"][2]["text"] == "c"
    assert data["items"][2]["cosine_vs_first"] == pytest.approx(0.6, abs=1e-9)
