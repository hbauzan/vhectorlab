# Prompt — agente SAE Clean/Denoise (sparse projection)

Copiá y pegá el bloque siguiente en una sesión nueva. **Decisiones cerradas** en `roadmap/sae-denoise.md` (2026-08-02).

---

```text
Usando dev-protocol, ejecutá el roadmap SAE Clean/Denoise.

## Contexto
Repo: VectorLab 3D (Python/uv + Vite/Three.js).
Base: `main` actualizado (pull first). Incluí feat/zero-coverage si aún no está mergeado solo si hace falta — preferí main limpio + este epic.
Roadmap canónico (leelo COMPLETO antes de codear):
  `roadmap/sae-denoise.md`
Lecciones: `.agents/skills/dev-protocol/lessons-learned.md`
  (§4 paneles/docks, §4.9 viz controls, §6.1 /api proxy, §7 SemVer MAJOR).

## Decisiones YA CERRADAS (no re-preguntar)
- U1: CTA 50/50 — Calculate|Clean/Denoise (SAE) y Visualize|Clean/Denoise (SAE).
- U2: Label exacto `Clean/Denoise (SAE)`.
- U3: Toggle; U4: localStorage `vl3d.sae.*`; U5: params Expansion + Top-K en UI.
- M1: Replace (6A) — SAE ON reemplaza vectores en 3D + Top-10/cosine; OFF restaura raw cacheado.
- M2: Todos los vectores Arithmetic + Compare.
- A1–A6: Proyección SAE-style determinística (W sinusoidal) → ReLU → Top-K; viz en espacio expandido M; métricas L0/sparsity/active features; cosine sobre z sparse.
- B1–B4: Backend `/api/sae/project`; lazy W (9A); batch + progress (texto + pasos); no entrenar red.
- X1: Sin Gemini labels, sin SAE neural entrenado, sin dual view, sin train UI.
- V1: Ship **2.0.0** MAJOR.

## Objetivo
Backend pure projection + API; UI toggle/params/progress; replace pipeline; docs + v2.0.0.

## Fuera de alcance
roadmap/archivo/** (salvo notar supersede del “NO SAE”), Gemini concept naming, trained SAE, dual 3D.

## Flujo
1. Branch `feat/sae-denoise` (or stages A/B/C in roadmap §9).
2. TDD `backend/sae/projection.py` + pytest; wire `/api/sae/project`.
3. UI 50/50 + defaults/localStorage + progress.
4. App state raw/sae cache; refreshRender + lists; metrics strip.
5. CONTEXT + lessons + CHANGELOG; bump 2.0.0.
6. pytest + vitest green; smoke §6–§7.
7. APPROVAL GATE — how to test; wait for explicit OK before push/merge.

## Criterios de aceptación
Checklist §7 del roadmap (todos).

## Cómo probar
1. `uv run` backend + `npm run dev`.
2. Arithmetic: Calculate → toggle SAE → progress → threads show sparse peaks (length M); Top-10 changes; OFF restores.
3. Compare: Visualize batch → SAE ON → progress i/N → all threads sparse; cosine updates.
4. Change Top-K / Expansion while ON → reproject with progress; reload persists toggle/params.

## Estilo
No-fluff; deep modules; don’t expand scope; don’t re-ask closed IDs.
```

---

## Notas para el humano

- Esto **no** es un SAE neuronal entrenado: es el mismo truco del otro producto (W sinusoidal + Top‑K). El roadmap lo nombra “SAE-style” a propósito.
- v**2.0.0** porque cambia el contrato de lo que se visualiza/métrica cuando el toggle está ON.
- Etiquetado Gemini de features = fuera de v1 (X1).
