# EXECUTION PROMPT: SLICE 4 — REAL-TIME PRUNING SHIELD IN METRICS & SPECTRAL QUORUM

> **Agent Role:** Principal Software Architect & High-Density Math/UI Copilot in VHectorLab 3D.  
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
  - Frontend: `56 test files passed, 442 tests passed (100%)`.
  - Backend: `153 tests passed (100%), 2 warnings in ~28s`.
  - All manifests are at version `4.0.0`: `manifest.json`, `package.json`, `backend/pyproject.toml`, `backend/server.py`, `src/ui/Navbar.js`.
* *Stop Rule:* If any existing test fails, stop immediately.

### 2. Physical Tensor Noise Coordinates & API Ground Truth Audit
Execute:
```bash
uv run --directory backend python -c "
from fastapi.testclient import TestClient
from server import app

with TestClient(app) as client:
    res = client.get('/api/engine/status')
    assert res.status_code == 200
    assert res.json()['is_loaded'] is True

    prof_res = client.post('/api/engine/detect-structural-noise', json={'force_recompute': False})
    assert prof_res.status_code == 200
    prof = prof_res.json()
    assert prof['noise_indices'] == [38, 58, 65, 80, 297, 329, 376, 386, 404, 549, 577, 616, 780]
    assert prof['energy_ratio'] == 0.198
    assert prof['cosine_delta'] == 0.1152
    print('Pre-flight Engine Ground Truth PASS: 13 noise coordinates verified.')
"
```
* *Stop Rule:* If any endpoint check fails or indices deviate, stop immediately.

### 3. Git Branch Pre-Condition
Execute:
```bash
git status
```
* Ensure you are cleanly on `feat/v4-structural-noise-engine-manager` with commit `f377988` (Slice 3) as HEAD.

---

## PHASE 1: MATHEMATICAL SPECIFICATION & CONTRACTS

Implement real-time in-memory subspace cosine re-calculation and Spectral Quorum noise shielding across:
- [`src/ui/compareCosine.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/ui/compareCosine.js)
- [`src/visualizer/spectralQuorum.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/visualizer/spectralQuorum.js)
- [`src/ui/ComparePanel.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/ui/ComparePanel.js)
- [`src/main.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/main.js)

### 1.1. Subspace Pruning Operator in [`src/ui/compareCosine.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/ui/compareCosine.js)
Let $\mathbf{u}, \mathbf{v} \in \mathbb{R}^D$ and let $\mathcal{D}_{\text{noise}} \subset \{0, \dots, D-1\}$ be a set of noise coordinate indices.

#### Pure Functions:
1. `pruneVector(v, noiseIndices)`:
   - Returns a `Float32Array` of length $D$ where coordinates $d \in \mathcal{D}_{\text{noise}}$ are set to $0.0$, and all other coordinates remain identical to $v[d]$.
   - **Crucial Invariant:** Must NEVER mutate the input vector $v$.
2. `prunedL2Normalize(v, noiseIndices)`:
   - Computes $v^* = \text{pruneVector}(v, \mathcal{D}_{\text{noise}})$.
   - Computes $L_2$ norm: $S = \sqrt{\sum_{d=0}^{D-1} (v^*[d])^2}$.
   - If $S \le 10^{-12}$, returns `null`.
   - Otherwise returns unit vector $\hat{\mathbf{v}} = \frac{v^*}{S}$.
3. `prunedCosineDot(a, b, noiseIndices)`:
   - Computes unit vectors $\hat{\mathbf{a}} = \text{prunedL2Normalize}(a, \mathcal{D}_{\text{noise}})$ and $\hat{\mathbf{b}} = \text{prunedL2Normalize}(b, \mathcal{D}_{\text{noise}})$.
   - If either is null, returns $0.0$.
   - Returns dot product: $\sum_{d=0}^{D-1} \hat{a}[d] \cdot \hat{b}[d]$.
4. `recomputeCompareAnchorScores(items, options = {})`:
   - Update options parameter: `{ noiseIndices?: number[] | Set<number>, shieldEnabled?: boolean }`.
   - If `shieldEnabled && noiseIndices && noiseIndices.length > 0` (or `size > 0`):
     - For each item $i$:
       - `raw_cosine`: `cosineDot(item.embedding, anchorEmb)` (or 1.0 if $i=0$).
       - `pruned_cosine`: `prunedCosineDot(item.embedding, anchorEmb, noiseIndices)` (or 1.0 if $i=0$).
       - `cosine_vs_first`: `pruned_cosine` (the active metric driving sorting and display).
       - `raw_cosine_vs_first`: `raw_cosine`.
       - `cosine_delta`: `round(pruned_cosine - raw_cosine, 4)`.
   - If shield is disabled or noise set is empty:
     - Existing behavior preserved: `cosine_vs_first = raw_cosine`, `cosine_delta = null`.
5. Group Centroid Subspace Pruning:
   - In `groupCentroid(embeddings, noiseIndices = null)`:
     - When `noiseIndices` is provided, members are normalized using `prunedL2Normalize`, averaged, and re-normalized.
   - In `buildGroupCosineRows(items, options = {})`:
     - Accepts `{ noiseIndices, shieldEnabled }` and computes group-level `cosine_delta` accordingly.

### 1.2. Spectral Quorum Noise Shield in [`src/visualizer/spectralQuorum.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/visualizer/spectralQuorum.js)
In `computeSpectralQuorumMetrics(items, options = {})`:
- Accept option: `options.noiseIndices: number[] | Set<number> | null`.
- If provided, normalize to a fast lookup `Set<number>`.
- In dimension loop ($d \in \{0, \dots, D-1\}$):
  - If $d \in \text{noiseSet}$:
    - Set `minSd = 0.0`.
    - Mark signature: `isNoise: true`, `noisePruned: true`.
    - Exclude dimension $d$ from group ranking / Quorum admission (`isTrigo` MUST be `false` for any noise dimension).
- Candidate pool size becomes $D - |\mathcal{D}_{\text{noise}}|$, protecting Spectral Quorum from ghost common-mode DC noise.

### 1.3. Compare Panel Delta Badge Rendering in [`src/ui/ComparePanel.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/ui/ComparePanel.js)
1. Add state methods to `ComparePanel`:
   - `setNoiseShieldConfig({ enabled, noiseIndices })`:
     - Updates internal config.
     - If `this.items` is loaded, recomputes scores via `recomputeCompareAnchorScores(this.items, { noiseIndices, shieldEnabled })` and updates DOM in-situ without re-calling the backend or causing flicker.
2. In `renderCosineList`:
   - When `item.cosine_delta` is a finite number and `index > 0`:
     - Render delta badge next to the score:
       ```html
       <span class="score">${score.toFixed(4)}</span>
       <span class="score-delta ${item.cosine_delta < 0 ? 'drop' : 'rise'}" title="Cosine change under Outlier Shield">
         (${item.cosine_delta >= 0 ? '+' : ''}${item.cosine_delta.toFixed(4)})
       </span>
       ```
   - In [`src/theme/chrome.css`](file:///Users/hbauzan/treepwood/vhectorlab/src/theme/chrome.css), add styling for `.score-delta`:
     ```css
     .score-delta {
       font-size: 11px;
       font-weight: bold;
       margin-left: 4px;
       letter-spacing: 0.3px;
     }
     .score-delta.drop {
       color: var(--badge-sat, #FFA997);
     }
     .score-delta.rise {
       color: #00E5FF;
     }
     ```

### 1.4. Application Wiring in [`src/main.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/main.js)
1. Wire `EngineManager` callbacks in `main.js`:
   ```javascript
   this.engineManager = new EngineManager(this.appContainer, this.provider, {
     onShieldToggle: (enabled) => {
       this.handleNoiseShieldToggle(enabled);
     },
     onDualPathToggle: (enabled) => {
       this.handleDualPathToggle(enabled);
     },
     onAuditComplete: (profile) => {
       this.handleNoiseAuditComplete(profile);
     },
   });
   ```
2. Methods:
   - `handleNoiseShieldToggle(enabled)`:
     - Updates `ComparePanel` with `{ enabled, noiseIndices: this.activeNoiseProfile?.noise_indices || [] }`.
     - Updates internal `spectralQuorum` options with `noiseIndices` when shield is enabled.
     - Calls `this.refreshRender()` to update 3D scene / Spectral Quorum overlay.
   - `handleNoiseAuditComplete(profile)`:
     - Stores `this.activeNoiseProfile = profile`.
     - If shield is currently enabled, updates `ComparePanel` with the newly isolated coordinates.
3. On application boot:
   - `EngineManager.init()` fetches `getEngineStatus()` and `getEngineNoiseProfile()`. If a cached profile exists, populates `this.activeNoiseProfile` and syncs with `ComparePanel`.

---

## PHASE 2: STRICT TDD PROTOCOL (TESTS FIRST)

Write [`tests/compareCosineNoiseShield.test.js`](file:///Users/hbauzan/treepwood/vhectorlab/tests/compareCosineNoiseShield.test.js) BEFORE writing the implementation.

### Required Test Cases:
1. `test_subspace_cosine_prunes_artificial_offset()`:
   - Create two 64-D vectors $u, v \sim \mathcal{N}(0, 0.05^2)$.
   - Inject $+0.80$ DC offset into dimension 10 on both vectors.
   - Raw cosine is high ($\approx 0.70$).
   - Pruning dimension 10 via `prunedCosineDot(u, v, [10])` reduces cosine to semantic baseline ($\approx 0.0 \pm 0.15$).
   - Delta `pruned - raw` is negative ($\approx -0.70$).
2. `test_prune_operator_never_mutates_source_vectors()`:
   - Pass arrays $u, v$ into `prunedCosineDot` and `prunedL2Normalize`.
   - Assert $u[10] == 0.80$ and $v[10] == 0.80$ strictly unmutated.
3. `test_recompute_anchor_scores_with_shield()`:
   - Pass 3 compare items with DC noise in dims `[5, 12]`.
   - Run `recomputeCompareAnchorScores(items, { noiseIndices: [5, 12], shieldEnabled: true })`.
   - Assert index 0 (REF) has `cosine_vs_first == 1.0` and no delta.
   - Assert indices 1 and 2 receive `cosine_vs_first` equal to the pruned cosine, and `cosine_delta` matching `pruned - raw`.
4. `test_spectral_quorum_noise_shield_exclusion()`:
   - Setup 2 groups with known separation in dim 20, but huge DC spike in dim 386.
   - Run `computeSpectralQuorumMetrics(items, { noiseIndices: [386] })`.
   - Assert dim 386 signature has `isNoise == true` and `separability == 0.0`.
   - Assert dim 386 is NEVER included in `quorumDims` or marked as `isTrigo`.
   - Assert valid candidates count is $D - 1$.
5. `test_compare_panel_delta_badge_dom()`:
   - Instantiate `ComparePanel` in mock DOM.
   - Call `setNoiseShieldConfig({ enabled: true, noiseIndices: [386, 297] })`.
   - Render items.
   - Assert `.score-delta` element exists for non-anchor items with correct text e.g. `(-0.0861)`.

---

## PHASE 3: VERIFICATION & AUDIT CHECKLIST

Run the full verification suite after implementing:

1. **Frontend Vitest Suite:**
   ```bash
   npx vitest run tests/compareCosineNoiseShield.test.js
   npx vitest run
   ```
   *Requirement:* All 57+ files and 450+ tests must pass with 0 errors.
2. **Backend Regression Suite:**
   ```bash
   uv run --directory backend pytest
   ```
   *Requirement:* All 153 tests must pass with 0 errors.
3. **Linter / Formatter Check:**
   ```bash
   npx vitest run
   ```

---

## PHASE 4: APPROVAL GATE & HANDOFF

Do NOT push to origin or merge to main. Report the auditable numbers:
1. Exact count of tests in Vitest (`tests/compareCosineNoiseShield.test.js` and total).
2. Measured cosine drop ($\Delta$) on a test vector pair under `bge-m3` noise coordinates.
3. Await human "OK" to commit and proceed to Slice 5.
