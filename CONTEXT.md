# Context & Domain Model Glossary - VHectorLab 3D

## Ubiquitous Language

### Vector Arithmetic
Operation calculating a composite semantic vector $V_{res} = V_A - V_B + V_C$ in high-dimensional embedding space.

### Vocabulary Matrix
Pre-computed L2-normalized array of word embeddings in RAM enabling sub-millisecond similarity search via matrix multiplication.

### Lazy Loading
Initialization pattern deferring heavy model loading (PyTorch / SentenceTransformer) to the application lifespan startup event, preserving module import speed and clean testability.

### Halo Shader
WebGL fragment shader rendering glowing incandescence for 3D activation points mapped to vector magnitudes.

### Thread Geometry
3D vector representations constructed using continuous Three.js `Line` and `Points` buffer geometries to display multi-point activation series over space.

### In-situ Buffer Mutation
Updating existing GPU `Float32Array` attributes directly and setting `needsUpdate = true`, avoiding geometry re-creation and memory leaks during real-time UI interactions.

### Compare Sequence
Ordered list of 1–1024 token/text items visualized as parallel 3D threads; list order equals layout `sequenceIndex`.

### Compare Group
Named block in Compare input (`GROUP_name = tokens…`) that concatenates members into the sequence and renders a floating group badge at the member-origin centroid (screen-offset left of token labels). Global cosine sort may interleave groups.

### Anchor Token
The token currently at position #1 in a Compare Sequence. Cosine similarity for every row is computed against this embedding (`cosine_vs_first`).

### Cosine-vs-First Score
Dot product between an item’s L2-normalized embedding and the Anchor Token embedding; the anchor row is always `1.0000` (REF).

### Collapsible Dock
Edge-hosted UI host that slides off-screen via CSS `transform` while keeping children mounted; left dock hosts Arithmetic or Compare, right dock hosts spatial sliders and AxisGizmo. The bottom telemetry HUD is not a dock.

_Avoid_: treating Sidebar/ComparePanel as independent minimize targets; unmounting panel DOM to “hide” it.

### Landscape Gate
_Retired._ Former soft portrait overlay that suggested landscape; product prefers phone portrait. Do not reintroduce without an explicit ask.

### Field Info Tip
Compact tap “i” control next to an editable field; shows a short English popover (mobile-safe, not hover-only `title`). Catalog lives in `fieldInfo.js`.

### Wide Ribbon
Quad-strip mesh with real lateral width following a thread centerline, colored by activation; used by `RENDER: RIBBONS`. Distinct from 1px WebGL lines.

### Visualization Controls
Bottom-HUD glass panel for global sign filter, divergent color anchors, Zero Coverage, and Group contrast (Compare ≥2 groups).

### Sign Filter
Global show mode `all | positive | negative` over **normalized** activations (post z-score/tanh); near-zero `|t| < 0.01` is treated as neutral and hidden by +/− only.

### Color Anchor
User-editable hex for normalized activations at +1, 0, and −1; replaces the former fixed dual mid-stop ramp via linear RGB lerp.

### Zero Coverage
Percent of the |t| range held at the zero color (default black) before blending toward ±1 anchors; capped at 90%.

### Group Contrast
Visualization paint for Compare with ≥2 groups: **Shared noise** blackens same-sign dims by similarity; **Sign conflict** highlights opposite-sign dims (custom color × |Δ|) and can blacken them by difference. Uses group means on raw embeddings; geometry Y unchanged.

### Amiga Skin
Parallel MPA UI at `/amiga/` with Magic Workbench palette and Topaz pixel typography on the **same fullscreen + floating-dock layout as legacy `/`**. Independent of `/v25/` (no panel-zone grid). Palette overridable via `VITE_AMIGA_*` in `.env`.

_Avoid_: treating Amiga as a reskin of v25; copying v25 shell zones; editing `src/v25/**` for Amiga work.

### Shared Noise Similarity
`1 − |mean_G1 − mean_G2| / (|mean_G1| + |mean_G2|)` per dimension — high values mean shared-sign “noise” between groups.

### Top‑K SAE
Trained sparse autoencoder with exactly K active latents per input (ReLU + Top‑K, no L1 shrinkage). Trained on the **current workspace scope** (Compare/Arithmetic batch); ephemeral in-RAM session model. Default caps 768 → 8192 with K=32 (auto-scaled for small N).

### Clean/Denoise (SAE)
Compare-only toggle that replaces raw 768D embeddings with SAE sparse activations for 3D threads and cosine while ON. Requires Train SAE on current Visualize data; scope changes clear the session model. Not available in Arithmetic.

### SAE Feature Space
Expanded latent dimension (default cap 8192, auto-scaled for small N) used for visualization and metrics while Clean/Denoise is enabled.

### Dead Features
Latents that never activated on the training set; reported in SAE train metrics.

