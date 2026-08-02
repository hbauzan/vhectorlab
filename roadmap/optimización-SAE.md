El motivo por el cual tu implementación es "super lenta" comparada con la de esta herramienta no es el modelo en sí (la matemática de $X \cdot W_{enc}$ es la misma), sino **6 optimizaciones críticas de hardware, memoria y ejecución** que tiene el código original en `sae_model.py` y `server.py`.

Proyectar un vector de 768D a 8,192D implica multiplicar matrices gigantes ($N \times 768$ por $768 \times 8192$). Si lo haces de forma ingenua en Python puro, destruyes el rendimiento.

Aquí tienes los **6 factores clave que hacen que esta herramienta "vuele"** y cómo debes aplicarlos:

---

### 1. Inferencia Vectorizada por Lote + Cero-Copia de Memoria
* **El error común:** Hacer la inferencia elemento por elemento en un bucle `for` de Python o convertir arreglos con `torch.tensor(numpy_array)`.
* **La solución en el repo:** 
  1. Usar **`torch.from_numpy(array)`** en lugar de `torch.tensor()`. Esto **no duplica la memoria en RAM**, simplemente pasa el puntero de memoria directamente a PyTorch.
  2. Procesar **toda la matriz de un documento en una sola operación matricial** (ej. los 100 chunks del PDF en un solo bloque de $[100, 768] \times [768, 8192]$).

---

### 2. `torch.inference_mode()` + Autocasting en Precisión Mixta (FP16 / BF16)
* **El error común:** Usar `torch.no_grad()` o directamente no desactivar los gradientes, ejecutando toda la multiplicación en **Float32 (FP32)**.
* **La solución en el repo:**
  1. **`torch.inference_mode()`**: Es más rápido que `torch.no_grad()` porque apaga por completo el rastreo de metadatos de tensores en C++.
  2. **`torch.amp.autocast`**: Ejecuta la multiplicación de matrices en **`bfloat16`** o **`float16`** (usando los Tensor Cores de la GPU o la NPU de Apple Silicon), pero mantiene la selección Top-K en FP32 para que no haya inestabilidad numérica.

---

### 3. Agrupación Estática por Lotes (*Batch Bucketing*)
* **El error común:** Pasar arreglos de tamaños dinámicos e impredecibles a PyTorch. Cada vez que PyTorch ve una forma (*shape*) nueva, gasta milisegundos reasignando memoria interna.
* **La solución en el repo:** Rellenar (*pad*) la entrada con ceros hasta la potencia de 2 más cercana (`[1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]`). Al usar tamaños de lote fijos, PyTorch reutiliza la memoria de la GPU/CPU de forma instantánea.

---

### 4. Offloading fuera del Event Loop (`asyncio.to_thread`)
* **El error común:** Ejecutar el modelo PyTorch directamente dentro de una función `async def` de FastAPI. Como PyTorch es bloqueante (CPU/GPU-bound), congela todo el servidor web mientras calcula.
* **La solución en el repo:** Delegar la inferencia a un hilo secundario del pool mediante `await asyncio.to_thread(sae_manager.encode_vectors, matrix)`. El servidor FastAPI sigue respondiendo peticiones sin colgarse.

---

### 5. Aceleración de Hardware Dinámica (MPS para Mac / CUDA para Linux)
* **El error común:** Dejar que PyTorch corra en CPU por defecto.
* **La solución en el repo:** Detección automática en `state.py`:
  * En macOS: Activa **Apple Silicon Metal (MPS)** para usar la GPU del M1/M2/M3.
  * En Linux/Windows: Activa **CUDA**.

---

### 6. En el Frontend: Arreglos Lineales `Float32Array` y Web Workers
* **El problema de red/UI:** Transferir una matriz de 100 chunks por 8,192 características son **819,200 números flotantes**. Si FastAPI lo serializa como listas JSON anidadas de Python y JavaScript lo procesa con bucles `for` tradicionales, el navegador se congela.
* **La solución en el repo:**
  * Usar Web Workers (`mathWorker.js`) en hilos secundarios del navegador.
  * Pasar los datos usando `Float32Array` con transferencia de búfer cero-copia (`postMessage(msg, [buffer.buffer])`).

---

## 💻 El Código Optimizado (Copia y reemplaza esto)

Este es el método exacto extraído de `sae_model.py` en el proyecto original con las 6 optimizaciones integradas:

```python
import numpy as np
import torch

class SAEManagerOptimized:
    def __init__(self, model, device="cpu"):
        self.model = model
        self.device = device
        # Cubos estáticos de memoria para evitar realocación en PyTorch
        self.static_buckets = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]

    def encode_vectors_fast(self, vectors: np.ndarray) -> np.ndarray:
        """
        Procesa matrices [N, 768] a [N, 8192] de forma ultra-rápida.
        """
        orig_len = vectors.shape[0]
        if orig_len == 0:
            return np.empty((0, self.model.hidden_dim), dtype=np.float32)

        # 1. BATCH BUCKETING: Redondear a la potencia de 2 más cercana
        bucket_len = min((b for b in self.static_buckets if b >= orig_len), default=orig_len)
        padding_needed = bucket_len - orig_len

        if padding_needed > 0:
            padded_vectors = np.pad(vectors, ((0, padding_needed), (0, 0)), mode="constant")
        else:
            padded_vectors = vectors

        # 2. CERO-COPIA: Compartir puntero de memoria NumPy -> PyTorch
        if not padded_vectors.flags.writeable:
            padded_vectors = padded_vectors.copy()
        x_tensor = torch.from_numpy(padded_vectors).to(self.device)
        if x_tensor.dtype != torch.float32:
            x_tensor = x_tensor.float()

        # 3. DETECCIÓN DE PRECISION MIXTA (AMP)
        device_type = "cuda" if "cuda" in str(self.device) else ("mps" if "mps" in str(self.device) else "cpu")
        use_amp = device_type in ["cuda", "cpu"]
        amp_dtype = torch.bfloat16 if (device_type == "cuda" and torch.cuda.is_bf16_supported()) else torch.float16

        # 4. INFERENCIA ULTRA-RÁPIDA (inference_mode + autocast)
        with torch.inference_mode():
            if use_amp:
                with torch.amp.autocast(device_type=device_type, dtype=amp_dtype):
                    acts = self.model.encode(x_tensor)
            else:
                acts = self.model.encode(x_tensor)

            # Recortar el padding antes de devolver a NumPy
            acts_out = acts[:orig_len].cpu().float().numpy()

        return acts_out
```

---

### 📋 Lista de Chequeo para Arreglar tu Código Ahora Mismo

1. [ ] Reemplaza `torch.no_grad()` por **`torch.inference_mode()`**.
2. [ ] Asegúrate de pasar **la matriz entera del documento** en lugar de hacer un `for` por cada chunk.
3. [ ] Usa **`torch.from_numpy()`** para evitar duplicar memoria RAM.
4. [ ] Si estás en FastAPI, llama a la inferencia con **`await asyncio.to_thread(...)`**.
5. [ ] Configura el dispositivo a **`mps`** (si estás en Mac Apple Silicon) o **`cuda`** (si tienes GPU Nvidia).
6. [ ] Activa **`torch.amp.autocast`** para que las multiplicaciones matriciales se hagan en FP16/BF16.
---

### Estado en VectorLab (`fix/sae-train-current-scope`)

Checklist 1–6 aplicado al encode + train. Extra train session-scope:
- Full-batch cuando N cabe; `from_numpy`; MPS/CUDA `SAE_DEVICE=AUTO`
- `suggest_train_schedule` (epochs/batch); UI default epochs=20
- Bench local MPS: ~40×768 → 160D·k32·20ep ≈ **1.3s**

### Encode I/O (sparse + orjson) — aplicado
- `POST /api/sae/encode` → `format: topk_sparse` con `indices`/`values` `[N,K]` (no denso `[N,H]`)
- Router SAE: `OrjsonResponse` (orjson); cliente densifica en `densifyTopKActivations`
- Modelo: singleton en RAM (`load_model` no re-lee disco si ya está cargado)
