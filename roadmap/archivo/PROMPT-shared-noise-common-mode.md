# Prompt — agente Shared noise common-mode

> **Archivado:** 2026-08-26 — no usar. Sucesor: [`../PROMPT-shared-noise-coverage-knobs.md`](../PROMPT-shared-noise-coverage-knobs.md).

Copiá y pegá el bloque siguiente en una sesión **nueva**.  
Roadmap: [`shared-noise-common-mode.md`](./shared-noise-common-mode.md) (2026-08-26).

**Modo de trabajo:** **serial** — una sesión / un slice. No lanzar agentes en paralelo.  
Empezá por **Slice 1** salvo que el humano diga otro.

---

```text
Usando dev-protocol, ejecutá el roadmap Shared noise common-mode.

## Contexto
Repo: VHectorLab 3D / vhectorlab (Python/uv + Vite/Three.js).
Base: `main` actualizado (git pull first si aplica).
Roadmap canónico — leelo COMPLETO antes de cualquier código:
  `roadmap/shared-noise-common-mode.md`
Lecciones: `.agents/skills/dev-protocol/lessons-learned.md`
  — §2 z-score/tanh (NO uses t normalizado para esta métrica; valores crudos del embedding visualizado);
    §4.8 COMPARE groups; §4.11b group paint (hoy G1↔G2 — este epic lo parte);
    §4.11c Group hue encima sigue igual; §7 SemVer.
Módulos del protocolo: SKILL.md + code-design.md (TDD, deep module, vertical slice)
  + documentation.md (sync condicional) + git-workflow.md (approval gate).
UI viva: `src/main.js`, `src/ui/*`, `src/visualizer/*`. No reintroducir `/v25/` ni `/amiga/`.

## Decisiones YA CERRADAS (no re-preguntar)
- Shared noise pregunta: “¿esta dim se parece en TODOS los tokens del Compare actual?”
- NO es acuerdo de centros de grupo. groupId no entra en la métrica.
- Por dim: min y max de item.embedding[d]; sim = sharedNoiseSimilarity(min, max); 0 cuenta como +.
- Un token outlier bloquea el hide temprano (por eso min/max, no más promedios).
- Slider/toggles/persistencia existentes (sameSignCancel*). Default OFF, coverage 30%.
- Solo paint → negro; Y, X, dim-sort, ruler, hover crudo: no tocar.
- Label sigue “Shared noise”. Mover el bloque a después de Zero coverage, fuera de Group contrast.
- Gate Shared noise: Compare + ≥2 tokens con embedding. Sign conflict / Group hue: siguen ≥2 grupos.
- Sign conflict sigue G1 vs G2 (primeros dos groupIds). Fuera de alcance N-grupos.
- ANALYSIS+NAV, POINTS+RIBBONS. Galaxy no-op. Arithmetic fuera.
- Fuera: cancel por hilo, segundo slider “dentro del grupo”, colapsar X, backend/SAE train.
- SemVer: PATCH 2.4.2 → 2.4.3 al ship, salvo que el humano pida MINOR.

## Slice a ejecutar en ESTA sesión
Slice 1 — Engine: token-batch metric + split paint.

Si el humano indica Slice 2, hacé SOLO ese.
No adelantar el slice siguiente “por si acá”.

### Definition of Done — Slice 1
1. Helper(s) puros: hasEnoughTokensForSharedNoise + computeTokenSharedNoiseMetrics (nombre libre si el módulo queda profundo). TDD RED→GREEN en tests/groupDimContrast.test.js (o archivo hermano).
2. Casos mínimos del roadmap §3.3 y §5: <2 tokens → []; 1 grupo sí calcula; 3 grupos usa todos los tokens (G3 outlier impide sim alta); signos mezclados → cancel 0.
3. paintWeightsForDim / applyGroupDimPaint / buildPointGroupPaintAttributes: cancel lee métrica TOKEN; highlight sigue métrica GROUP (computeDimRelationMetrics intacta).
4. Instancer (y RIBBONS path) pasa ambas métricas. No reutilizar meanA/meanB para shared noise.
5. npm test verde. Sin cambios Python salvo error real.
6. Branch: feat/shared-noise-common-mode
7. APPROVAL GATE: cómo probar en Compare con Shared noise ya ON (2 grupos alcanza para ver paint; el gate UI de 1 grupo es Slice 2). ESPERÁ OK explícito. No push/merge.

### Definition of Done — Slice 2 (solo si el humano lo pide en esta sesión)
1. Mover markup Shared noise a después de Zero coverage; Group contrast = Sign conflict + Group hue.
2. Gate independiente ≥2 tokens (main.js + VisualizationControls). Sign conflict/hue siguen hasGroupsForDimContrast.
3. fieldInfo EN; tests de enable/disable.
4. CONTEXT.md, CHANGELOG, lessons-learned §4.11b; bump PATCH 2.4.3 (manifest, package.json, Navbar, FastAPI) al entregar.
5. Smoke roadmap §8. APPROVAL GATE → esperar OK → git-workflow.md §3.

## Cómo probar (mínimo, Slice 1)
1. Dev server. COMPARE con varios tokens.
2. Shared noise ON, Similarity 30%: bandas chatas entre tokens se apagan; dims de signo mezclado no.
3. Tres GROUP_*: dim donde G1≈G2 y G3 al contrario NO se apaga.
4. Sign conflict ON sigue marcando opuestos G1↔G2.
5. Geometría Y igual con el toggle ON/OFF.

## Estilo
No-fluff. TDD en helpers puros. Módulo profundo. No expandir scope.
Ante duda de contrato: preguntá — no adivines.
Ciclo SKILL.md: clarify (solo si algo contradice D1–D13) → branch → implement → verify → docs (Slice 2) → approval gate → git delivery tras OK.
```

---

## Notas para el humano

1. Pegá el prompt en sesión limpia con `main` al día.
2. **Slice 1** = el cambio de verdad (qué dims se apagan). **Slice 2** = mover el control y poder usarlo sin `GROUP_*`.
3. Después de Slice 1: Compare con Shared noise ON y 2+ grupos ya muestra la métrica nueva (aunque el control siga dentro de Group contrast hasta Slice 2).
4. OK explícito (“ok”, “dale”, “mergealo”) para push/merge. Un thumbs-up a otra cosa no cuenta.
