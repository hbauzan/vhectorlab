# PROMPT DE EJECUCIÓN: SLICE 3 — INTEGRACIÓN EN SETUP.SH & SOFT-GATE DE MEMORIA

> **Rol del Agente:** Principal Software Architect y copiloto de ingeniería de lógica de alta densidad en VHectorLab 3D.  
> **Skill Obligatoria:** `.agents/skills/dev-protocol/SKILL.md` (seguir estrictamente).  
> **Principio Rector:** *"Antes de creer, ejecutar. Antes de responder, medir la premisa. Dato mata relato."* Cero complacencias, verificación primero.

---

## FASE 0: PRE-FLIGHT AUDIT OBLIGATORIO (CHECK DE ESTADO ACTUAL)

Antes de modificar o crear un solo archivo, ejecutá las siguientes verificaciones numéricas contra el repositorio en la rama `feat/hardware-inspector-taxonomy`:

1. **Auditoría de Suite Actual (Piso de Regresión)**:
   - Ejecutá `npm test` en la raíz. Afirmación previa: *55 test files passed, 426 tests passed (100%)*. Verificá que no haya tests rotos.
   - Ejecutá `uv run --directory backend pytest -q`. Afirmación previa: *127 passed (100%), 2 warnings, ~25s*. Verificá que la suite completa pase al 100%.
2. **Auditoría de Módulos Previos**:
   - Verificá que `backend/hardware_inspector.py` exporta `get_hardware_profile()`.
   - Verificá que `backend/benchmark_runner.py` exporta `load_benchmark_cache()`, `save_benchmark_cache()`, `run_model_benchmark()`.
   - Verificá que `scripts/benchmark_models.py` existe y ejecuta correctamente.
3. **Auditoría de Flujo Actual en `setup.sh`**:
   - Leé la función `select_embedding_model()` en `setup.sh` (líneas ~620 a 730).
   - Leé `backend/model_swap.py` (`format_menu_lines`, `describe_selection`, `apply_model_swap`).

*Regla de parada:* Si alguna prueba falla o los contratos previos no están intactos, informá el error y frená. Si todo coincide con la evidencia, procedé al Slice 3.

---

## FASE 1: OBJETIVO Y ESPECIFICACIÓN DEL SLICE 3

Conectar el **Hardware Inspector**, el **Micro-Benchmark Runner** y el **Soft-Gate de Memoria** dentro del flujo interactivo de la **Opción 11** de `setup.sh` (`select_embedding_model`).

### 1.1. Hardware Banner y Menú Enriquecido (`backend/model_swap.py` y `scripts/select_embedding_model.py`)
1. **Banner de Hardware**:
   - En `model_swap.py`, crear la función `format_hardware_banner(*, color: bool = True) -> list[str]`.
   - Llama a `get_hardware_profile()` y formatea:
     ```text
     ╔════════════════════════════════════════════════════════════╗
     ║  Live Host Hardware Profile                                ║
     ╚════════════════════════════════════════════════════════════╝
       • Platform & CPU:  Apple M4 (10 cores) · Darwin arm64
       • RAM Memory:      16.0 GB total · 6.5 GB free (disponible viva)
       • Accelerator:     mps · Apple Metal (MPS) (aceleración activa)
     ```
2. **Columnas de Familia, Tier y Throughput en el Menú**:
   - En `format_menu_lines()`, leer el caché existente vía `load_benchmark_cache()`.
   - Para cada entrada de perfil (`P#`) y modelo (`M#`), mostrar:
     - Token, título, familia, tier de memoria (`LIGERO`, `MEDIO`, `COMPLETO`).
     - Si el modelo tiene métricas en `benchmark_cache.json`, mostrar su throughput medido: ej. `⚡ 4387 w/s (2.4s vocab)`. Si no está medido, mostrar `—`.
   - Al pie del menú, indicar las opciones interactivas:
     ```text
       0) Cancelar
       B) Correr benchmark local [B = modelos en caché, B <token> = modelo específico, B all = catálogo]
       Elección [1-13 / P# / M# / B / 0]:
     ```

### 1.2. Sub-acción Interactiva de Benchmark `[B]` (`backend/model_swap.py` y `setup.sh`)
1. En `scripts/select_embedding_model.py` / `model_swap.py`:
   - Añadir subcomando o manejo de `benchmark` / `b`:
     - `python scripts/select_embedding_model.py benchmark [--target <token|cached|all>]`
     - Invoca `run_model_benchmark()` o llama directamente al runner de `scripts/benchmark_models.py`, actualizando `benchmark_cache.json` e imprimiendo la tabla resumen.
2. En `setup.sh` (`select_embedding_model`):
   - Si la elección del usuario comienza con `b` o `B` (ej. `b`, `B`, `B P1`, `B 4`):
     - Ejecuta la sub-acción de benchmark.
     - Imprime la tabla de resultados.
     - Permite presionar Enter y refresca el menú mostrando ahora los throughputs medidos en vivo.

### 1.3. Semáforo de Memoria y Soft-Gate (`backend/model_swap.py` y `setup.sh`)
1. Implementar la función de evaluación en `model_swap.py`:
   `evaluate_memory_gate(selection: ModelSelection, profile: HardwareProfile | None = None) -> tuple[str, str]`
   - Tiers y pesos estimados:
     - `LIGHT`: Peso base ~500 MB (requiere mínimo 500 MB libres, óptimo $\ge$ 1.0 GB).
     - `MEDIUM`: Peso base ~1.5 GB (requiere mínimo 1.5 GB libres, óptimo $\ge$ 3.0 GB).
     - `FULL`: Peso base ~3.0 GB (requiere mínimo 3.0 GB libres, óptimo $\ge$ 6.0 GB).
   - Retorna nivel (`OPTIMAL` | `TIGHT` | `WARNING`) y mensaje descriptivo con números reales (RAM libre vs peso estimado).
2. Comportamiento en `describe` y en `setup.sh`:
   - `OPTIMAL` (🟢): Procede con el swap normal.
   - `TIGHT` (🟡): Muestra advertencia informativa amarilla: `Memoria libre justa pero suficiente`. Procede con confirmación normal.
   - `WARNING` (🔴): Muestra alerta roja destacada:
     ```text
     ⚠️  ALERTA DE MEMORIA: El modelo seleccionado requiere ~3.0 GB pero solo hay 1.8 GB libres.
     Riesgo de swap a disco o lentitud en inferencia.
     ```
     Requiere confirmación explícita escribiendo `CONFIRMAR` o `y` para proceder.

---

## FASE 2: PROTOCOLO TDD (TESTS PRIMERO)

1. Crear o actualizar tests en `backend/tests/test_model_swap.py`:
   - **Test de Hardware Banner**: verificar que `format_hardware_banner()` contiene el chip, memoria en GB y acelerador reportados por `get_hardware_profile()`.
   - **Test de Menú Enriquecido**: verificar que `format_menu_lines()` incluye las familias, los tiers y los datos inyectados de benchmark cache.
   - **Test de Soft-Gate**:
     - Con 8 GB libres y modelo `LIGHT` -> `OPTIMAL`.
     - Con 1.8 GB libres y modelo `MEDIUM` -> `TIGHT`.
     - Con 800 MB libres y modelo `FULL` -> `WARNING`.
   - **Test de Tokens B**: verificar que `selection_from_menu_token` no colisiona con el comando `B` y que el despachador de CLI lo maneja limpiamente.
2. Actualizar tests de integración si aplica (`tests/select_embedding_model_cli.test.js`).

---

## FASE 3: VERIFICACIÓN Y CRITERIO DE ENTREGA

1. Correr suite completa de backend:
   ```bash
   uv run --directory backend pytest -v
   ```
   Todos los tests deben pasar en verde (piso anterior: 127).
2. Correr suite de frontend:
   ```bash
   npm test
   ```
   55 archivos, 426 tests en verde.
3. Smoke test manual e interactivo:
   - Ejecutar `uv run --directory backend python ../scripts/select_embedding_model.py list` y verificar que el banner de hardware y las columnas de familia/tier/throughput se muestren correctamente.
   - Ejecutar un swap simulado o real contra `MiniLM-multi` y verificar que `/health` siga respondiendo 200 OK.
4. Reportar al usuario con formato auditable:
   - Salida de `pytest`.
   - Captura en texto del menú renderizado con el banner y la sub-acción `[B]`.
   - Diff de contratos modificados.
5. **Approval Gate**: No commitear ni mergear sin el OK explícito del usuario.
