# PROMPT DE EJECUCIÓN: SLICE 2 — MICRO-BENCHMARK RUNNER & PERSISTENCIA JSON

> **Rol del Agente:** Principal Software Architect y copiloto de ingeniería de lógica de alta densidad en VHectorLab 3D.  
> **Skill Obligatoria:** `.agents/skills/dev-protocol/SKILL.md` (seguir estrictamente).  
> **Principio Rector:** *"Antes de creer, ejecutar. Antes de responder, medir la premisa. Dato mata relato."* Cero complacencias, verificación primero.

---

## FASE 0: PRE-FLIGHT AUDIT OBLIGATORIO (CHECK DE ESTADO ACTUAL)

Antes de modificar o crear un solo archivo, ejecutá las siguientes verificaciones numéricas contra el repositorio en la rama `feat/hardware-inspector-taxonomy` (o rama base de trabajo). Si encontrás CUALQUIER discrepancia con las afirmaciones del estado previo, **DETENTE INMEDIATAMENTE y reportale la discrepancia al usuario**:

1. **Auditoría de Suite Actual (Piso de Regresión)**:
   - Ejecutá `npm test` en la raíz. Afirmación previa: *55 test files passed, 426 tests passed (100%)*. Verificá que no haya tests rotos.
   - Ejecutá `uv run pytest` dentro del directorio `backend/`. Afirmación previa: *113 passed (100%), 2 warnings, ~22s*. Verificá que la suite completa pase al 100%.
2. **Auditoría de Slice 1 Implementado**:
   - Verificá que `backend/hardware_inspector.py` existe y que `get_hardware_profile()` retorna un `HardwareProfile` válido.
   - Verificá que `backend/model_catalog.py` exporta `ModelFamily` y `MemoryTier`, y que cada entrada en `list_models()` tiene `family` y `memory_tier` asignados.
3. **Auditoría de Modelos en Caché Local**:
   - Verificá qué modelos están en caché local (`~/.cache/huggingface/hub/models--*`). Afirmación previa: *al menos `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`, `sentence-transformers/all-mpnet-base-v2` y `BAAI/bge-m3` están descargados*.

*Regla de parada:* Si alguna prueba falla o los contratos del Slice 1 no están intactos, informá el error y frená. Si todo coincide con la evidencia, procedé al Slice 2.

---

## FASE 1: OBJETIVO Y CONTRATO DEL SLICE 2

Implementar de forma determinista y bajo TDD estricto el **Micro-Benchmark Runner** y el **CLI de Benchmarking con Persistencia JSON**, midiendo rendimiento real sin alterar el modelo en producción ni el archivo `.env`.

### 1.1. Módulo Nuevo: `backend/benchmark_runner.py`
Crear el módulo con tipado estricto (`from __future__ import annotations`, dataclasses congeladas con `slots=True`):

```python
@dataclass(frozen=True, slots=True)
class ModelBenchmarkResult:
    hub_id: str
    short_label: str
    family: str                 # Valor string del ModelFamily
    memory_tier: str            # Valor string del MemoryTier
    device: str                 # "mps" | "cuda" | "cpu"
    cold_load_sec: float        # Tiempo de carga en memoria
    warmup_sec: float           # Tiempo de warm-up (primeros 32 tokens)
    throughput_wps: float       # Palabras por segundo en batch (mediana de corridas)
    peak_ram_mb: float          # Pico de memoria RAM/MPS durante la inferencia
    estimated_vocab_sec: float  # Proyección para vocabulario completo (10.338 palabras)
    timestamp_utc: str          # ISO 8601 UTC
```

- **Mazo de Evaluación Estándar (`DEFAULT_BENCHMARK_DECK`)**:
  - Definir una lista fija y determinista de 500 palabras y oraciones cortas (mezcla representativa EN y ES) embebida en el módulo o leída con fallback desde `public/vocab_en_es.txt` usando semilla fija `Random(42)`.
- **Función de Benchmark**:
  - `run_model_benchmark(selection: ModelSelection, device: str = "AUTO", deck: Sequence[str] | None = None) -> ModelBenchmarkResult`:
    1. Resuelve el dispositivo con `get_optimal_device(device)`.
    2. Mide `cold_load_sec` al instanciar `build_model(selection, device)`.
    3. Corre warmup con 32 tokens y mide `warmup_sec`.
    4. Ejecuta 3 corridas de codificación con el mazo de 500 tokens usando `encode_texts()`. En MPS ejecutar `torch.mps.synchronize()`.
    5. Toma la mediana de los tiempos de corrida para calcular `throughput_wps = 500.0 / median_sec`.
    6. Calcula `estimated_vocab_sec = round(10338.0 / throughput_wps, 2)`.
    7. Mide el incremento de memoria vía `psutil.Process().memory_info().rss` y `torch.mps.driver_allocated_memory()` (si aplica).
- **Persistencia Atómica (`backend/artifacts/benchmark_cache.json`)**:
  - `load_benchmark_cache(cache_path: Path | None = None) -> dict[str, ModelBenchmarkResult]`
  - `save_benchmark_cache(result: ModelBenchmarkResult, cache_path: Path | None = None) -> None`:
    - Escritura atómica mediante archivo temporal (`.tmp`) + `replace` para evitar corrupción ante interrupciones.
    - Estructura JSON indexada por `hub_id`.

### 1.2. CLI Nuevo: `scripts/benchmark_models.py`
Crear el CLI ejecutable desde la terminal:
- Argumentos:
  - `--model <hub_id | token>`: Evalúa un modelo o perfil específico (ej. `bge-m3`, `P1`, `M1`).
  - `--cached-only`: Evalúa únicamente los modelos presentes en el caché local de Hugging Face.
  - `--all`: Evalúa todos los modelos del catálogo (requiere conexión si faltan).
  - `--device <AUTO|MPS|CUDA|CPU>`: Fuerza el dispositivo.
  - `--json`: Emite el resultado exclusivamente en formato JSON estructurado.
- Salida por defecto en terminal:
  - Renderiza una tabla ASCII limpia con las columnas:
    `Model | Family | Tier | Device | Load (s) | Throughput (w/s) | Peak RAM | Est. Vocab (10k)`

---

## FASE 2: PROTOCOLO TDD (TESTS PRIMERO)

1. Crear `backend/tests/test_benchmark_runner.py`:
   - **Test de persistencia**: verificar que `save_benchmark_cache()` y `load_benchmark_cache()` serializan y deserializan fielmente todos los campos de `ModelBenchmarkResult`.
   - **Test de robustez de caché**: verificar que un archivo JSON corrupto o inexistente no arroja excepciones no controladas y retorna un diccionario vacío.
   - **Test de ejecución de benchmark**: correr `run_model_benchmark` sobre `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (usando un mazo pequeño en test para velocidad, ej. 50 tokens):
     - Assert `cold_load_sec > 0`
     - Assert `throughput_wps > 0`
     - Assert `estimated_vocab_sec > 0`
     - Assert `isinstance(result, ModelBenchmarkResult)`
2. Test de CLI:
   - Verificar que `python scripts/benchmark_models.py --json --model paraphrase-multilingual-MiniLM-L12-v2` retorna exit code 0 y un JSON parseable.

---

## FASE 3: VERIFICACIÓN Y CRITERIO DE ENTREGA

1. Correr `uv run pytest` en `backend/`. Todos los tests nuevos y existentes (piso: 113) deben pasar en verde.
2. Correr `npm test` en la raíz para garantizar cero regresión en frontend (426 tests).
3. Correr un benchmark real de prueba:
   ```bash
   PYTHONPATH=. uv run --directory backend python scripts/benchmark_models.py --model sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
   ```
   Verificar que la tabla se imprima correctamente y que `backend/artifacts/benchmark_cache.json` contenga la entrada guardada.
4. Reportar al usuario con formato auditable:
   - Salida exacta de `pytest` (cantidad de tests passed).
   - Tabla ASCII resultante del benchmark ejecutado en la máquina.
   - Contenido del JSON en `backend/artifacts/benchmark_cache.json`.
5. **Approval Gate**: No commitear ni mergear sin el OK explícito del usuario.
