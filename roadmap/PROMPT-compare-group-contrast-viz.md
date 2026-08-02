# Prompt — agente COMPARE group contrast visibility

Copiá y pegá el bloque siguiente en una sesión **nueva**.  
Roadmap: [`compare-group-contrast-viz.md`](./compare-group-contrast-viz.md) (2026-08-02).

**Importante:** hay **decisiones abiertas (D1–D12)**. El agente **debe preguntar y esperar** antes de codear.

---

```text
Usando dev-protocol, ejecutá el roadmap COMPARE group contrast visibility.

## Contexto
Repo: VectorLab 3D (Python/uv + Vite/Three.js).
Base: `main` actualizado (git pull first).
Roadmap canónico — leelo COMPLETO antes de cualquier código:
  `roadmap/compare-group-contrast-viz.md`
Lecciones: `.agents/skills/dev-protocol/lessons-learned.md`
  (§2 z-score/tanh, §2.2 viz colors/filter, §4.5 spatial defaults, §4.8 COMPARE groups,
   §4.10 Top‑K SAE, §7 SemVer).
Diagnóstico ya corrido (números en roadmap §1): `scripts/diagnose_group_separation.py`.
GROUP_* floating badges bootstrap ya está en main — este epic NO es ese bug;
es legibilidad de contraste G1 vs G2 en la matriz 3D (paint + opcional dim sort).

## Fase 0 — OBLIGATORIA (antes de branch/código)
1. Leé el roadmap §1 (hechos) y §3 (D1–D12).
2. Preguntá al humano TODAS las decisiones abiertas D1–D12 que aún digan pending
   (podés agrupar en un solo mensaje claro). No asumas defaults de producto.
3. ESPERÁ respuestas. Completá roadmap §3.1 (Answers log) con lo acordado.
4. Si algo del diagnóstico §1 contradice lo que el humano ve en UI, pedí screenshot /
   RAW vs SAE / Amplitude actual — no inventes.
5. Solo después de D* cerradas: branch e implementación.

## Decisiones YA CERRADAS (no re-preguntar)
- ANALYSIS: X=dim index, Y=thread stack + val*amplitude, Z=0 (no “tokens on Z”).
- Groups demo sin sort: índices 0–64 GROUP_1, 65–129 GROUP_2.
- SAE train = scope Compare actual (n=130 en el demo); auto_scale ~640 / k=32.
- Global z-score+tanh sobre SAE Top‑K pinta ceros como t≈−0.24 (falso “polvo” negativo).
- Amplitude default COMPARE|ANALYSIS|POINTS = 1.0 hoy → relieve plano (hecho).
- No MESH / no Mode C / no variance slider existentes.
- Carriles: L1 Quick UX → L2 Dim sort → L3 SAE/datos (orden ROI); L4 diagnosis = done.
- Fuera de alcance fijo: PCA/UMAP Projector, Neuronpedia, cambiar contrato /compare,
  Arithmetic thread order (salvo que el humano expanda D* explícitamente).

## Objetivo
Según D1: hacer legible el contraste entre GROUP_* en COMPARE ANALYSIS
(L1 y/o L2 y/o L3). Criterios en roadmap §6 (ajustar tras D*).

## Flujo post-kickoff
1. Branch: `feat/compare-group-contrast-viz` o stages `…-l1` / `…-l2` si D1 lo pide.
2. Stage A (L1) si aplica: Amplitude default (D2), SAE↔filter (D3/D4), group Y gap (D5).
3. Stage B (L2) si aplica: helper de permutación por contraste + toggle UI (D6–D9).
4. Stage C (L3) solo si D1/D11: datos/normalize (D10) / train guidance.
5. Tests (vitest; re-run `python3 scripts/diagnose_group_separation.py` si L2/L3).
6. CHANGELOG EN + lessons-learned corto (SAE zeros + z-score; Amplitude; dim sort).
7. Smoke roadmap §8.
8. APPROVAL GATE — reportá cómo probar; ESPERÁ OK explícito antes de push/merge
   (`git-workflow.md` §3).

## Criterios de aceptación
Checklist §6 del roadmap + lo que el humano agregue al cerrar D*.

## Cómo probar (mínimo)
1. Backend + `npm run dev`.
2. COMPARE → 2 Groups → 130 tokens, badges OK.
3. ANALYSIS POINTS: Amplitude default nuevo; con SAE ON verificar filtro (D3) y que
   el polvo de ceros normalizados no domine si se eligió + Only.
4. Si L2: toggle dim sort → bandas; OFF → orden crudo.
5. SAE OFF restaura RAW + filtro según D4.

## Estilo
No-fluff; TDD en helpers puros; módulos profundos; no expandir scope.
Ante duda de contrato UI/SAE: preguntá — no adivines.
Seguí el ciclo completo de `.agents/skills/dev-protocol/SKILL.md`
(clarify → branch → implement → verify → docs → approval gate → git delivery).
```

---

## Notas para el humano

1. Pegá el prompt en sesión limpia con `main` al día (incl. fix de badges GROUP si ya mergeó).
2. El agente te va a preguntar **D1–D12** — respondé en bloque; con eso alcanza para codear.
3. Recomendación previa del diagnóstico: **D1 = L1+L2**, **D3 = auto `+ Only` on SAE**, Amplitude **≥16**. Podés confirmar o cambiar.
4. Script de números: `python3 scripts/diagnose_group_separation.py` (backend up).
