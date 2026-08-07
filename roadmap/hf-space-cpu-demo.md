# Roadmap — Hugging Face Space (Docker) · cpu-basic demo

**Status:** Implemented (`feat/hf-space-cpu-demo`) — approval gate before merge  
**Date:** 2026-08-07  
**Product:** VHectorLab 3D / VectorLab 3D  
**Hardware target:** Hugging Face **`cpu-basic`** (gratis)  
**Trigger:** Setup menú opciones **7** (build) + **8** (publish) — flujo Docker Space end-to-end  
**Out of scope:** ZeroGPU (no aplica a Docker Spaces), GPU dedicada de pago, Inference Providers como producto principal

> **Do not re-ask closed decisions** below.  
> Spec legacy relacionada: `roadmap/archivo/big-picture.md` §6 (APP_MODE=demo / 2 GB) — **parcialmente obsoleta**; este doc manda.

---

## 0. Goal (one sentence)

Dejar el Space Docker en **cpu-basic** listo para demo pública: boot rápido, features actuales usables, setup 7+8 que realmente publique, status con **CPU/GPU**, y modo **ARITHMETIC 100% funcional con persistencia por visitante**.

---

## 0.1. Closed decisions (authoritative)

| ID | Topic | Decision |
| :--- | :--- | :--- |
| **H1** | Hardware | Solo **`cpu-basic`** gratis. No diseñar para ZeroGPU ni GPU paga en v1 de este epic. |
| **H2** | Rol del Space | **Demo pública** — priorizar cold start, RAM y latencia percibida de lo que ya existe. |
| **H3** | ARITHMETIC | Debe ser **100% funcional** en el Space (Calculate → vecinos → 3D → telemetry). |
| **H4** | Persistencia ARITHMETIC | **Por usuario = por navegador** vía `localStorage` (visitante anónimo en HF). No DB multi-tenant en el Space. |
| **H5** | Qué se persiste (ARITHMETIC) | Inputs `wordA/B/C`, `topK`, último payload de resultado (o lo mínimo para rehidratar UI + 3D sin re-calcular al volver), preferencias de render del modo que ya use el usuario en Arithmetic. Prefijo `vl3d.arithmetic.*`. |
| **H6** | Estado servidor | Model + vocab embeddings = **compartidos** (read-mostly). Correcto. No guardar resultados Arithmetic en disco del Space (sería global entre visitantes). |
| **H7** | Setup | **Implementar** unificación 7↔8 (crear/configurar Space Docker + push). Nada de “solo documentar”. |
| **H8** | Status UI | Extender `/health` + navbar: además de online + model → **`cpu` / `cuda` / `mps`**. |
| **H9** | Torch en imagen HF | **CPU wheels** (ver §1 opciones; **recomendación = Opción A**). |
| **H10** | Vocab en demo | **Precomputar** embeddings de vocab en build o artefacto committed (`.npz`/`.npz`), no encodear ~10k tokens en cada cold start del Space. |
| **H11** | Modelo demo | Mantener `all-mpnet-base-v2` salvo que medición de RAM lo impida; entonces fallback documentado en código (`MODEL_NAME` env) — no inventar InferenceClient remoto salvo que A falle en medición. |
| **H12** | Producción container | `reload=False` cuando `HOST/PORT` Docker (o env `UVICORN_RELOAD=0`). |
| **H13** | Offline UX | Mensajes sin hardcode `127.0.0.1:8000`; copy válido en Space y local. |
| **X1** | Fuera de este epic | Reescribir Compare/SAE para multi-tenant server; pagos GPU; Gradio; ZeroGPU. |

---

## 1. Empaquetado PyTorch / imagen (opciones)

El `uv.lock` actual en Linux resuelve **torch + stack NVIDIA**. En cpu-basic eso infla build, disco y RAM sin beneficio.

### Opción A — Torch CPU-only en la imagen Space (recomendada)

| | |
| :--- | :--- |
| **Qué** | En Docker/HF: instalar `torch` desde el index CPU de PyTorch (`https://download.pytorch.org/whl/cpu`) o constraint equivalente vía `uv`, sin `nvidia-*`. |
| **Pros** | Imagen mucho más chica; menos RAM al importar; alinea con H1; build más rápido en Hub. |
| **Contras** | Lock/resolución distinta local (macOS MPS) vs Linux CPU — hay que **aislar** deps de imagen (override en Dockerfile o `pyproject` optional/group `hf-cpu`) sin romper el flujo bare-metal Mac. |
| **Riesgo** | Medio (tooling uv/index) — mitigable con smoke test `docker build` + import torch sin CUDA. |

### Opción B — Dejar CUDA wheels y “igual corre en CPU”

| | |
| :--- | :--- |
| **Qué** | No tocar deps; runtime cae a CPU. |
| **Pros** | Cero trabajo de resolución. |
| **Contras** | Imagen gigante; riesgo de quota/disk en Hub; cold start peor; absurdo en cpu-basic. |
| **Veredicto** | **Rechazada** para este epic. |

### Opción C — Modelo fuera del contenedor (InferenceClient / Providers)

| | |
| :--- | :--- |
| **Qué** | Embeddings vía API remota HF; contenedor solo sirve UI + nearest-neighbor sobre vectors precomputados o remotos. |
| **Pros** | RAM mínima en el Space. |
| **Contras** | Latencia de red, tokens/rate limits, ARITHMETIC deja de ser self-contained; más superficie de auth (`HF_TOKEN`). Choca con “demo que vuele” si la red falla. |
| **Veredicto** | **Plan B solo si** Opción A + vocab precomputado **sigue** OOMeando en medición real. No es el default. |

### Recomendación

**Opción A + H10 (vocab `.npz`)** + `.dockerignore` agresivo.  
Medir RAM post-boot una vez; solo entonces evaluar Opción C o modelo más chico.

---

## 2. Persistencia ARITHMETIC (detalle)

### Problema hoy

`AppState` (frontend) guarda `wordA/B/C` y `arithmeticData` **solo en RAM de la pestaña**. Docks/viz/SAE sí usan `localStorage`; Arithmetic **no**. En un Space demo el usuario refresca y pierde el experimento.

### Contrato

| Clave (ejemplo) | Contenido |
| :--- | :--- |
| `vl3d.arithmetic.wordA` / `wordB` / `wordC` | strings |
| `vl3d.arithmetic.topK` | number |
| `vl3d.arithmetic.lastResult` | JSON del último response `/arithmetic` (o null) |
| (opcional) `vl3d.arithmetic.renderMode` | si no vive ya en otro prefix |

### Comportamiento

1. Al load: hidratar form + si hay `lastResult`, reponer 3D/lista sin re-fetch (botón Calculate sigue disponible).
2. Tras Calculate OK: persistir inputs + result.
3. Clear/reset (si existe): borrar keys del prefix.
4. Tests Vitest con `Storage` inyectable (mismo patrón que viz/SAE/docks).
5. **No** escribir resultados Arithmetic en filesystem del contenedor.

### Multi-visitante en HF

- Cada browser = un usuario lógico. OK para demo.
- Backend `/arithmetic` sigue **stateless**. OK.
- No mezclar con checkpoint SAE en disco (Compare): queda como está; eventual aislamiento SAE multi-tenant es **X1**.

---

## 3. Setup opciones 7 y 8 (implementar)

### Hoy (roto como flujo)

- **7:** `docker build` local → tag `vhectorlab-3d:latest`. No sube a HF.
- **8:** `npm run build` + `git push` a `spaces/$id` sin crear Space, sin `sdk: docker`, sin hardware.

### Target

| Paso | Comportamiento |
| :--- | :--- |
| **7** | Build local de la imagen **idéntica** a la que usará el Space (Dockerfile + `.dockerignore` + CPU torch). Opcional: `docker run -p 7860:7860` smoke (`/health` → device cpu). |
| **8** | Wizard que: pide `namespace/name` → asegura login `hf` → **crea** Space si no existe (`--space-sdk docker`, flavor cpu-basic) → asegura README YAML `sdk: docker` en el push → `git push` (o `hf upload`) del árbol necesario → imprime URL del Space. |
| **README Space** | Frontmatter mínimo: `title`, `sdk: docker`, `app_port: 7860` (o el contrato actual de HF Docker). |

HF **buildea desde git** en Docker Spaces; la opción 7 valida localmente, la 8 publica el **código + Dockerfile**, no un registry privado salvo que más adelante se quiera.

---

## 4. Status ONLINE · model · device

### Backend `/health`

Ampliar payload (campos nuevos, no romper los viejos):

```json
{
  "status": "ok",
  "model": "all-mpnet-base-v2",
  "vocab_size": 9858,
  "is_loaded": true,
  "device": "cpu"
}
```

`device` = resolución única al load (misma lógica que `get_optimal_device` / device real del `SentenceTransformer` o torch). En cpu-basic → siempre `"cpu"`.

### Frontend navbar

Texto tipo: `ONLINE (all-mpnet-base-v2 · cpu)`.  
Mobile: si el texto se oculta, device en `title`/tooltip del dot como mínimo.

---

## 5. Demo performance (para que “vuele”)

Orden de impacto esperado:

1. **Vocab precomputado** al build → elimina encode de ~9858 palabras en cada arranque.
2. **Torch CPU** → menos I/O/RAM.
3. **`.dockerignore`** → builds Hub más cortos.
4. **`reload=False`** → menos procesos.
5. Cache HF (`HF_HOME` / layer cache) si el modelo se descarga en build (`RUN` encode o `hf download`) para no pegarle al Hub en runtime.

ARITHMETIC en caliente ya es NN sobre matriz en RAM: con vocab listo al boot, Calculate debe sentirse instantáneo en cpu-basic.

---

## 6. Pulido obligatorio (H12–H13 + higiene)

| Ítem | Acción |
| :--- | :--- |
| Uvicorn | Sin reload en contenedor / Space. |
| Offline modal | Mensaje neutro (“backend unavailable / start via setup”) sin URL local fija, o URL derivada de `VITE_API_BASE_URL`. |
| `.dockerignore` | Excluir `.venv`, `node_modules`, `.git` (según estrategia de push), tests caches, `roadmap/archivo` opcional, logs. |
| Docs de producto | Solo lo que el **documentation sync** del protocol pida al cerrar el epic (CHANGELOG / CONTEXT si cambia contrato). El roadmap no sustituye implementación. |

---

## 7. Phases (orden de implementación)

### Phase A — Packaging & boot (bloqueante demo)

1. `.dockerignore`
2. Dockerfile: torch CPU (Opción A), `SAE_DEVICE=CPU` o `AUTO`, `HOST/PORT`, sin reload
3. Artefacto vocab embeddings precomputado + load path en `AppState` (fallback: encode si falta el archivo — local DX)
4. Smoke: build + run :7860 + `/health`

### Phase B — Health device + UI badge

1. `/health.device` + tests
2. Navbar `ONLINE (model · device)`

### Phase C — ARITHMETIC persistencia por visitante

1. Módulo defaults/storage `vl3d.arithmetic.*`
2. Hydrate form + lastResult en `main` / Sidebar
3. Persist on success; tests

### Phase D — Setup 7 + 8 end-to-end

1. Opción 7: build (+ optional run smoke)
2. Opción 8: `hf` create Space docker + cpu-basic + push + URL
3. README YAML docker en repo (o generado en publish)

### Phase E — UX Space

1. Offline copy
2. Pass completo: Arithmetic calculate + refresh browser → estado intacto; Compare “best effort” demo (sin garantía multi-tenant SAE)

---

## 8. Acceptance checklist

- [ ] `docker build` completa en máquina local sin wheels NVIDIA en la imagen final (o verificación equivalente).
- [ ] Contenedor en `:7860`: `/health` → `is_loaded: true`, `device: "cpu"`, vocab_size > 0.
- [ ] Cold start aceptable para demo (sin encode completo de vocab en runtime).
- [ ] Navbar muestra model **y** device.
- [ ] ARITHMETIC: Calculate OK; refresh; inputs + visualización restaurados desde `localStorage`.
- [ ] Opción 7 construye; opción 8 crea/publica Space Docker cpu-basic (o actualiza uno existente) y deja URL usable.
- [ ] Offline modal no miente con `127.0.0.1:8000` en contexto Space.
- [ ] Tests backend/frontend verdes para health device + arithmetic persistence.

---

## 9. Risks & mitigations

| Risk | Mitigation |
| :--- | :--- |
| RAM aún justa con mpnet + matriz vocab | Medir; vocab float16/npz; o modelo más chico vía env; Opción C último recurso |
| uv index CPU vs lock Mac | Group/override solo en Docker; CI o script de verificación de imagen |
| Opción 8 auth HF | Requiere `hf auth login`; wizard falla claro si no hay token |
| SAE Compare shared disk en Space | Aceptado en demo (X1); no bloquear epic |
| Checklist legacy “2 GB” / “opción 6” | Ignorar; este doc + menú actual (7/8) |

---

## 10. Non-goals (explicit)

- No Gradio rewrite.
- No ZeroGPU / `@spaces.GPU`.
- No facturación GPU.
- No persistencia Arithmetic server-side.
- No prometer SAE Compare aislado por usuario en el Space gratis.
