# Prompt — agente Shared noise ship + coverage A/mA knobs

Copiá y pegá el bloque siguiente en una sesión **nueva**.  
Roadmap: [`shared-noise-coverage-knobs.md`](./shared-noise-coverage-knobs.md) (2026-08-26).  
Predecessor archivado (parcial): [`archivo/shared-noise-common-mode.md`](./archivo/shared-noise-common-mode.md).

**Modo de trabajo:** **serial** — una sesión / un slice. No agentes en paralelo.  
Empezá por **Slice 1** salvo que el humano diga otro.

---

```text
Usando dev-protocol, ejecutá el roadmap Shared noise ship + coverage A/mA knobs.

## Contexto
Repo: VHectorLab 3D / vhectorlab (Python/uv + Vite/Three.js).
Base: `main` actualizado (git pull first si aplica).
Roadmap canónico — leelo COMPLETO antes de cualquier código:
  `roadmap/shared-noise-coverage-knobs.md`
Predecessor (solo contexto histórico / D1–D13 métrica):
  `roadmap/archivo/shared-noise-common-mode.md`
Lecciones: `.agents/skills/dev-protocol/lessons-learned.md`
  — §2 z-score/tanh (métrica Shared noise = valores crudos del embedding visualizado, NO t normalizado);
  §4.8 COMPARE groups; §4.11b group paint; §4.11c Group hue; §7 SemVer.
Módulos: SKILL.md + code-design.md + documentation.md + git-workflow.md.
UI viva: `src/main.js`, `src/ui/*`, `src/visualizer/*`, `src/theme/`. No `/v25/` ni `/amiga/`.

## WIP bootstrap (OBLIGATORIO antes de codear)
1. `git status` + `git branch` + `git diff --stat`.
2. Si hay cambios de engine/100%/input editable: ponelos en rama
   `feat/shared-noise-coverage-knobs` (o continuá `feat/shared-noise-common-mode`).
   No los tires. Conservá techo 100%.
3. Si el árbol está limpio: re-implementá Slice 1 desde el roadmap (TDD).
4. No asumas que Slice 1 ya mergeó a main — probablemente no.

## Decisiones YA CERRADAS (no re-preguntar)
### Métrica Shared noise
- Pregunta: ¿esta dim se parece en TODOS los tokens del Compare?
- groupId no entra; min/max por dim; sharedNoiseSimilarity; 0 cuenta como +.
- Solo paint; persist sameSignCancel* / zero coverage keys; default OFF + 30%.
- Sign conflict sigue G1↔G2. Galaxy no-op. Arithmetic fuera.

### UI Shared noise (Slice 3)
- Bloque después de Zero coverage, fuera de Group contrast.
- Gate ≥2 tokens con embedding. Conflict/hue ≥2 grupos.

### Coverage A/mA knobs (Slice 2) — Zero coverage Y Shared noise
- Techo 30…100% (C1). c=1 permitido en paint/remap.
- Un solo % persistido; knobs = proyección.
- A = enteros (amperes); mA = décimas 0.0…0.9 (milliamperes).
- Readout único editable; 100→A100/mA0; 99.9→A99/mA0.9.
- Clamp least-effort en el borde.
- Knob = slider disfrazado (NO drag angular real).
- Lerp visual corto del ángulo al editar readout.
- Labels A / mA + tips (i) cortos claros EN.
- Estilo Magic Workbench 3.0 elegante; knob grande + chico al costado.
- Layout barato: readout + knobs; mobile side-by-side si cabe.
- Reemplazar el experimento “input numérico + slider largo”.

### Docs / voz
- CHANGELOG + mensaje de commit: nota EN autoirónica (roadmap T1/T2) —
  studio gear cosplay on Workbench; shipping anyway vs one bad top-end slider.
- SemVer PATCH 2.4.2 → 2.4.3 al ship (salvo que el humano pida MINOR).

## Slice a ejecutar en ESTA sesión
Slice 1 — Engine token-batch + techo 100% (verificar WIP o implementar).

Si el humano indica Slice 2 o 3, hacé SOLO ese.
No adelantar el slice siguiente.

### DoD — Slice 1
1. hasEnoughTokensForSharedNoise + computeTokenSharedNoiseMetrics (TDD).
2. Casos: <2 tokens []; 1 grupo ok; 3 grupos usa todos (outlier bloquea); mixed → cancel 0.
3. paintWeightsForDim(token, group, settings): cancel←token; highlight←group.
4. Instancer/POINTS/RIBBONS pasan ambas métricas.
5. HIGH_COVERAGE_MAX=100; cancel/remap aceptan c=1.
6. npm test verde. Sin Python salvo error real.
7. APPROVAL GATE + cómo probar. ESPERÁ OK. No push/merge.

### DoD — Slice 2 (solo si lo piden)
1. Helpers compose/decompose A+mA ↔ percent (TDD).
2. Knobs Workbench en Zero coverage + Shared noise; readout editable sync + lerp.
3. Tips fieldInfo A/mA; quitar UX rechazada del input+slider dominante.
4. npm test verde. APPROVAL GATE. No push/merge.

### DoD — Slice 3 (solo si lo piden)
1. Mover Shared noise tras Zero coverage; Group contrast = conflict + hue.
2. Gate ≥2 tokens (main.js + VisualizationControls).
3. CONTEXT, CHANGELOG (con T2), lessons §4.11b; bump 2.4.3.
4. Smoke roadmap §6. APPROVAL GATE → OK → git-workflow.md §3
   (commit message incluye la nota T2).

## Cómo probar (mínimo, Slice 1)
1. Dev server. COMPARE con ≥2 GROUP_* (gate UI de 1 grupo es Slice 3).
2. Shared noise ON ~30%: bandas chatas se apagan; signos mezclados no.
3. Tres grupos: G1≈G2 y G3 al contrario → dim NO se apaga.
4. Sign conflict sigue G1↔G2. Y igual ON/OFF.

## Estilo
No-fluff. TDD. Módulo profundo. No expandir scope.
Ante duda de contrato: preguntá — no adivines.
Ciclo: clarify (solo si contradice decisiones cerradas) → branch → implement → verify
  → docs (Slice 3) → approval gate → git delivery tras OK.
```

---

## Notas para el humano

1. Pegá el prompt en **chat nuevo** con el repo a mano (el WIP puede estar sin commit en el working tree).
2. **Slice 1** = métrica. **Slice 2** = knobs A/mA. **Slice 3** = mover control + gate + ship.
3. OK explícito (“ok”, “dale”, “mergealo”) para push/merge. Un thumbs-up a otra cosa no cuenta.
4. La nota de “seriedad / studio gear” va en **commit + CHANGELOG** al ship (Slice 3).
