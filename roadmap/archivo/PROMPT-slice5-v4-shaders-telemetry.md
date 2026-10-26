# EXECUTION PROMPT: SLICE 5 — WEBGL 3D SHADERS, DUAL-PATH RIBBON & TELEMETRY HUD

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
  - Frontend: `57 test files passed, 448 tests passed (100%)`.
  - Backend: `153 tests passed (100%), 2 warnings in ~29s`.
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
* Ensure you are cleanly on `feat/v4-structural-noise-engine-manager` with commit `1b129d6` (Slice 4) as HEAD.

---

## PHASE 1: MATHEMATICAL SPECIFICATION & ARCHITECTURAL CONTRACTS

Implement WebGL shader noise suppression, dual-path trajectory rendering, and hover telemetry readout across:
- [`src/visualizer/DivergentShading.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/visualizer/DivergentShading.js)
- [`src/visualizer/MeshFactory.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/visualizer/MeshFactory.js)
- [`src/visualizer/Instancer.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/visualizer/Instancer.js)
- [`src/ui/hoverTelemetry.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/ui/hoverTelemetry.js)
- [`src/ui/HUD.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/ui/HUD.js)
- [`src/main.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/main.js)
- [`src/theme/chrome.css`](file:///Users/hbauzan/treepwood/vhectorlab/src/theme/chrome.css)

### 1.1. GPU Vertex Shader Flattening in [`src/visualizer/DivergentShading.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/visualizer/DivergentShading.js)
In `divergentVertexShader` and `softStarVertexShader`:
1. Declare new vertex attributes and uniforms:
   ```glsl
   attribute float intensity;
   attribute float aCancel;
   attribute float aHighlight;
   attribute vec3 aBaseColor;
   attribute float aNoiseMask;   // 1.0 = valid dimension, 0.0 = noise outlier
   attribute float aBaselineY;   // Thread baseline Y (offsetY in ANALYSIS, 0.0 in NAVIGATION)
   varying float vIntensity;
   varying float vCancel;
   varying float vHighlight;
   varying vec3 vBaseColor;
   varying float vNoiseMask;
   uniform float pointSize;
   uniform float uShieldEnabled; // 1.0 = shield active, 0.0 = shield off
   ```
2. Flatten height amplitude in `main()`:
   ```glsl
   void main() {
       vIntensity = intensity;
       vCancel = aCancel;
       vHighlight = aHighlight;
       vBaseColor = aBaseColor;
       vNoiseMask = aNoiseMask;

       vec3 pos = position;
       if (uShieldEnabled > 0.5 && aNoiseMask < 0.5) {
           pos.y = aBaselineY;
       }

       vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
       float dist = length(mvPosition.xyz);
       gl_PointSize = clamp(pointSize * (300.0 / max(dist, 0.01)), 4.0, 80.0);
       gl_Position = projectionMatrix * mvPosition;
   }
   ```
   *(Apply identical logic in `softStarVertexShader` with its specific pointSize clamping formula).*
3. In `createDivergentMaterial(pointSize, baseOpacity, options = {})`:
   - Initialize uniform:
     ```javascript
     uShieldEnabled: { value: options.shieldEnabled ? 1.0 : 0.0 },
     ```
4. In `updateDivergentMaterialUniforms(material, options = {})`:
   - Support dynamic toggle:
     ```javascript
     if (options.shieldEnabled !== undefined && material.uniforms.uShieldEnabled) {
       material.uniforms.uShieldEnabled.value = options.shieldEnabled ? 1.0 : 0.0;
     }
     ```
   - **Critical Invariant:** Toggling `uShieldEnabled` updates the uniform in-situ without rebuilding shaders or re-allocating geometries.

### 1.2. Attribute Allocation in [`src/visualizer/MeshFactory.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/visualizer/MeshFactory.js)
1. In `MeshFactory.createPointsMesh(pointsData, options = {})`:
   - Extract `noiseIndices` from options (support `Array<number>`, `Set<number>`, or `null`).
   - Extract `shieldEnabled` (`Boolean(options.shieldEnabled)`).
   - Allocate `noiseMask = new Float32Array(pointsData.length)`.
   - Allocate `baselineY = new Float32Array(pointsData.length)`.
   - Populate for each point $i$:
     ```javascript
     const srcDim = pointsData[i].meta?.dim !== undefined ? Number(pointsData[i].meta.dim) : (i % 1024);
     const isNoise = noiseSet && noiseSet.has(srcDim);
     noiseMask[i] = isNoise ? 0.0 : 1.0;
     baselineY[i] = pointsData[i].baselineY !== undefined ? Number(pointsData[i].baselineY) : 0.0;
     ```
   - Bind buffer attributes:
     ```javascript
     geometry.setAttribute('aNoiseMask', new THREE.Float32BufferAttribute(noiseMask, 1));
     geometry.setAttribute('aBaselineY', new THREE.Float32BufferAttribute(baselineY, 1));
     ```
   - Pass `{ ..., shieldEnabled }` to `createDivergentMaterial`.

2. Ribbon Geometries when Shield is Active:
   - For primary thread line (`createRibbonMesh`) and wide ribbon (`createWideRibbonMesh`):
     - When `options.shieldEnabled === true` and `noiseIndices` is provided:
       Points passed to ribbon geometries must have their $Y$ clamped to `baselineY` at noise coordinates:
       ```javascript
       // p.y = baselineY for d in noiseIndices
       ```
     - This ensures that lines and quad strips seamlessly follow the flattened trajectory without vertical spike artifacts.

### 1.3. Dual-Path Ghost Ribbon in [`src/visualizer/Instancer.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/visualizer/Instancer.js)
1. When in Compare Mode:
   - Read options: `{ noiseShieldEnabled, dualPathEnabled, noiseIndices }`.
   - Compute two sets of 3D points per thread:
     - `rawPoints`: mapped directly from unpruned raw activations (`p.y = offsetY + val * ampY`).
     - `semanticPoints`: when `noiseShieldEnabled` is true, noise coordinates have $Y$ flattened to `offsetY`. When `noiseShieldEnabled` is false, `semanticPoints` equals `rawPoints`.
2. Rendering Primary vs Ghost Ribbon:
   - **Primary Mesh:** Always renders the active semantic path (`semanticPoints`).
   - **Dual-Path Ghost Ribbon:**
     - Mounted IF AND ONLY IF `dualPathEnabled === true` AND `noiseShieldEnabled === true` AND `noiseIndices.length > 0`.
     - Rendered along `rawPoints`.
     - Styling:
       - Wide ribbon: `opacity: 0.28`, `transparent: true`, `depthWrite: false`.
       - Color: MagicWB Peach `#FFA997` (accentuating the rogue outlier spikes) or translucent neutral tint.
       - Mesh metadata: `mesh.userData.kind = 'dualPathGhostRibbon'`.
       - Added to `this.activeGroup`.
     - If `dualPathEnabled === false` or `noiseShieldEnabled === false`, no ghost ribbon is mounted.

### 1.4. Hover Telemetry in [`src/ui/hoverTelemetry.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/ui/hoverTelemetry.js) & [`src/ui/HUD.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/ui/HUD.js)
1. In `hoverTelemetry.js`:
   - Add function `calculateVectorNoiseRatio(vector, noiseIndices)`:
     ```javascript
     export function calculateVectorNoiseRatio(vector, noiseIndices) {
       if (!vector || !vector.length || !noiseIndices) return 0.0;
       const set = noiseIndices instanceof Set ? noiseIndices : new Set(noiseIndices);
       if (set.size === 0) return 0.0;
       let noiseNormSq = 0.0;
       let totalNormSq = 0.0;
       for (let i = 0; i < vector.length; i++) {
         const valSq = vector[i] * vector[i];
         totalNormSq += valSq;
         if (set.has(i)) noiseNormSq += valSq;
       }
       if (totalNormSq <= 1e-12) return 0.0;
       return noiseNormSq / totalNormSq;
     }
     ```
   - Add function `formatNoiseRatio(ratio)`:
     ```javascript
     export function formatNoiseRatio(ratio) {
       if (typeof ratio !== 'number' || !Number.isFinite(ratio)) return '--';
       return `${(ratio * 100).toFixed(1)}%`;
     }
     ```
   - In `resolveHoverTelemetry(data)`:
     - Read `meta.noiseRatio` or compute from `meta.tokenVector` / `ud.activations`.
     - Read `meta.isNoiseDim` (boolean indicating if the hovered coordinate is in `noiseIndices`).
     - Return `{ ..., noiseRatio, isNoiseDim }`.
2. In `HUD.js`:
   - In `this.element.innerHTML`, add telemetry slot inside `.hud-center`:
     ```html
     <span id="hud-noise" class="hud-val hud-noise-ratio">NOISE: --</span>
     ```
   - In `updateTelemetry(data)`:
     - If hover payload exists:
       - If `t.noiseRatio != null`:
         - `this.noiseEl.textContent = `NOISE: ${formatNoiseRatio(t.noiseRatio)}`;`
         - If `t.isNoiseDim`:
           - Add CSS class `.is-rogue-dim` (MagicWB Peach color `#FFA997`).
           - Set title: `"Rogue structural noise dimension (Outlier Shield)"`.
         - Else:
           - Remove `.is-rogue-dim`.
           - Set title: `"Instantaneous token noise energy ratio"`.
       - Else:
         - `this.noiseEl.textContent = 'NOISE: --';`
     - On hover clear:
       - Reset `this.noiseEl.textContent = 'NOISE: --'`.

### 1.5. Application Wiring in [`src/main.js`](file:///Users/hbauzan/treepwood/vhectorlab/src/main.js)
1. In `compareSceneOptions()`:
   ```javascript
   compareSceneOptions() {
     const noiseIndices = this.noiseShieldEnabled && Array.isArray(this.activeNoiseProfile?.noise_indices)
       ? this.activeNoiseProfile.noise_indices
       : null;
     return {
       dimSortByContrast: this.dimSortByContrast,
       isSaeActive: this.isSaeActive(),
       noiseShieldEnabled: this.noiseShieldEnabled,
       dualPathEnabled: this.dualPathEnabled,
       ...(noiseIndices && noiseIndices.length ? { noiseIndices } : {}),
     };
   }
   ```
2. In `handleDualPathToggle(enabled)`:
   - `this.dualPathEnabled = Boolean(enabled);`
   - Trigger `this.refreshRender();` to mount or unmount the ghost ribbon in real time.
3. In `handleNoiseShieldToggle(enabled)`:
   - `this.noiseShieldEnabled = Boolean(enabled);`
   - Sync `comparePanel.setNoiseShieldConfig({ enabled, noiseIndices })`.
   - Trigger `this.refreshRender();`.

---

## PHASE 2: STRICT TDD PROTOCOL (TESTS FIRST)

Write [`tests/shaderNoiseMask.test.js`](file:///Users/hbauzan/treepwood/vhectorlab/tests/shaderNoiseMask.test.js) BEFORE writing the implementation.

### Required Test Cases:
1. `test_points_geometry_noise_mask_allocation()`:
   - Create points data with 64 dimensions, where dim 10 is in `noiseIndices`.
   - Call `MeshFactory.createPointsMesh(pointsData, { noiseIndices: [10], shieldEnabled: true })`.
   - Assert `geometry.getAttribute('aNoiseMask')` exists and has length 64.
   - Assert `aNoiseMask.getX(10) === 0.0`.
   - Assert `aNoiseMask.getX(0) === 1.0` and `aNoiseMask.getX(11) === 1.0`.
   - Assert `geometry.getAttribute('aBaselineY')` exists.
2. `test_divergent_shader_flattens_noise_amplitude()`:
   - Assert that `divergentVertexShader` contains `attribute float aNoiseMask;`.
   - Assert that `divergentVertexShader` contains `attribute float aBaselineY;`.
   - Assert that `divergentVertexShader` contains `uniform float uShieldEnabled;`.
   - Assert that the vertex shader branches on `if (uShieldEnabled > 0.5 && aNoiseMask < 0.5) pos.y = aBaselineY;`.
   - Assert that `updateDivergentMaterialUniforms` updates `material.uniforms.uShieldEnabled.value` in-situ.
3. `test_dual_path_ribbon_mounting_in_compare()`:
   - Setup synthetic Compare data (2 tokens × 32 dimensions).
   - Instantiate `Instancer` with mock Three.js Scene.
   - Call `instancer.renderCompareData(response, "RIBBONS", null, "NAVIGATION", null, { noiseShieldEnabled: true, dualPathEnabled: true, noiseIndices: [5] })`.
   - Assert `activeGroup.children` contains both primary wide ribbon and `dualPathGhostRibbon`.
   - Call again with `{ noiseShieldEnabled: true, dualPathEnabled: false, noiseIndices: [5] }`.
   - Assert `dualPathGhostRibbon` is NOT present.
4. `test_hover_telemetry_noise_ratio_calculation()`:
   - Create synthetic vector where dim 10 carries 60% of total energy.
   - Call `calculateVectorNoiseRatio(vec, [10])`.
   - Assert ratio is close to $0.60 \pm 0.01$.
   - Assert `formatNoiseRatio(ratio)` returns `"60.0%"`.
5. `test_hud_renders_noise_percentage()`:
   - Instantiate `HUD` in mock DOM.
   - Assert `#hud-noise` element exists with default text `"NOISE: --"`.
   - Call `hud.updateTelemetry({ point: {x:0,y:0,z:0}, userData: { pointsData: [{ activation: 0.28, meta: { dim: 386, noiseRatio: 0.198, isNoiseDim: true } }] }, index: 0 })`.
   - Assert `#hud-noise` renders `"NOISE: 19.8%"`.
   - Assert `#hud-noise` receives `.is-rogue-dim` styling when hovering rogue dim 386.

---

## PHASE 3: VERIFICATION & AUDIT CHECKLIST

Run the full verification suite after implementing:

1. **Frontend Vitest Suite:**
   ```bash
   npx vitest run tests/shaderNoiseMask.test.js
   npx vitest run
   ```
   *Requirement:* All 58+ files and 455+ tests must pass with 0 errors.
2. **Backend Regression Suite:**
   ```bash
   uv run --directory backend pytest
   ```
   *Requirement:* All 153 tests must pass with 0 errors.
3. **Live Browser Verification on Running App (`http://127.0.0.1:5173/`):**
   - Open Compare on `car, truck`.
   - Run noise audit on Engine Manager (`BAAI/bge-m3`).
   - Toggle Outlier Pruning Shield:
     - In 3D ANALYSIS mode: observe Dim 386 and rogue peaks flatten immediately onto the baseline without skyscraper spikes.
   - Toggle Dual-Path Ribbon:
     - Observe the semi-transparent ghost ribbon appear, showing the raw trajectory while the pure semantic ribbon stays flat.
   - Hover over Dim 386:
     - Check bottom HUD: renders the hovered token's instantaneous noise energy ratio (`NOISE: 24.7%` when hovering `car`, `NOISE: 19.2%` when hovering `truck`) with rogue indicator `.is-rogue-dim` styling. (Note: `19.8%` is the model's global vocabulary energy ratio displayed in the Engine Manager card; hover telemetry dynamically displays the token's instantaneous noise ratio).

---

## PHASE 4: APPROVAL GATE & HANDOFF

Do NOT push to origin or merge to main. Report the auditable numbers:
1. Exact count of tests in Vitest (`tests/shaderNoiseMask.test.js` and total).
2. Verification that `aNoiseMask` flattens amplitude to baseline Y on GPU without geometry reallocation.
3. Verification of Dual-Path Ribbon mounting in Compare mode.
4. Telemetry readout output under hover.
5. Await human "OK" to commit.
