# EXECUTION PROMPT: SLICE 3 — FRONTEND ENGINE MANAGER & MAGICWB AGA 3D BEVELS

> **Agent Role:** Principal Software Architect & High-Density UI/WebGL Copilot in VHectorLab 3D.  
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
  - Backend: `153 tests passed (100%), 2 warnings in ~26s` (including the 8 tests from `test_engine_router.py`).
  - All manifests are at version `4.0.0`: `manifest.json`, `package.json`, `backend/pyproject.toml`, `backend/server.py`, `src/ui/Navbar.js`.
* *Stop Rule:* If any existing test fails, stop immediately.

### 2. Backend Engine API Ground Truth Audit
Execute:
```bash
uv run --directory backend python -c "
from fastapi.testclient import TestClient
from server import app

# Enter lifespan context to initialize AppState from .env / NPZ
with TestClient(app) as client:
    # 1. Check status endpoint
    status_res = client.get('/api/engine/status')
    assert status_res.status_code == 200, f'Bad status code: {status_res.status_code}'
    status = status_res.json()
    assert status['model_name'] == 'BAAI/bge-m3'
    assert status['embedding_dim'] == 1024
    assert status['is_loaded'] is True
    assert 'accelerator' in status

    # 2. Check detect endpoint
    detect_res = client.post('/api/engine/detect-structural-noise', json={'force_recompute': False})
    assert detect_res.status_code == 200, f'Bad detect code: {detect_res.status_code}'
    profile = detect_res.json()
    assert profile['noise_indices'] == [38, 58, 65, 80, 297, 329, 376, 386, 404, 549, 577, 616, 780]
    assert profile['saturated_indices'] == [38, 58, 65, 80, 297, 376, 386, 404, 549, 577, 780]
    assert profile['flat_indices'] == [329, 616]
    assert profile['energy_ratio'] == 0.198
    assert profile['cosine_delta'] == 0.1152

    # 3. Check cached profile get
    get_res = client.get('/api/engine/noise-profile')
    assert get_res.status_code == 200
    assert get_res.json()['energy_ratio'] == 0.198
    print('Pre-flight Engine API audit PASS: status, detect, and profile endpoints verified.')
"
```
* *Stop Rule:* If any endpoint check fails or indices deviate, stop immediately.

### 3. Git Branch Pre-Condition
Execute:
```bash
git status
```
* Ensure you are cleanly on `feat/v4-structural-noise-engine-manager` with commit `7822692` (Slice 2) as HEAD.

---

## PHASE 1: ARCHITECTURE, DOM STRUCTURE & STYLING CONTRACTS

Implement the **LLM Engine Manager** frontend dock in [`src/ui/EngineManager.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/ui/EngineManager.js), defaults & state in [`src/ui/engineManagerDefaults.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/ui/engineManagerDefaults.js), client methods in [`src/core/RemoteProvider.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/core/RemoteProvider.js), styling in [`src/theme/chrome.css`](file:///Users/hbauzan/treepwood/vhectorlab/src/theme/chrome.css) and [`src/style.css`](file:///Users/hbauzan/treepwood/vhectorlab/src/style.css), and mount inside [`src/main.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/main.js).

### 1.1. Dual-Wing Dock Positioning Architecture
* Symmetrical counterpart to `VisualizationControls` (`#visualization-controls-container` at bottom-right):
  - **Left Wing (Engine Manager):** `#engine-manager-container.engine-panel.amiga-raised-box` anchored at `left: var(--hud-pad, 10px)` and resting directly on the top seam of the bottom HUD:
    ```css
    position: absolute;
    left: var(--hud-pad, 10px);
    bottom: calc(var(--hud-bottom, 8px) + var(--hud-height, 28px) - 1px);
    width: 330px;
    z-index: 45;
    ```
  - **Collapse Tab:** `.engine-panel-tab.dock-tab` with label `ENGINE` or `LLM ENGINE`. When collapsed, the sheet slides down into the HUD top seam while the tab remains parked on top of the HUD.
  - **Storage Key:** `vl3d.engine.panelCollapsed`.
  - **Mobile Rule:** In mobile viewports (`max-width: 768px` or short landscape via `isMobileViewport()`), panel is collapsed by default and ignores localStorage writes, aligning with `CollapsibleDock` rules.

### 1.2. Visual Identity & 3D Chiseled Bevels (MagicWB AGA 1993)
Refer to [`roadmap/theme-preview-v4.html`](file:///Users/hbauzan/treepwood/vhectorlab/roadmap/theme-preview-v4.html) for exact aesthetic reference:
* **Palette Tokens:**
  - Window Titlebar Background: MagicWB Cobalt Blue `#3B67A2`
  - Saturated Outlier Pills: MagicWB Peach `#FFA997` text/accent
  - Flat / Inert Pills: MagicWB Tan / Copper `#AA907C` text/accent
  - 3D Highlight Edge: Pure White `#FFFFFF` (top/left)
  - 3D Shadow Edge: Pure Black `#000000` (bottom/right)
  - 3D Inset Well: Dark inset `#1A1A1A` top/left, White `#FFFFFF` bottom/right, background `rgba(0,0,0,0.5)`
* **Tactile Depress Behavior:**
  - All buttons (`.amiga-gadget-btn`) shift 1px down-right on `:active` with reversed borders:
    ```css
    .amiga-gadget-btn:active {
      transform: translate(1px, 1px);
      border-top: 2px solid #000000;
      border-left: 2px solid #000000;
      border-right: 2px solid #FFFFFF;
      border-bottom: 2px solid #FFFFFF;
    }
    ```
* **Window Gadgets:**
  - Titlebar contains a square window depth/close gadget:
    ```html
    <div class="amiga-window-gadget"><div class="gadget-inner-square"></div></div>
    ```

### 1.3. DOM Structure Wireframe
```html
<div id="engine-manager-container" class="engine-panel amiga-raised-box" data-dock="engine">
  <button class="engine-panel-tab dock-tab" aria-label="Toggle Engine Manager" aria-expanded="true">
    <span class="tab-arrow">▼</span>
    <span class="tab-label">ENGINE</span>
  </button>

  <div class="engine-panel-body">
    <!-- Window Titlebar -->
    <div class="amiga-window-titlebar">
      <div class="amiga-window-gadget"><div class="gadget-inner-square"></div></div>
      <span class="engine-title-text">LLM ENGINE MANAGER</span>
      <span class="engine-model-tag" id="engine-model-tag">BAAI/bge-m3</span>
      <div class="amiga-window-gadget"><div class="gadget-inner-square"></div></div>
    </div>

    <div class="engine-content">
      <!-- Sunken Metrics Well -->
      <div class="amiga-inset-box engine-metrics-well">
        <button class="amiga-gadget-btn engine-audit-btn" id="engine-audit-btn">
          ⚡ RUN STRUCTURAL NOISE AUDIT
        </button>

        <div class="metric-row">
          <span class="metric-label">Energy Concentration:</span>
          <span class="metric-value" id="engine-metric-energy">—</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Baseline Anisotropy:</span>
          <span class="metric-value" id="engine-metric-cosine">—</span>
        </div>

        <div class="pills-header">ISOLATED OUTLIER AXES (3D BEVELED PILLS):</div>
        <div class="pills-container" id="engine-pills-container">
          <!-- Rendered dynamically as .noise-pill.sat or .noise-pill.flat -->
        </div>
      </div>

      <!-- Interactive 3D Checkboxes -->
      <div class="shield-toggle-row" id="engine-shield-toggle-row">
        <div class="amiga-checkbox checked" id="cb-engine-shield" role="checkbox" aria-checked="true" tabindex="0"></div>
        <span class="toggle-label bold">Outlier Pruning Shield [3D ON]</span>
      </div>

      <div class="shield-toggle-row" id="engine-dual-toggle-row">
        <div class="amiga-checkbox" id="cb-engine-dual" role="checkbox" aria-checked="false" tabindex="0"></div>
        <span class="toggle-label muted">Dual-Path Ribbon (Ghost vs Pure)</span>
      </div>
    </div>
  </div>
</div>
```

### 1.4. Defaults & Persistence ([`src/ui/engineManagerDefaults.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/ui/engineManagerDefaults.js))
* Constants:
  ```javascript
  export const ENGINE_STORAGE_PREFIX = 'vl3d.engine.';
  export const ENGINE_STORAGE_KEYS = Object.freeze({
    panelCollapsed: `${ENGINE_STORAGE_PREFIX}panelCollapsed`,
    shieldEnabled: `${ENGINE_STORAGE_PREFIX}shieldEnabled`,
    dualPathEnabled: `${ENGINE_STORAGE_PREFIX}dualPathEnabled`,
  });

  export const DEFAULT_ENGINE_SETTINGS = Object.freeze({
    shieldEnabled: true,
    dualPathEnabled: false,
  });
  ```
* Export pure helpers:
  - `readEngineSettings(storage)`
  - `saveEngineSettings(storage, settings)`
  - `readEnginePanelCollapsed(storage, { isMobile })`
  - `writeEnginePanelCollapsed(storage, collapsed, { isMobile })`

### 1.5. RemoteProvider Integration ([`src/core/RemoteProvider.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/core/RemoteProvider.js))
Add the three typed methods to `RemoteProvider`:
1. `async getEngineStatus()`: `GET /api/engine/status`
2. `async detectStructuralNoise(opts = {})`: `POST /api/engine/detect-structural-noise` with `{ force_recompute: opts.forceRecompute ?? false }`
3. `async getEngineNoiseProfile()`: `GET /api/engine/noise-profile`

### 1.6. EngineManager Component Contract ([`src/ui/EngineManager.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/ui/EngineManager.js))
* Constructor:
  ```javascript
  export class EngineManager {
    /**
     * @param {HTMLElement} parentContainer
     * @param {RemoteProvider} provider
     * @param {{
     *   onShieldToggle?: (enabled: boolean) => void,
     *   onDualPathToggle?: (enabled: boolean) => void,
     *   onAuditComplete?: (profile: object) => void,
     * }} [callbacks]
     */
    constructor(parentContainer, provider, callbacks = {}) { ... }
  ```
* Public Methods:
  - `setNoiseProfile(profile)`: populates energy ratio (`"19.80% L2 Norm"`), cosine drop (`"0.4981 → 0.3829 (Δ -0.1152)"`), and renders 3D beveled pills into `#engine-pills-container`:
    - Saturated dimensions: `<span class="noise-pill sat" title="Saturated Outlier (Z_E >= 3.0)">{dim}</span>`
    - Flat dimensions: `<span class="noise-pill flat" title="Flat/Inert Channel (sigma <= 0.010)">{dim}</span>`
  - `setEngineStatus(status)`: updates `#engine-model-tag` with model name / profile.
  - `setShieldEnabled(enabled)`: updates checkbox UI state, emits callback.
  - `setDualPathEnabled(enabled)`: updates checkbox UI state, emits callback.
  - `setBusy(busy)`: sets button state to `⚡ RUNNING AUDIT...` and disables during network calls.
  - `async runAudit(forceRecompute = true)`: calls `provider.detectStructuralNoise({ forceRecompute })`, updates profile and notifies callback.

---

## PHASE 2: STRICT TDD PROTOCOL (TESTS FIRST)

Write [`tests/EngineManager.test.js`](file:///Users/hbauzan/treepwood/vhectorlab/tests/EngineManager.test.js) BEFORE writing the component implementation.

### Required Test Cases:
1. `test_engine_manager_markup_and_initial_render()`:
   - Instantiate `EngineManager` in mock DOM.
   - Assert `#engine-manager-container` exists with `aria-expanded="true"`.
   - Assert `.engine-title-text`, `.amiga-window-gadget`, and `.engine-model-tag` exist.
   - Assert initial checkboxes render correct default states (`shieldEnabled = true`, `dualPathEnabled = false`).
2. `test_engine_manager_collapse_toggle_and_persistence()`:
   - Click `.engine-panel-tab`.
   - Assert container receives `.is-collapsed` and `aria-expanded="false"`.
   - Assert `localStorage.getItem('vl3d.engine.panelCollapsed')` is `'1'`.
   - Click again $\to$ container removes `.is-collapsed`, `aria-expanded="true"`, storage is `'0'`.
3. `test_engine_manager_profile_rendering()`:
   - Feed profile with 11 saturated indices and 2 flat indices:
     ```javascript
     manager.setNoiseProfile({
       model_name: 'BAAI/bge-m3',
       saturated_indices: [38, 58, 65, 80, 297, 376, 386, 404, 549, 577, 780],
       flat_indices: [329, 616],
       noise_indices: [38, 58, 65, 80, 297, 329, 376, 386, 404, 549, 577, 616, 780],
       energy_ratio: 0.1980,
       cosine_delta: 0.1152,
     });
     ```
   - Assert `#engine-metric-energy` text contains `'19.80%'`.
   - Assert `#engine-metric-cosine` text contains `'0.1152'`.
   - Assert `#engine-pills-container .noise-pill.sat` has count `11`.
   - Assert `#engine-pills-container .noise-pill.flat` has count `2`.
4. `test_engine_manager_checkbox_callbacks()`:
   - Provide spy callbacks `onShieldToggle` and `onDualPathToggle`.
   - Click `#engine-shield-toggle-row` $\to$ checkbox unchecked, callback invoked with `false`.
   - Click `#engine-dual-toggle-row` $\to$ checkbox checked, callback invoked with `true`.
5. `test_engine_manager_audit_button_interaction()`:
   - Provide mock `provider` with `detectStructuralNoise`.
   - Click `#engine-audit-btn`.
   - Assert provider method called with `{ forceRecompute: true }`.
   - Assert profile in DOM updates with result.
6. `test_remote_provider_engine_methods()`:
   - Unit tests in `tests/RemoteProvider.test.js` or `tests/EngineManager.test.js` verifying `getEngineStatus`, `detectStructuralNoise`, and `getEngineNoiseProfile` construct correct URLs and headers.

---

## PHASE 3: VERIFICATION & AUDIT CHECKLIST

Run the full verification suite after implementing:

1. **Frontend Vitest Suite:**
   ```bash
   npx vitest run tests/EngineManager.test.js
   npx vitest run
   ```
   *Requirement:* All 56+ files and 435+ tests must pass with 0 errors.
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
1. Exact count of tests in Vitest (`tests/EngineManager.test.js` and total).
2. Exact count of backend tests in pytest.
3. DOM verification: pill count (11 sat, 2 flat), button depression styling.
4. Await human "OK" to commit and proceed to Slice 4.
