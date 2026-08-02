> **ARCHIVO HISTÓRICO** — archivado 2026-08-02.
> **Estado al archivar:** Etapa A entregada.
> **Rama implementada:** `feat/collapsible-side-panels` (merge a `main`, v1.1.0).
>
> Prompt de agente usado para disparar la Etapa A; conservado solo como histórico de sesión.

# Prompt — siguiente agente (Etapa A del roadmap)

Copiá y pegá el bloque siguiente en una sesión nueva.

---

```text
Usando dev-protocol, implementá SOLO la Etapa A del roadmap de paneles colapsables / mobile / mesh / ribbons.

## Contexto
Repo: VectorLab 3D (Python/uv backend + Vite/Three.js frontend).
Base branch: `main` (actualizado).
Roadmap canónico (leelo completo antes de codear):
  `roadmap/mobile-panels-mesh-ribbons.md`

Lecciones / invariantes (OBLIGATORIO leer):
  `.agents/skills/dev-protocol/lessons-learned.md`
  En especial §1 WebGL, §3 navegación, §4.1 / §4.2 paneles (fit-content, overflow hidden, scroll solo en listas internas; COMPARE lista↔3D sync).

## Alcance de ESTA sesión = Etapa A únicamente
NO implementes aún: responsive mobile (B), touch nav (C), MESH (D), RIBBONS (E).
Sí: docks colapsables izquierda/derecha con pestaña.

### Decisiones de producto ya cerradas (D1–D4, D10)
- Dock IZQUIERDA: host de Arithmetic O Compare según MODE. Una pestaña/estado de minimize para el dock izq. activo.
- Dock DERECHA: sliders 3D (`#thread-sliders-container`) + gizmo/HUD de ese lado (`AxisGizmo` y chrome derecho asociado).
- HUD inferior de telemetría (`HUD.js` barra bottom): SIEMPRE VISIBLE — no colapsa.
- Desktop: recordar collapsed en `localStorage`.
- Mobile default collapsed es Etapa B — en A podés dejar desktop defaults abiertos o preparar el hook; no hace falta el overlay landscape todavía.
- Ship por etapa: rama `feat/collapsible-side-panels`, approval gate antes de merge.

### Comportamiento Etapa A
- Izquierda colapsa hacia `left`; queda pestaña vertical clickeable (▶ / handle).
- Derecha colapsa hacia `right`; pestaña (◀).
- Transición CSS suave ~250ms (`transform`); NO desmontar el DOM (preservar form, sliders, lista cosine).
- `pointer-events: none` en el panel off-screen excepto la pestaña.
- Al cambiar MODE Arithmetic↔Compare, el dock izq. activo respeta la misma política de collapsed (documentá la regla elegida).
- NO reintroducir scrollbar externa en `.glass-sidebar` / compare (§4.1 / §4.2).

### Archivos probables
`src/ui/Sidebar.js`, `src/ui/ComparePanel.js`, `src/ui/ThreadSliders.js`, `src/visualizer/AxisGizmo.js`, `src/ui/HUD.js`, `src/main.js`, `src/style.css`
Preferí un helper/módulo deep pequeño tipo `CollapsibleDock` si reduce duplicación.

### Criterios de aceptación (A)
- [ ] Click pestaña izq. oculta Arithmetic/Compare activo; click restaura.
- [ ] Click pestaña der. oculta sliders (+ gizmo asociado); click restaura.
- [ ] HUD inferior sigue visible en todo momento.
- [ ] Cambio MODE no rompe el estado collapsed del dock izq.
- [ ] Sin scrollbar externa del panel.
- [ ] Tests vitest mínimos del toggle / `aria-expanded` si el harness lo permite.
- [ ] CHANGELOG corto + lesson en lessons-learned si descubrís invariante nueva de docks.

### Flujo
1. Branch `feat/collapsible-side-panels` desde `main`.
2. TDD / vertical slice; verde local (`vitest`, smoke UI).
3. Approval gate: reportá cómo probar y ESPERÁ OK antes de push/merge a main.

### Fuera de alcance ahora
Portrait overlay, joystick mobile, MESH surface, wide RIBBONS, cambios de colormap, API salvo que A lo exija (no debería).
```

---

## Notas para vos (humano)

- Después de mergear A, el próximo prompt es Etapa B (mismo archivo de roadmap, sección B + D13 overlay suave).
- Capturas de referencia MESH/RIBBONS quedaron en la sesión Cursor; si el próximo agente hace D/E, adjuntás esas PNGs o las copiás a `roadmap/refs/`.
