# Prompt — agente Top‑K SAE Clean/Denoise (trained)

Copiá y pegá el bloque siguiente en una sesión nueva. **Decisiones cerradas** en `roadmap/sae-denoise.md` (2026-08-02).  
**Importante:** esto es un **Top‑K SAE real (PyTorch, entrenado)**, NO la proyección sinusoidal descartada.

---

```text
Usando dev-protocol, ejecutá el roadmap Top‑K SAE Clean/Denoise.

## Contexto
Repo: VectorLab 3D (Python/uv + Vite/Three.js).
Base: `main` actualizado (pull first).
Roadmap canónico (leelo COMPLETO antes de codear):
  `roadmap/sae-denoise.md`
Lecciones: `.agents/skills/dev-protocol/lessons-learned.md`
  (§4 docks/UI, §6.1 /api proxy, §7 SemVer MAJOR 2.0.0).

## Decisiones YA CERRADAS (no re-preguntar)
- U1–U5: CTA 50/50 `Clean/Denoise (SAE)` toggle; localStorage; params/train UI; progress.
- M1–M2: Replace all Arithmetic+Compare vectors when SAE ON; cache raw 768.
- A1–A7: Real Top‑K SAE (grandmother port): 768→8192, k=32, ReLU+TopK FP32, untied unit-norm decoder, train MSE; viz uses encode activations.
- B1–B6: Backend PyTorch; lazy load; /api/sae/status|train|encode; train on vocab embeddings; checkpoint under backend/artifacts/.
- F1: raw_i vs sae_i key isolation if needed.
- X1: No Gemini labels; no sinusoidal fake SAE; no dual mesh.
- V1: Ship **2.0.0**.

## Objetivo
Port TopKSAE + SAEManager + train_sae; wire API; UI toggle/train/progress; replace render pipeline; docs + v2.0.0.

## Fuera de alcance
Sinusoidal “SAE-style”, Gemini feature naming, dual RAW+SAE 3D, PDF relief-matrix from grandmother (use vocab matrix instead).

## Flujo
1. Branch `feat/topk-sae-denoise`.
2. Stage A: model+train+pytest.
3. Stage B: FastAPI routes + progress.
4. Stage C: UI 50/50 + encode replace + metrics.
5. Docs/CHANGELOG/CONTEXT/lessons; bump 2.0.0.
6. pytest + vitest green; smoke §6–§7.
7. APPROVAL GATE — wait for explicit OK before push/merge.

## Criterios de aceptación
Checklist §7 del roadmap.

## Cómo probar
1. Backend + frontend.
2. Train SAE on vocab (progress epochs).
3. Arithmetic Calculate → toggle SAE → threads length 8192 sparse; OFF → 768.
4. Compare Visualize → SAE ON batch encode with progress; cosine updates.
5. Reload: status is_trained; toggle preference restored.

## Estilo
No-fluff; deep modules; port grandmother numerics faithfully; don’t re-ask closed IDs.
```

---

## Notas para el humano

- La abuela ya tenía el SAE **serio** (Top‑K entrenado). El paste sinusoidal de otra herramienta era un atajo distinto — **descartado**.
- Entrenamiento v1 = matriz de vocab del backend, no PDFs.
- Pegá este prompt en sesión limpia tras mergear lo pendiente a `main` si hace falta.
