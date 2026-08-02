# Prompt — agente English-only UI (VectorLab 3D)

Copiá y pegá el bloque siguiente en una sesión nueva. **Glosario y D6–D8 ya están cerrados** en `roadmap/english-ui-i18n.md` (2026-08-02).

---

```text
Usando dev-protocol, ejecutá el roadmap English-only product surface.

## Contexto
Repo: VectorLab 3D (Python/uv + Vite/Three.js).
Base: `main` actualizado.
Roadmap canónico (leelo completo ANTES de codear):
  `roadmap/english-ui-i18n.md`
Lecciones: `.agents/skills/dev-protocol/lessons-learned.md` (§4 paneles, §4.5 sliders, §4.6 labels).

## Decisiones YA CERRADAS (no re-preguntar)
- D6: Compare auto-vocab → **English** auto-parts lexicon (rename off `_ES`).
- D7: Rename Spanish test titles (`debe…`) to EN; translate ES comments in `src/` + `backend/` to EN.
- D8: **Do NOT rewrite historical CHANGELOG** (leave past entries in Spanish). New/Unreleased entries in EN only.
- Glossary table in roadmap §0.1 is authoritative (ANALYSIS, NAVIGATION, 3D Spatial Controls, Spacing, Vector Distance, Amplitude, Length, Point Thickness, CALCULATE VECTOR, VISUALIZE SEQUENCE, etc.).

## Objetivo
Product copy + in-scope strings → English. Internal identifiers (`ANALYSIS`, JS keys, CSS) stay unless a visible label requires change. No i18n framework.

## Fuera de alcance
- `roadmap/archivo/**`, `.agents/**` / skills (except optional short new i18n lesson)
- Rewriting old CHANGELOG sections
- Multi-language / i18n libraries

## Flujo
### Etapa A — Auditoría exhaustiva
1. Branch `docs/english-ui-audit`.
2. Inventory ES/mixed strings in `src/**`, `index.html`, `tests/**`, `backend/**` (user/API msgs).
3. Deliver `roadmap/english-ui-audit.md` table: `file:line | current | suggested EN | class`.
4. Smoke UI notes. Approval gate → merge docs.

### Etapa B — SKIP
Already closed in roadmap. If audit finds NEW user-facing terms not in §0.1, list them once and ask; otherwise proceed.

### Etapa C + D — Apply (can be one branch if clean)
1. Branch `feat/english-user-facing-copy`.
2. Apply glossary to Navbar, Sidebar, ComparePanel, ThreadSliders, LandscapeGate, aria/titles/empty states/placeholders; EN auto vocab.
3. Update UI-copy asserts; rename `debe…` tests to EN; translate ES comments in src/backend.
4. CHANGELOG Unreleased in EN only — leave historical Spanish entries untouched.
5. Vitest green + smoke; approval gate → merge.

## Criterios de aceptación
- [ ] No Spanish visible in UI (Arithmetic, Compare, VISTA, sliders, landscape gate, modals).
- [ ] Compare 3D labels remain raw tokens (§4.6).
- [ ] Internal `data-view` / mode keys unchanged.
- [ ] Tests green; titles EN; comments ES→EN in scope.
- [ ] Historical CHANGELOG still Spanish; new notes EN.
- [ ] Residual grep of UI Spanish in `src/` clean (or documented false positives).

## Cómo probar
1. `npm run dev` (+ backend).
2. Walk MODE / VISTA / RENDER; slider titles; Compare empty + sort tooltips; landscape gate; presets show English tokens.
3. Spot-check a few `it('…')` names are English.

## Estilo
No-fluff; TDD where harness exists; don’t expand scope.
```

---

## Notas para el humano

- Glosario ya OK — podés pegar el prompt directo.
- Orden: A (audit) → C+D (apply) con approval gates.
