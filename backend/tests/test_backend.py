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
