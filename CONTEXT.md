# Context & Domain Model Glossary - VectorLab 3D

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

### Anchor Token
The token currently at position #1 in a Compare Sequence. Cosine similarity for every row is computed against this embedding (`cosine_vs_first`).

### Cosine-vs-First Score
Dot product between an item’s L2-normalized embedding and the Anchor Token embedding; the anchor row is always `1.0000` (REF).

### Collapsible Dock
Edge-hosted UI host that slides off-screen via CSS `transform` while keeping children mounted; left dock hosts Arithmetic or Compare, right dock hosts spatial sliders and AxisGizmo. The bottom telemetry HUD is not a dock.

_Avoid_: treating Sidebar/ComparePanel as independent minimize targets; unmounting panel DOM to “hide” it.

### Landscape Gate
Soft, dismissible portrait-phone overlay that suggests rotating to landscape without locking orientation or pausing the 3D render loop.

### Wide Ribbon
Quad-strip mesh with real lateral width following a thread centerline, colored by activation; used by `RENDER: RIBBONS`. Distinct from 1px WebGL lines.

### Visualization Controls
Right-dock glass panel for global sign filter and divergent color anchors (below 3D Spatial Controls).

### Sign Filter
Global show mode `all | positive | negative` over **normalized** activations (post z-score/tanh); near-zero `|t| < 0.01` is treated as neutral and hidden by +/− only.

### Color Anchor
User-editable hex for normalized activations at +1, 0, and −1; replaces the former fixed dual mid-stop ramp via linear RGB lerp.

