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

