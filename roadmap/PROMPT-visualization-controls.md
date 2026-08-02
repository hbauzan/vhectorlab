# Prompt — agente Visualization Controls (Sign filter + color anchors)

Copiá y pegá el bloque siguiente en una sesión nueva. **Todas las decisiones de producto ya están cerradas** en `roadmap/visualization-sign-filters-colors.md` (2026-08-02).

---

```text
Usando dev-protocol, ejecutá el roadmap Visualization Filters & Color Anchors.

## Contexto
Repo: VectorLab 3D (Python/uv + Vite/Three.js).
Base: `main` actualizado (pull first).
Roadmap canónico (leelo COMPLETO antes de codear):
  `roadmap/visualization-sign-filters-colors.md`
Lecciones: `.agents/skills/dev-protocol/lessons-learned.md`
  (§4.5 sliders/dock derecho, §2.2 rampa divergente, §7 SemVer, §1 WebGL).

## Decisiones YA CERRADAS (no re-preguntar)
- V1: Panel nuevo debajo de “3D Spatial Controls” en right dock (mismo glass).
- V2: Efectivo en ARITHMETIC + COMPARE.
- V3: POINTS + RIBBONS only.
- F1: + = >0, − = <0, near-zero |t|<0.01 (ε alineado a DivergentShading).
- F2: “+ only” oculta − y near-zero; “− only” oculta + y near-zero.
- F3: Radio segmentado All | + Only | − Only (default All).
- F4: Filtrar TODA la geometría (points + continuity lines + wide ribbons).
- C1: Tres hex anclas REEMPLAZAN la rampa fija (lerp 0↔+1 y 0↔−1; sin midstops de producto).
- C2: Hex libre; C3 defaults #FFE600 / #000000 / #9900E6; C4 localStorage.
- D1: Global (no per MODE|VIEW|RENDER); D2: Reset a defaults + All.
- X1: Sin backend; X2: sin presets con nombre / export.
- Filtrar sobre activación NORMALIZADA (post z-score/tanh), no raw suelto — documentalo.
- POINTS shader: uniforms para colores (no hardcode GLSL ramp).

## Objetivo
UI + pipeline de color/filtro según roadmap §0–§7. TDD en helpers puros. MINOR version bump (§7).

## Fuera de alcance
- roadmap/archivo/**, backend, MESH, named palettes, per-context viz overrides.

## Flujo
1. Branch `feat/visualization-sign-color-controls` (or staged A/B/C as in roadmap §9).
2. Implement defaults/persistence + pure filter/color tests (RED→GREEN).
3. UI panel + wire into main.js right dock below ThreadSliders.
4. Instancer/MeshFactory/DivergentShading: apply filter + anchors on POINTS and RIBBONS.
5. CHANGELOG + CONTEXT terms + short lessons note; bump version (check current manifest).
6. Vitest green + smoke checklist in roadmap §6–§7.
7. APPROVAL GATE — report how to test; wait for explicit OK before push/merge.

## Criterios de aceptación
Ver checklist §7 del roadmap (todos los ítems).

## Cómo probar
1. `npm run dev` (+ backend).
2. Right dock → Visualization: toggle All / + Only / − Only on POINTS then RIBBONS (Arithmetic + Compare).
3. Edit +1/0/−1 hex; confirm live recolor; reload → persisted; Reset → defaults.
4. Confirm lines/ribbons also lose filtered-sign geometry (not points-only).

## Estilo
No-fluff; deep modules; don’t expand scope; don’t re-ask closed IDs.
```

---

## Notas para el humano

- Decisiones V/F/C/D/X ya cerradas — pegá el prompt directo.
- Si `feat/compare-group-labels` u otros no están en `main`, mergeá antes o pedile al agente que parta de `main` limpio.
