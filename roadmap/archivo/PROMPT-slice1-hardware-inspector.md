# PROMPT DE EJECUCIÓN: SLICE 1 — HARDWARE INSPECTOR & TAXONOMÍA DE FAMILIAS

> **Rol del Agente:** Principal Software Architect y copiloto de ingeniería de lógica de alta densidad en VHectorLab 3D.  
> **Skill Obligatoria:** `.agents/skills/dev-protocol/SKILL.md` (seguir estrictamente).  
> **Principio Rector:** *"Antes de creer, ejecutar. Antes de responder, medir la premisa. Dato mata relato."* Cero complacencias, verificación primero.

---

## FASE 0: PRE-FLIGHT AUDIT OBLIGATORIO (CHECK DE SUPOSICIONES PREVIAS)

Antes de modificar o crear un solo archivo, ejecutá las siguientes verificaciones numéricas contra la máquina y el repositorio. Si encontrás CUALQUIER discrepancia con las afirmaciones del agente anterior, **DETENTE INMEDIATAMENTE y reportale la discrepancia al usuario para que la aclare o redacte**:

1. **Auditoría de Suite Actual (Piso de Regresión)**:
   - Ejecutá `npm test` en la raíz. Afirmación previa: *55 test files passed, 426 tests passed (100%)*. Verificá que no haya tests rotos.
   - Ejecutá `uv run pytest` dentro del directorio `backend/`. Afirmación previa: *94 passed (100%)*. Verificá que la suite de Python pase al 100%.
2. **Auditoría de Hardware Real**:
   - Ejecutá `sysctl -n machdep.cpu.brand_string; sysctl -n hw.memsize; sysctl -n hw.ncpu` (o comandos equivalentes del sistema). Afirmación previa: *Apple M4, 16 GB RAM (17179869184 bytes), 10 núcleos*.
   - Ejecutá `uv run --directory backend python -c "import torch; print('MPS:', torch.backends.mps.is_available(), 'Built:', torch.backends.mps.is_built())"`. Afirmación previa: *MPS available: True, MPS built: True*.
3. **Auditoría de Contratos Existentes**:
   - Leé `roadmap/hardware-aware-model-selector-benchmark.md`.
   - Leé `backend/model_catalog.py` (líneas 1 a 120). Verificá la estructura actual de `_ModelEntry` y la lista de modelos `_MODELS`.
   - Leé `.agents/skills/dev-protocol/SKILL.md` y `lessons-learned.md`.

*Regla de parada:* Si alguna prueba falla o los datos de hardware no coinciden, informá los números exactos medidos y frená. Si todo coincide con la evidencia, procedé al Slice 1.

---

## FASE 1: OBJETIVO Y CONTRATO DEL SLICE 1

Implementar de forma determinista y bajo TDD estricto el **Hardware Inspector** y la **Taxonomía de Familias y Tiers de Memoria**, enriqueciendo el catálogo de modelos sin romper ningún consumidor existente (`model_swap.py`, `/health`, tests).

### 1.1. Módulo Nuevo: `backend/hardware_inspector.py`
Crear el módulo con tipado estricto (`from __future__ import annotations`, dataclasses congeladas con `slots=True`):

```python
@dataclass(frozen=True, slots=True)
class HardwareProfile:
    platform_name: str          # "Darwin", "Linux", "Windows"
    cpu_brand: str              # e.g. "Apple M4"
    cpu_cores: int              # Número entero >= 1
    total_ram_bytes: int        # Entero en bytes
    available_ram_bytes: int    # Entero en bytes (medido en tiempo real)
    accelerator: str            # "mps" | "cuda" | "cpu"
    accelerator_device_name: str # e.g. "Apple Metal (MPS)", "NVIDIA CUDA", "Host CPU"
    is_accelerated: bool        # True si accelerator in ("mps", "cuda")
```

- Función principal: `get_hardware_profile() -> HardwareProfile`.
- Lógica de detección:
  - RAM: Usar `psutil.virtual_memory()` (agregar `psutil` a `backend/pyproject.toml` vía `uv add psutil --directory backend` si no está presente).
  - CPU: `platform.processor()` / `sysctl` en Darwin / `/proc/cpuinfo` en Linux.
  - Acelerador: Verificar en orden:
    1. Si `torch.backends.mps.is_available()` y `torch.backends.mps.is_built()` -> `mps` (`"Apple Metal (MPS)"`).
    2. Si `torch.cuda.is_available()` -> `cuda` (`torch.cuda.get_device_name(0)`).
    3. Fallback -> `cpu` (`"Host CPU"`).

### 1.2. Extensión de `backend/model_catalog.py`
1. Definir Enums tipados:
   ```python
   class ModelFamily(str, Enum):
       BAAI = "BAAI"
       SNOWFLAKE = "Snowflake"
       ALIBABA = "Alibaba"
       INTFLOAT = "Intfloat (E5)"
       UKPLAB = "UKPLab (Sentence-Transformers)"
       GOOGLE = "Google"

   class MemoryTier(str, Enum):
       LIGHT = "LIGERO (<500MB)"
       MEDIUM = "MEDIO (500MB-1.5GB)"
       FULL = "COMPLETO (>1.5GB)"
   ```
2. Extender `_ModelEntry`:
   - Agregar campos `family: ModelFamily` y `memory_tier: MemoryTier`.
3. Extender `ModelSelection`:
   - Agregar `family: ModelFamily` y `memory_tier: MemoryTier`.
4. Mapear explícitamente TODOS los modelos de `_MODELS`:
   - `sentence-transformers/all-mpnet-base-v2`: `UKPLAB`, `MEDIUM`
   - `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`: `UKPLAB`, `LIGHT`
   - `Snowflake/snowflake-arctic-embed-m-v2.0`: `SNOWFLAKE`, `MEDIUM`
   - `Alibaba-NLP/gte-multilingual-base`: `ALIBABA`, `MEDIUM`
   - `intfloat/multilingual-e5-small`: `INTFLOAT`, `LIGHT`
   - `google/embeddinggemma-300m`: `GOOGLE`, `LIGHT`
   - `sentence-transformers/paraphrase-multilingual-mpnet-base-v2`: `UKPLAB`, `MEDIUM`
   - `intfloat/multilingual-e5-base`: `INTFLOAT`, `MEDIUM`
   - `sentence-transformers/distiluse-base-multilingual-cased-v2`: `UKPLAB`, `MEDIUM`
   - `BAAI/bge-m3`: `BAAI`, `FULL`
5. Exponer `family` y `memory_tier` en las funciones públicas `list_models()`, `get_model()` y `resolve_selection()`.

---

## FASE 2: PROTOCOLO TDD (TESTS PRIMERO)

1. Crear `backend/tests/test_hardware_inspector.py`:
   - Test de contrato: verificar que `get_hardware_profile()` retorna una instancia válida de `HardwareProfile` con valores consistentes (`total_ram_bytes > 0`, `available_ram_bytes > 0`, `cpu_cores >= 1`).
   - Test de coherencia con PyTorch: el valor de `accelerator` debe coincidir con `torch.backends.mps.is_available()` o `torch.cuda.is_available()`.
   - Test determinista de tipos y atributos congelados (inmutabilidad).
2. Actualizar `backend/tests/test_model_catalog.py`:
   - Test exhaustivo: asegurar que el 100% de las entradas en `list_models()` y los perfiles en `list_profiles()` tienen asignados un `family` de tipo `ModelFamily` y un `memory_tier` de tipo `MemoryTier`.
   - Test de regresión: verificar que `resolve_selection()` conserva los atributos existentes y agrega los nuevos sin alterar las firmas esperadas por `model_swap.py`.

---

## FASE 3: VERIFICACIÓN Y CRITERIO DE ENTREGA

1. Correr `uv run pytest` en `backend/`. Todos los tests nuevos y existentes deben pasar en verde.
2. Correr `npm test` en la raíz para garantizar cero regresión en el frontend.
3. Reportar al usuario con formato auditable:
   - Comando ejecutado y salida numérica exacta de tests.
   - Medición real arrojada por `get_hardware_profile()` en la máquina local.
   - Diff de contratos modificados.
4. **Approval Gate**: No commitear ni mergear sin el OK explícito del usuario.
