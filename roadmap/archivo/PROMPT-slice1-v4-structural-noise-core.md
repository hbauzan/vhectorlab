# EXECUTION PROMPT: SLICE 1 — V4.0.0 PROMOTION & STRUCTURAL NOISE CORE MATH

> **Agent Role:** Principal Software Architect & High-Density Logic Copilot in VHectorLab 3D.  
> **Mandatory Skill:** `.agents/skills/dev-protocol/SKILL.md` (strictly adhere to all rules).  
> **Core Principle:** *"Before believing, execute. Before answering, measure the premise. Data kills narrative."* Zero fluff, zero complacencies, verification-first.  
> **Language:** English.

---

## PHASE 0: MANDATORY PRE-FLIGHT AUDIT (PRE-CHECK ASSUMPTIONS)

Before creating or editing any code file, run the following empirical verifications against the actual machine and repository. If you encounter ANY discrepancy with the assertions recorded below, **STOP IMMEDIATELY AND REPORT THE DISCREPANCY TO THE USER TO RESOLVE OR RE-DRAFT**:

### 1. Regression Floor Audit
Execute:
```bash
# In repo root:
npx vitest run
# In backend/ directory:
uv run pytest
```
* **Prior Verified Assertion:** 
  - Frontend: `55 test files passed, 426 tests passed (100%)`.
  - Backend: `140 passed, 2 warnings in ~27s (100%)`.
* *Stop Rule:* If any existing test fails, stop immediately.

### 2. Physical Tensor Ground Truth Audit
Execute:
```bash
uv run --directory backend python -c "
import numpy as np
npz = np.load('../public/vocab_embeddings.npz', allow_pickle=True)
embs = npz['embeddings']
assert embs.shape == (10338, 1024), f'Unexpected shape {embs.shape}'
assert str(npz['model_name']) == 'BAAI/bge-m3', f'Unexpected model {npz[\"model_name\"]}'
abs_means = np.mean(np.abs(embs), axis=0)
top_energy = np.argsort(abs_means)[::-1][:3]
assert list(top_energy) == [386, 297, 780], f'Unexpected top energy dims: {top_energy}'
print('Pre-flight tensor audit PASS: 10338x1024 BGE-M3 verified.')
"
```
* **Prior Verified Assertion:**
  - `Dim 386`: Mean absolute energy = `0.2867` (Rank #1 / 1024).
  - `Dim 297`: Mean absolute energy = `0.1738` (Rank #2 / 1024).
  - `Dim 780`: Mean absolute energy = `0.1670` (Rank #3 / 1024).
  - `Dim 329` and `Dim 616`: Energy Rank #1023 and #1024 (lowest variance in model).
* *Stop Rule:* If top 3 indices do not match $[386, 297, 780]$, stop immediately.

### 3. Git Branch Pre-Condition
Execute:
```bash
git checkout -b feat/v4-structural-noise-engine-manager
```
* Ensure you are branching cleanly from `main`.

---

## PHASE 1: ATOMIC VERSION PROMOTION TO V4.0.0

Per user directive, **the very first change of this task promotes the codebase to version `4.0.0` (MAJOR RELEASE)**.

Update all version manifests atomically:
1. [`manifest.json`](file:///Users/hbauzan/treepwood/vhectorlab/manifest.json): `"version": "4.0.0"`
2. [`package.json`](file:///Users/hbauzan/treepwood/vhectorlab/package.json): `"version": "4.0.0"`
3. [`backend/pyproject.toml`](file:///Users/hbauzan/treepwood/vhectorlab/backend/pyproject.toml): `version = "4.0.0"`
4. [`backend/server.py`](file:///Users/hbauzan/treepwood/vhectorlab/backend/server.py): `version="4.0.0"`
5. [`src/ui/Navbar.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/ui/Navbar.js): `export const APP_VERSION = 'v4.0.0';`
6. [`tests/navbarVersion.test.js`](file:///Users/hbauzan/treepwood/vhectorlab/tests/navbarVersion.test.js): Update expected assertions from `'v3.4.0'` to `'v4.0.0'`.
7. [`CHANGELOG.md`](file:///Users/hbauzan/treepwood/vhectorlab/CHANGELOG.md): Initialize entry:
   ```markdown
   ## [4.0.0] - 2026-10-26

   ### Added
   - Universal Structural Noise & Outlier Dimensions detection engine (`backend/structural_noise.py`).
   - MagicWB AGA 1993 3D chiseled visual identity.
   ```

Verify version synchronization:
```bash
npx vitest run tests/navbarVersion.test.js
```
Must pass 100% green before proceeding to Phase 2.

---

## PHASE 2: MODULE SPECIFICATION & CONTRACTS

Implement the standalone, pure, deterministic module [`backend/structural_noise.py`](file:///Users/hbauzan/treepwood/vhectorlab/backend/structural_noise.py).

### 2.1. Typed Dataclass Contracts
```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence
import numpy as np

@dataclass(frozen=True, slots=True)
class ModelNoiseProfile:
    """Immutable audit profile of isolated structural noise coordinates."""
    model_name: str
    embedding_dim: int
    noise_indices: tuple[int, ...]
    saturated_indices: tuple[int, ...]
    flat_indices: tuple[int, ...]
    energy_ratio: float      # Sum of L2^2 in noise dims / Total L2^2 norm
    cosine_delta: float      # Mean pairwise raw cosine - Mean pairwise pruned cosine
    timestamp_utc: str
```

### 2.2. Mathematical Detection Algorithm
Implement:
```python
def detect_structural_noise(
    embeddings: np.ndarray,
    model_name: str,
    sat_threshold_z: float = 3.0,
    flat_threshold_sigma: float = 0.010,
    random_seed: int = 42,
) -> ModelNoiseProfile:
```

#### Exact Mathematical Steps:
1. **Input Validation & Fail-Closed Guard:**
   - Input must be a 2D float array with shape $(N, D)$. If $N < 2$, return an empty noise profile (`noise_indices = ()`, `energy_ratio = 0.0`, `cosine_delta = 0.0`) safely without raising unhandled exceptions or computing NaNs.
2. **Criterion A (Universal Saturation Outliers):**
   - For each coordinate $d \in \{0, \dots, D-1\}$, compute mean absolute energy:
     $$E_d = \frac{1}{N}\sum_{i=1}^N |x_{i,d}|$$
   - Compute coordinate energy mean $\bar{E} = \text{mean}(E)$ and standard deviation $\sigma_E = \text{std}(E)$.
   - If $\sigma_E \le 10^{-12}$, no outlier exists. Otherwise:
     $$Z_E(d) = \frac{E_d - \bar{E}}{\sigma_E}$$
   - Any dimension with $Z_E(d) \ge \text{sat\_threshold\_z}$ is classified as **Saturated Outlier**.
3. **Criterion B (Thematic Indifference / Flat Channels):**
   - For each coordinate $d$, compute standard deviation across samples:
     $$\sigma_d = \sqrt{\frac{1}{N}\sum_{i=1}^N (x_{i,d} - \mu_d)^2}$$
   - If $\sigma_d \le \text{flat\_threshold\_sigma}$ OR $\sigma_d \le 0.35 \cdot \text{mean}(\sigma)$, classify as **Flat Channel**.
4. **Consolidated Noise Set:**
   - `saturated_indices = tuple(sorted(saturated_set))`
   - `flat_indices = tuple(sorted(flat_set - saturated_set))`
   - `noise_indices = tuple(sorted(saturated_set | flat_set))`
5. **Concentration & Anisotropy Metrics:**
   - Total Energy Ratio:
     $$\text{energy\_ratio} = \frac{\sum_{i=1}^N \sum_{d \in \mathcal{D}_{\text{noise}}} x_{i,d}^2}{\sum_{i=1}^N \sum_{d=0}^{D-1} x_{i,d}^2}$$
     Rounded to 4 decimal places.
   - Anisotropic Baseline Cosine Drop:
     - Sample $\min(N, 500)$ vectors deterministically using `np.random.RandomState(random_seed)`.
     - Compute mean pairwise cosine in RAW space: $\bar{\rho}_{\text{raw}}$.
     - Zero out `noise_indices`, renormalize $L_2$, and compute mean pairwise cosine in PRUNED space: $\bar{\rho}_{\text{pruned}}$.
     - $\text{cosine\_delta} = \text{round}(\bar{\rho}_{\text{raw}} - \bar{\rho}_{\text{pruned}}, 4)$.

---

## PHASE 3: STRICT TDD PROTOCOL (TESTS FIRST)

Write [`backend/tests/test_structural_noise.py`](file:///Users/hbauzan/treepwood/vhectorlab/backend/tests/test_structural_noise.py) BEFORE writing the implementation.

### Required Test Cases:
1. `test_detect_noise_synthetic_spikes_and_flats()`:
   - Create synthetic matrix $X \sim \mathcal{N}(0, 0.02^2)$ of shape $(200, 100)$.
   - Inject $+0.50$ into Dim 12 and $-0.40$ into Dim 45 ($Z_E > 8$).
   - Set Dim 88 to constant $0.00$ ($\sigma = 0$).
   - Assert `saturated_indices == (12, 45)`.
   - Assert `flat_indices == (88,)`.
   - Assert `noise_indices == (12, 45, 88)`.
2. `test_detect_noise_fail_closed_degenerate()`:
   - Single vector ($N=1$): returns empty profile without crashing.
   - Zero-variance matrix (all elements equal 0.05): returns valid profile without division by zero.
3. `test_detect_noise_real_bge_m3_npz()`:
   - Load `public/vocab_embeddings.npz` (10,338 words).
   - Run `detect_structural_noise(embs, model_name="BAAI/bge-m3")`.
   - Assert `386 in profile.saturated_indices`.
   - Assert `297 in profile.saturated_indices`.
   - Assert `780 in profile.saturated_indices`.
   - Assert `616 in profile.flat_indices`.
   - Assert `329 in profile.flat_indices`.
   - Assert `profile.saturated_indices == (38, 58, 65, 80, 297, 376, 386, 404, 549, 577, 780)`.
   - Assert `profile.flat_indices == (329, 616)`.
   - Assert `profile.noise_indices == (38, 58, 65, 80, 297, 329, 376, 386, 404, 549, 577, 616, 780)`.
   - Assert `0.190 <= profile.energy_ratio <= 0.210` (Empirical measured baseline: 19.80%, exact 0.1980).
   - Assert `profile.cosine_delta > 0.05` (Empirical measured baseline: 0.1152).
4. `test_detect_noise_all_mpnet_base_v2()`:
   - Load or mock `all-mpnet-base-v2` vectors.
   - Assert dead dimensions $\{34, 555, 688, 756\}$ are isolated under flat channels.
5. `test_noise_profile_immutability()`:
   - Verify `profile` is frozen dataclass with `slots=True`.
   - Attempting attribute mutation raises `FrozenInstanceError`.

---

## PHASE 4: VERIFICATION & AUDIT CHECKLIST

Run the full verification suite after implementing:

1. **Python Unit Tests:**
   ```bash
   uv run --directory backend pytest backend/tests/test_structural_noise.py -v
   uv run --directory backend pytest
   ```
   *Requirement:* All 140+ tests must pass with 0 errors.
2. **Frontend Version & Regression Suite:**
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

## PHASE 5: APPROVAL GATE & HANDOFF

Do NOT push to origin or merge to main. Report the auditable numbers:
1. Exact commit hash of the bump to `v4.0.0`.
2. Number of tests run in pytest and vitest.
3. Empirical numbers output by `test_detect_noise_real_bge_m3_npz` (`energy_ratio`, `cosine_delta`, and isolated indices).
4. Await human "OK" to proceed to Slice 2.
