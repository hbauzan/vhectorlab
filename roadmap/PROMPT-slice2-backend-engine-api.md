# EXECUTION PROMPT: SLICE 2 — BACKEND ENGINE API & STATE PERSISTENCE

> **Agent Role:** Principal Software Architect & High-Density Logic Copilot in VHectorLab 3D.  
> **Mandatory Skill:** `.agents/skills/dev-protocol/SKILL.md` (strictly adhere to all rules: `verification-first.md`, `lessons-learned.md`, `code-design.md`, `git-workflow.md`).  
> **Core Principle:** *"Before believing, execute. Before answering, measure the premise. Data kills narrative."* Zero fluff, zero complacencies, minimal friction, 100% deterministic, evidence-based.  
> **Language:** English.  
> **Pre-Flight Discrepancy Rule:** If any assertion in Phase 0 or empirical finding on the machine disagrees with this specification, **STOP IMMEDIATELY, DO NOT EDIT OR COMMIT CODE, AND REPORT THE EXACT DISCREPANCY TO THE USER TO RE-DRAFT**.

---

## PHASE 0: MANDATORY PRE-FLIGHT AUDIT (PRE-CHECK ASSUMPTIONS)

Before creating or editing any code file, run the following empirical verifications against the actual machine and repository.

### 1. Regression Floor & Version Audit
Execute:
```bash
# In repo root:
npx vitest run
# In backend/ directory:
uv run pytest
```
* **Required Verified Assertion:**
  - Frontend: `55 test files passed, 426 tests passed (100%)`.
  - Backend: `145 tests passed (100%), 2 warnings in ~26s` (including the 5 tests from `test_structural_noise.py`).
  - All manifests are at version `4.0.0`: `manifest.json`, `package.json`, `backend/pyproject.toml`, `backend/server.py`, `src/ui/Navbar.js`.
* *Stop Rule:* If any existing test fails, stop immediately.

### 2. Physical Tensor & Detection Ground Truth Audit
Execute:
```bash
uv run --directory backend python -c "
import numpy as np
from structural_noise import detect_structural_noise

npz = np.load('../public/vocab_embeddings.npz', allow_pickle=True)
embs = npz['embeddings']
assert embs.shape == (10338, 1024), f'Unexpected shape {embs.shape}'
assert str(npz['model_name']) == 'BAAI/bge-m3', f'Unexpected model {npz[\"model_name\"]}'

profile = detect_structural_noise(embs, model_name='BAAI/bge-m3')
assert profile.saturated_indices == (38, 58, 65, 80, 297, 376, 386, 404, 549, 577, 780), f'Bad saturated: {profile.saturated_indices}'
assert profile.flat_indices == (329, 616), f'Bad flat: {profile.flat_indices}'
assert profile.noise_indices == (38, 58, 65, 80, 297, 329, 376, 386, 404, 549, 577, 616, 780), f'Bad noise: {profile.noise_indices}'
assert profile.energy_ratio == 0.1980, f'Bad energy ratio: {profile.energy_ratio}'
assert profile.cosine_delta == 0.1152, f'Bad cosine delta: {profile.cosine_delta}'
print('Pre-flight tensor audit PASS: 13 noise coordinates confirmed.')
"
```
* *Stop Rule:* If isolated coordinates or metrics deviate, stop immediately.

### 3. Git Branch Pre-Condition
Execute:
```bash
git status
```
* Ensure you are cleanly on `feat/v4-structural-noise-engine-manager` with commit `9426d3c` (Slice 1) as HEAD.

---

## PHASE 1: ARCHITECTURE, SCHEMAS & API CONTRACTS

Implement the FastAPI engine router in [`backend/routers/engine.py`](file:///Users/hbauzan/treepwood/vhectorlab/backend/routers/engine.py), mount it in [`backend/server.py`](file:///Users/hbauzan/treepwood/vhectorlab/backend/server.py), and integrate state management in [`backend/state.py`](file:///Users/hbauzan/treepwood/vhectorlab/backend/state.py).

### 1.1. Path & Filename Sanitation
* Noise profiles persist on disk at: `backend/artifacts/noise_profiles/{model_safe_id}.json`.
* Helper:
  ```python
  def get_model_safe_filename(model_name: str) -> str:
      """Sanitize model identifier into a clean filesystem filename."""
      return model_name.strip().replace("/", "_").replace("\\", "_").replace(" ", "_") + ".json"
  ```
  Example: `"BAAI/bge-m3"` $\to$ `"BAAI_bge-m3.json"`.
* Ensure `backend/artifacts/noise_profiles` directory is created if missing (`exist_ok=True`).

### 1.2. AppState Integration ([`backend/state.py`](file:///Users/hbauzan/treepwood/vhectorlab/backend/state.py))
* Add attribute to `AppState.__init__`:
  ```python
  self.noise_profile: ModelNoiseProfile | None = None
  ```
* In `AppState.load_model_and_vocab`:
  Ensure `self.noise_profile = None` is reset on new model loads or resets.

### 1.3. Router Endpoints ([`backend/routers/engine.py`](file:///Users/hbauzan/treepwood/vhectorlab/backend/routers/engine.py))
Create `router = APIRouter(tags=["Engine"])`.

#### Endpoint 1: `GET /api/engine/status`
* **Response Model (Pydantic / Typed Dict):**
  ```python
  class EngineStatusResponse(BaseModel):
      model_name: str
      model_profile: str | None
      embedding_dim: int | None
      accelerator: str
      is_loaded: bool
      has_cached_profile: bool
      vocab_size: int
  ```
* **Behavior:**
  - `model_name`: `state.model_name`
  - `model_profile`: `state.model_profile`
  - `embedding_dim`: `state.embedding_dim`
  - `accelerator`: `state.device`
  - `is_loaded`: `state.is_loaded`
  - `vocab_size`: `len(state.vocab_words)` or `(state.vocab_embeddings.shape[0] if state.vocab_embeddings is not None else 0)`
  - `has_cached_profile`: `True` if `state.noise_profile is not None` OR if the file `backend/artifacts/noise_profiles/{model_safe_id}.json` exists on disk; `False` otherwise.
  - Returns HTTP 200.

#### Endpoint 2: `POST /api/engine/detect-structural-noise`
* **Request Body (Optional / Defaults):**
  ```python
  class DetectNoiseRequest(BaseModel):
      force_recompute: bool = False
      sat_threshold_z: float = 3.0
      flat_threshold_sigma: float = 0.010
  ```
* **Response Model:**
  ```python
  class ModelNoiseProfileResponse(BaseModel):
      model_name: str
      embedding_dim: int
      noise_indices: list[int]
      saturated_indices: list[int]
      flat_indices: list[int]
      energy_ratio: float
      cosine_delta: float
      timestamp_utc: str
  ```
* **Behavior:**
  1. Determine `model_name = state.model_name`.
  2. If `not request.force_recompute`:
     - If `state.noise_profile is not None`: return `state.noise_profile`.
     - Check disk cache `backend/artifacts/noise_profiles/{safe_id}.json`. If exists:
       - Load, populate `state.noise_profile`, and return.
  3. If compute required:
     - Check if `state.vocab_embeddings` is loaded and $N \ge 2$:
       - Run `detect_structural_noise(state.vocab_embeddings, model_name=model_name, sat_threshold_z=request.sat_threshold_z, flat_threshold_sigma=request.flat_threshold_sigma)`.
     - Else if `state.model` is available:
       - Check if vocab file exists (`public/vocab_en_es.txt` or `public/vocab.txt`).
       - Read up to 500 words, encode using `encode_texts(state.model, words, state.selection)`.
       - Run `detect_structural_noise` on encoded embeddings.
     - Else:
       - Raise `HTTPException(status_code=503, detail="No embeddings or active model available for noise detection.")`.
  4. Cache the resulting profile:
     - In RAM: `state.noise_profile = profile`
     - On disk: Save JSON to `backend/artifacts/noise_profiles/{safe_id}.json`.
  5. Return HTTP 200 with `ModelNoiseProfileResponse`.

#### Endpoint 3: `GET /api/engine/noise-profile`
* **Behavior:**
  1. Check in RAM: `state.noise_profile`.
  2. If None, check disk: `backend/artifacts/noise_profiles/{safe_id}.json`. If found, load to RAM and return.
  3. If still None: raise `HTTPException(status_code=404, detail="No cached noise profile for active model.")`.
  4. Return HTTP 200 with `ModelNoiseProfileResponse`.

### 1.4. Server Integration ([`backend/server.py`](file:///Users/hbauzan/treepwood/vhectorlab/backend/server.py))
Mount the router following established pattern:
```python
from backend.routers.engine import router as engine_router

app.include_router(engine_router, prefix="/api")
app.include_router(engine_router)  # Direct mirror for local convenience
```

---

## PHASE 2: STRICT TDD PROTOCOL (TESTS FIRST)

Write [`backend/tests/test_engine_router.py`](file:///Users/hbauzan/treepwood/vhectorlab/backend/tests/test_engine_router.py) BEFORE implementing the router logic.

### Required Test Cases:
1. `test_engine_status_endpoint()`:
   - Use `TestClient(app)` with stubbed or live `state`.
   - Assert `client.get("/api/engine/status")` returns HTTP 200.
   - Assert response contains `model_name`, `embedding_dim`, `accelerator`, `has_cached_profile`, and `is_loaded`.
2. `test_engine_detect_structural_noise_computation_and_cache(tmp_path, monkeypatch)`:
   - Configure profile artifacts directory to `tmp_path / "noise_profiles"`.
   - Setup synthetic $(100, 64)$ embedding matrix in `state.vocab_embeddings`.
   - Call `POST /api/engine/detect-structural-noise`.
   - Assert HTTP 200 with valid `ModelNoiseProfileResponse`.
   - Assert JSON file was written into `tmp_path / "noise_profiles"`.
   - Call `POST /api/engine/detect-structural-noise` again without `force_recompute`:
     - Assert it returns cached data in $<15$ ms.
3. `test_engine_noise_profile_get_and_404(tmp_path, monkeypatch)`:
   - Before detection/cache: `GET /api/engine/noise-profile` returns HTTP 404.
   - After profile is cached: `GET /api/engine/noise-profile` returns HTTP 200 with matching payload.
4. `test_engine_detect_fail_closed_unloaded_state(monkeypatch)`:
   - Set `state.vocab_embeddings = None` and `state.model = None`.
   - Call `POST /api/engine/detect-structural-noise`.
   - Assert returns HTTP 503 without unhandled exception or crash.
5. `test_engine_detect_real_npz_latency()`:
   - With real `vocab_embeddings.npz` loaded, call `POST /api/engine/detect-structural-noise?force_recompute=true`.
   - Assert execution time is $<150$ ms.
   - Assert isolated coordinates match 13 coordinates: `[38, 58, 65, 80, 297, 329, 376, 386, 404, 549, 577, 616, 780]`.

---

## PHASE 3: VERIFICATION & AUDIT CHECKLIST

Run the full verification suite after implementing:

1. **Python Unit Tests:**
   ```bash
   uv run --directory backend pytest backend/tests/test_engine_router.py -v
   uv run --directory backend pytest
   ```
   *Requirement:* All 150+ tests must pass with 0 errors.
2. **Frontend Regression Suite:**
   ```bash
   npx vitest run
   ```
   *Requirement:* All 426+ tests must pass with 0 errors.
3. **Linter / Formatter Check:**
   ```bash
   uv run --directory backend ruff check .
   uv run --directory backend ruff format --check .
   ```

---

## PHASE 4: APPROVAL GATE & HANDOFF

Do NOT push to origin or merge to main. Report the auditable numbers:
1. Measured latency (ms) of `POST /api/engine/detect-structural-noise` (cold vs cached).
2. Exact test counts in pytest and vitest.
3. Await human "OK" to commit and proceed to Slice 3.
