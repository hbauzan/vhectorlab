# 🗺️ Roadmap de Desarrollo: VectorLab 3D 
> **Objetivo del Agente:** Construir una herramienta liviana derivada de *LLM Semantic Visualizer*, enfocada **única y exclusivamente** en la ejecución de **Operaciones Vectoriales ($A - B + C$)**, búsqueda de vecinos cercanos por similitud coseno y su visualización/navegación tridimensional (Puntos/Hilos WebGL).

---

## 📐 1. Definición Estricta de Alcance (In Scope vs. Out of Scope)

### ✅ DENTRO DEL ALCANCE (IN SCOPE)
* **Backend:** FastAPI + PyTorch + SentenceTransformers (`all-mpnet-base-v2`).
* **Memoria de Vocabulario:** Pre-carga en RAM de `vocab.txt` (NumPy arrays) para cálculo rápido de similitud coseno $A - B + C$.
* **Endpoints API:** `/health`, `/embed`, `/tokenize`, `/arithmetic`.
* **Frontend WebGL (3D):** Renderizador Three.js basado en la imagen adjunta:
  * Fondo oscuro (`#050505`).
  * Puntos/Hilos con gradiente cromático de activación (Puntos amarillos/verdes incandescentes con halo según la magnitud).
  * Mapeo de ejes ($X$: dimensión/offset, $Y$: magnitud de activación, $Z$: secuencia/índice).
  * Navegación tridimensional libre (Vuelo WASDQE + Rotación con Mouse/Drag) y Gizmo de orientación.
* **UI & HUD (Basado estrictamente en las capturas):**
  * **Barra Superior:** Título de la app, estado de la conexión/modelo, selector de renderizado (`MESH`, `POINTS`, `RIBBONS`).
  * **Panel Lateral (Izquierda):** Entradas para Aritmética Vectorial ($A - B + C$), selector de Top-K resultados y configuración básica de Layout ($X, Y, Z$).
  * **Barra Telemétrica Inferior (Bottom HUD):** Indicador de coordenadas en tiempo real ($\text{X: } 372 \mid \text{Y: } 151 \mid \text{Z: } 94$), segmento en foco, valor numérico de activación y texto del token seleccionado.
* **Menú de Control (`setup.sh`):** Orquestador nativo/Docker para entorno local y compilación/despliegue en Hugging Face Spaces.

### ❌ FUERA DEL ALCANCE (OUT OF SCOPE - NO IMPLEMENTAR)
* **NO** Ingesta ni segmentación de PDFs (Eliminar LanceDB y PyPDF).
* **NO** Sparse Autoencoders (SAE) ni entrenamiento de redes neuronales secundarias.
* **NO** Comparación multi-documento ni inspector de dimensiones 2D complejo.
* **NO** Integración con API remota de Gemini/OpenAI para nombrado automático de dimensiones.
* **NO** Diccionario de interpretabilidad ni persistencia de metadatos en base de datos.

---

## 🛠️ 2. Arquitectura de Archivos del Proyecto

El agente debe estructurar el repositorio de la siguiente manera:

```text
vectorlab-3d/
├── .env.example
├── Dockerfile
├── README.md
├── version.json
├── setup.sh                     <-- Menú simplificado de operaciones
├── backend/
│   ├── pyproject.toml
│   ├── server.py                <-- Entrypoint FastAPI + lifespan
│   ├── state.py                 <-- Estado global y vocabulario en RAM (Lazy loading)
│   ├── perform_tests.py         <-- Heartbeat y diagnósticos de salud
│   └── routers/
│       └── core.py              <-- Endpoints: /health, /embed, /tokenize, /arithmetic
├── public/
│   └── vocab.txt                <-- Vocabulario de 10,000 palabras precalculadas
└── src/
    ├── main.js                  <-- Orquestador principal y Render Loop (rAF)
    ├── style.css                <-- Estilos UI en OKLCH / Tokens oscuros
    ├── core/
    │   ├── State.js             <-- Estado reactivo de la UI y vectores
    │   └── RemoteProvider.js    <-- Cliente HTTP Fetch para la API FastAPI
    ├── engine/
    │   ├── SceneSetup.js        <-- Escena Three.js, cámara, luces y controles
    │   ├── Interaction.js      <-- Eventos teclado WASDQE, mouse drag, raycaster
    │   ├── Navigation.js       <-- Integrador de física inercial de la nave
    │   └── Shaders.js          <-- GLSL Vertex/Fragment Shaders para puntos/halos
    ├── visualizer/
    │   ├── Instancer.js        <-- Renderizado GPU (InstancedMesh/Points)
    │   ├── MeshFactory.js      <-- Geometría de vectores/hilos individuales
    │   ├── LayoutEngine.js     <-- Asignación espacial de coordenadas (X, Y, Z)
    │   └── AxisGizmo.js        <-- Indicador 3D de ejes en la esquina
    └── ui/
        ├── HUD.js              <-- Telemetría inferior (Coords X,Y,Z, Activación, Token)
        ├── Sidebar.js          <-- Panel de entradas A - B + C
        └── CustomModal.js      <-- Modales emergentes para confirmación/alertas
```

---

## 📋 3. Fases de Implementación (Paso a Paso)

### Fase 1: Backend Simplificado & Memoria de Vocabulario
1. **Crear `backend/pyproject.toml`** utilizando `uv` con dependencias mínimas: `fastapi`, `uvicorn`, `sentence-transformers`, `torch` (CPU/CUDA/MPS), `numpy`, `httpx`, `huggingface-hub`.
2. **Implementar `backend/state.py`**:
   * Cargar el modelo `SentenceTransformer('all-mpnet-base-v2')` de forma perezosa (*lazy loading*) dentro de la función `lifespan`.
   * En el arranque, leer `public/vocab.txt`, calcular los embeddings en lote con NumPy y guardarlos en `state.vocab_embeddings` para resolver `/arithmetic` en milisegundos.
3. **Implementar `backend/routers/core.py`**:
   * Endpoint `/arithmetic`: Recibe `word_a`, `word_b`, `word_c` y `top_k`.
   * Calcula el vector resultante $V_{res} = V_A - V_B + V_C$.
   * Computa la similitud del coseno $\text{Sim}(V_{res}, V_{vocab}) = \frac{V_{res} \cdot V_{vocab}}{\|V_{res}\| \|V_{vocab}\| + 10^{-9}}$ omitiendo las palabras de entrada.
   * Retorna el vector resultadante, sus componentes y la lista de palabras cercanas (`word`, `score`, `token_id`).

---

### Fase 2: Motor Gráfico WebGL 3D & Shaders (Fiel a la Imagen)
1. **Crear `src/engine/Shaders.js`**:
   * Implementar Fragment Shader con suavizado radial (*anti-aliasing*) para renderizar círculos perfectos con un halo incandescente exterior (similar a la captura).
   * Mapear la magnitud del vector de activación a un gradiente continuo: valores bajos en verde/azul cian oscuros $\rightarrow$ valores altos en amarillo brillante/blanco incandescente con opacidad atenuada por distancia.
2. **Implementar `src/visualizer/Instancer.js` & `MeshFactory.js`**:
   * Dibujar los puntos del vector de entrada ($A, B, C$) y el vector resultante ($V_{res}$) como una secuencia de esferas/puntos sobre una grilla espacial en perspectiva.
   * Asegurar que los puntos principales tengan un tamaño mayor y halo resplandeciente, imitando exactamente el efecto de la imagen.
3. **Implementar `src/engine/Navigation.js` e `Interaction.js`**:
   * Controles de cámara inerciales: `W/S` (Avanzar/Retroceder), `A/D` (Desplazar izquierda/derecha), `Q/E` (Elevar/Bajar), `Shift` (Aceleración Turbo).
   * Soporte para rotación arrastrando el mouse (*drag-to-look*) y Raycasting para detectar el punto bajo el cursor.

---

### Fase 3: Interfaz de Usuario (UI) & Telemetría Inferior
1. **Crear la Barra Telemétrica Inferior (`src/ui/HUD.js`)**:
   * Fiel a la captura adjunta, renderizar un panel inferior flotante con vidrio esmerilado (*glassmorphic*):
     * **Izquierda:** Coordenadas telemétricas del punto inspeccionado ($\text{X: } 372 \mid \text{Y: } 151 \mid \text{Z: } 94$).
     * **Centro:** `HOVER TELEMETRY` (Segmento/Chunk, Dimensión en foco, Valor numérico de activación formateado con color verde/amarillo).
     * **Derecha:** Texto/Token de la palabra correspondiente en foco.
2. **Crear el Panel de Control Lateral (`src/ui/Sidebar.js`)**:
   * Formulario directo para Aritmética Vectorial:
     * Campo Entrada $A$ ($+$)
     * Campo Entrada $B$ ($-$)
     * Campo Entrada $C$ ($+$)
     * Campo Top-K Resultados.
     * Botón primario: `⚡ CALCULAR VECTOR`.
   * Lista desplegable con las $K$ palabras resultantes y sus puntajes de similitud. Al hacer clic en un resultado, centrar la cámara 3D en el vector correspondiente.
3. **Pestañas de Control de Renderizado (Barra Superior)**:
   * Selector directo de modo: `MESH` | `POINTS` | `RIBBONS`.

---

### Fase 4: Menú de Control `setup.sh` (Acotado y Exacto)
Crear el archivo `setup.sh` ejecutable conteniendo **únicamente** las funciones necesarias para operar localmente y desplegar en Hugging Face:

```bash
#!/bin/bash
# ==========================================
# VECTORLAB 3D - CONTROL PANEL
# ==========================================

# Funciones internas:
# 1. Start Development Mode (Hot-Reload con Vite + FastAPI bare-metal uvicorn)
# 2. Start/Stop Bare-metal Backend (macOS MPS / CUDA)
# 3. Run System Heartbeat (Prueba de salud en /health y /arithmetic)
# 4. Run Frontend Unit Tests (Vitest)
# 5. Run Backend Unit Tests (pytest)
# 6. Build Hugging Face Space Docker Image (Compilación de Dockerfile monolítico)
# 7. Publish Hugging Face Space (Wizard interactivo: build + sync + push a HF Hub)
# 8. View Logs
# 9. Stop / Clean Services
# 0. Exit
```

---

## ⚠️ 4. Lecciones Aprendidas e Invariantes del Código (Para evitar errores)

El agente de IA **DEBE** respetar estrictamente las siguientes lecciones aprendidas del repositorio base para evitar fallos de compilación o cuelgues en tiempo de ejecución:

1. **Invariante de Carga en Backend (`backend/state.py`):**
   * **NUNCA** cargar modelos de PyTorch o `SentenceTransformer` en el nivel superior de `state.py`. La carga **debe** realizarse de forma perezosa (*lazy loading*) dentro de la función `lifespan` de FastAPI en `server.py`. Romper esta regla hará que los tests unitarios se cuelguen o fallen por importación circular.
2. **Manejo de Red y Binds de Servidor:**
   * En entorno bare-metal local, Uvicorn debe escuchar en `127.0.0.1:8000` por defecto para evitar alertas del firewall. Para Docker y Hugging Face Spaces debe escuchar en `0.0.0.0:${PORT:-7860}`.
3. **Frustum Culling en Three.js (`ReliefRenderer.js` / `Instancer.js`):**
   * Al actualizar las posiciones o escalas de los puntos vectoriales en tiempo real en la GPU, la esfera delimitadora (`boundingSphere`) de Three.js queda desfasada. Para evitar que la geometría desaparezca repentinamente de pantalla (*CATAPLUM bug*), la propiedad `frustumCulled` de los objetos 3D debe fijarse explícitamente en `false`:
     ```javascript
     pointsMesh.frustumCulled = false;
     ```
4. **Single Source of Truth para Versiones (`version.json`):**
   * No editar manualmente el campo `"version"` en `package.json` o `pyproject.toml`. El script `scripts/bump.mjs` o `version.json` debe ser la única fuente de verdad para sincronizar versiones atómicamente.
5. **Alineación de Seguridad CORS:**
   * No combinar `allow_origins=["*"]` con `allow_credentials=True` en FastAPI (los navegadores modernos bloquean esta configuración). Usar `allow_origins=["*"]` con `allow_credentials=False`.
6. **Inferencia en Hugging Face Spaces (Modo Demo):**
   * En el Dockerfile para Hugging Face (`APP_MODE=demo`), usar la librería `huggingface_hub` con `InferenceClient` o pre-cargar los vectores de vocabulario en formato comprimido `.npz` para evitar agotar la RAM del contenedor gratuito de Hugging Face (2 GB limit).

---

## 🚀 5. Checklist de Verificación para el Agente

Antes de dar por completado el trabajo, el agente debe ejecutar las siguientes comprobaciones:

* [ ] `cd backend && uv run pytest` pasa el 100% de las pruebas unitarias.
* [ ] `npm test` ejecuta las pruebas de Vitest para la matemática 3D sin errores.
* [ ] Probar la consulta $A - B + C$ (ej. `"king" - "man" + "woman"`) en la interfaz web y verificar que la respuesta sea `"queen"` en las primeras posiciones.
* [ ] Verificar que al pasar el cursor sobre los puntos 3D, la barra telemétrica inferior actualice en tiempo real las coordenadas $X, Y, Z$, la magnitud de activación y el nombre del token.
* [ ] Probar la ejecución de `./setup.sh` Opción 6 (Build HF Docker) y validar que el contenedor exponga el puerto `7860` correctamente.