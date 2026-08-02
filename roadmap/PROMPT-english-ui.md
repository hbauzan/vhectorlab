# Prompt — agente English-only UI (VectorLab 3D)

Copiá y pegá el bloque siguiente en una sesión nueva **después** de que el humano responda las dudas §0.1 del roadmap (o pedile esas respuestas en Etapa B antes de codear C).

---

```text
Usando dev-protocol, ejecutá el roadmap de English-only product surface.

## Contexto
Repo: VectorLab 3D (Python/uv + Vite/Three.js).
Base: `main` actualizado.
Roadmap canónico (leelo completo ANTES de codear):
  `roadmap/english-ui-i18n.md`
Lecciones: `.agents/skills/dev-protocol/lessons-learned.md` (§4 paneles, §4.5 sliders, §4.6 labels).

## Objetivo de producto
Pasar a **inglés** todo lo user-facing (y lo que el roadmap marque en D7/D8). Identifiers internos (`ANALYSIS`, keys JS, CSS) NO renombrar salvo necesidad.

## Fuera de alcance (NO tocar)
- `roadmap/**` salvo actualizar el propio audit/glosario si el roadmap lo pide
- `.agents/**` / skills / módulos del protocolo (podés AÑADIR una lesson corta de i18n si aparece invariante nueva)
- No i18n framework, no multi-idioma — solo English

## Flujo obligatorio
### Etapa A — Auditoría exhaustiva (primero)
1. Branch `docs/english-ui-audit` (o `feat/english-ui-audit`).
2. Inventario completo en scope: `src/**`, `index.html`, `tests/**`, `backend/**` user/API messages.
3. Excluir roadmap/skills/node_modules.
4. Smoke UI + ripgrep; entregar tabla `file:line | current | suggested EN | class` (user-facing | test-title | comment | demo-vocab).
5. Commit docs (`roadmap/english-ui-audit.md` append o sección en el roadmap). Approval gate; merge docs OK.

### Etapa B — GATE glosario (OBLIGATORIO)
1. Listá las preguntas §0.1 del roadmap + cualquier término nuevo del audit.
2. Proponé EN para cada string user-facing.
3. **ESPERÁ respuestas del humano.** No inventes copy de marca ni decidas D6–D8 solo.

### Etapa C — User-facing (tras OK de B)
1. Branch `feat/english-user-facing-copy`.
2. Aplicá glosario cerrado a Navbar / Sidebar / ComparePanel / ThreadSliders / LandscapeGate / aria / titles / empty states / placeholders.
3. Compare vocab según decisión D6.
4. Actualizá tests que aserten copy.
5. CHANGELOG Unreleased corto; lesson solo si hay invariante nueva.
6. Vitest verde + smoke; approval gate → merge.

### Etapa D — solo si B lo pidió (D7/D8)
Tests titles / comments / docs según lo acordado. Rama separada o misma si el humano dijo “todo junto”.

## Criterios de aceptación (C)
- [ ] Ningún string ES visible en UI (Arithmetic, Compare, VISTA, sliders, landscape gate, modals).
- [ ] `data-view` / mode keys internos intactos.
- [ ] Compare labels 3D siguen siendo el token crudo (§4.6).
- [ ] Tests verdes; asserts de copy actualizados.
- [ ] Grep residual de UI-ES en `src/` limpio (o solo comentarios si D7=no).

## Cómo probar
1. `npm run dev` (+ backend).
2. Recorrer MODE / VISTA / RENDER; sliders titles; Compare empty + sort tooltips; landscape gate en phone portrait o DevTools.
3. Confirmar presets Compare según D6.

## Estilo
No-fluff; TDD donde haya harness; no ampliar a i18n libraries.
```

---

## Notas para el humano

1. **Antes de pegar el prompt**, respondé §0.1 del roadmap (`english-ui-i18n.md`) — o dejá que el agente pregunte en Etapa B y contestá ahí.
2. Orden recomendado: A (audit merge) → B (tus OKs) → C (UI) → D opcional.
3. Si querés un solo agente end-to-end, pegá el prompt completo; el gate B lo obliga a frenar.
