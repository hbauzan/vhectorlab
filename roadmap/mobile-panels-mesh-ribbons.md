# Roadmap: Paneles colapsables · Mobile · Mesh · Ribbons

> **Estado:** epic A→E implementado en `main` (2026-08-01).  
> **Base:** `main` + lecciones en `.agents/skills/dev-protocol/lessons-learned.md` (§1 WebGL, §3 navegación, §4 paneles).  
> **Referencia visual MESH/RIBBONS:** capturas del visualizador fuente (superficie quad-grid / cintas sobre plano base) en assets de sesión.  
> **Entrega:** una rama + merge por etapa (A→E).

---

## 0. Decisiones cerradas

| # | Tema | Decisión |
|---|---|---|
| D1 | **Dock derecha (colapsable)** | Incluye el chrome derecho relevante: sliders 3D **y** gizmo/HUD de ese lado (AxisGizmo + cualquier HUD lateral asociado). |
| D2 | **Dock izquierda (colapsable)** | Host de **Arithmetic** *o* **Compare** según `MODE` (no “Sidebar” genérico). Una pestaña/estado de minimize para el dock izquierdo activo. |
| D3 | **HUD inferior / telemetría principal** | **Siempre visible** (no colapsa con los docks). |
| D4 | **Default mobile** | Paneles **arrancan colapsados**. |
| D5 | **Breakpoint** | `max-width: 768px` = mobile phone. **Tablet = desktop** (sin rama mobile). |
| D6 | **Gestos mobile** | Esquema tipo shooter/RPG mobile (jóvenes): **joystick virtual izquierdo = mover** + **dedo derecho drag = mirar/órbita**. Pinch zoom opcional. Gyro off por default. *(Confirmar variante exacta en §C — ver re-pregunta.)* |
| D7 | **MESH** | Según captura: **superficie continua** de quads (heightfield / grid), colormap tipo viridis (pico amarillo → valle púrpura), ejes secuencia × embedding dimensions. No es “tubo por hilo”. |
| D8 | **RIBBONS** | Según captura: **varias cintas anchas** flotando sobre un **plano base** semitransparente; color por activación; sin puntos. Distinto de `Line` 1px. |
| D9 | **RENDER modes** | **Mutuamente excluyentes:** POINTS \| MESH \| RIBBONS. |
| D10 | **Shipping** | **Por etapa**, ramas `feat/…` separadas + approval gate. |
| D11 | **COMPARE en mobile** | **UI más corta** (presets/forms compactos; lista cosine scrolleable dentro del drawer). |
| D12 | **Backend / API** | **Sí se puede tocar** si hace falta (no forzar solo-frontend). |
| D13 | **Orientación phone** | **Landscape-first** con **overlay suave** en portrait: se puede cerrar y seguir en vertical (experiencia degradada); no bloquea hasta rotar. |

### Re-pregunta abierta (D6)

¿Joystick + look a lo COD/Fortnite/Roblox, o preferís también botones Q/E (subir/bajar) visibles en mobile?

---

## 1. Invariantes a respetar

1. **WebGL:** `frustumCulled = false`; puntos `transparent` + `depthWrite = false`; rampa divergente; early-out `|t| < 0.01`.
2. **Continuidad de hilo:** en POINTS la conexión sigue existiendo; en MESH/RIBBONS la geometría del modo **es** la continuidad.
3. **Navegación desktop:** `lerp` acotado; ignorar WASD en inputs de formulario.
4. **Paneles:** `fit-content` + `overflow: hidden`; scroll solo en listas internas (§4.1 / §4.2).
5. **COMPARE:** lista ↔ 3D sync; tween in-situ; sin focus de cámara al clickear filas.
6. **Colormap en MESH/RIBBONS (referencia):** las capturas usan rampa tipo viridis (amarillo→verde→teal→púrpura). **Decisión de implementación:** o (a) adaptar a la rampa divergente actual de VectorLab, o (b) introducir rampa “surface/viridis” solo para MESH/RIBBONS. *Resolver en Etapa D antes de codear shaders.*

---

## 2. Mapa de superficie actual

| Pieza | Rol hoy | Archivos |
|---|---|---|
| Dock izq. | Arithmetic / Compare | `Sidebar.js`, `ComparePanel.js` |
| Dock der. | Sliders espaciales | `ThreadSliders.js` |
| Gizmo | Esquina (hoy) | `AxisGizmo.js` |
| HUD | Barra inferior telemetría | `HUD.js` |
| Navbar | MODE / VISTA / RENDER | `Navbar.js` |
| Render | POINTS efectivo; MESH/RIBBONS no-op | `Instancer.js`, `MeshFactory.js` |
| Nav | WASDQE + mouse | `Navigation.js` |

---

## Etapa A — Pestañas minimize izquierda / derecha

**Objetivo:** Docks colapsables hacia su borde; pestaña siempre alcanzable.

### A.1 Comportamiento
- **Izquierda (Arithmetic \| Compare):** colapsa a `left`; pestaña `▶`.
- **Derecha (sliders + gizmo asociado):** colapsa a `right`; pestaña `◀`.
- HUD inferior **no** se oculta (D3).
- Slide CSS ~250ms; no desmontar DOM.
- `localStorage` para estado collapsed en desktop; mobile ignora y parte colapsado (D4).

### A.2 Criterios de aceptación
- [x] Minimize/restore dock izq. y der.
- [x] Cambio MODE Arithmetic↔Compare mantiene política de collapsed del dock izq.
- [x] Sin scrollbar externa del panel (§4.x).
- [x] HUD inferior sigue visible.

### A.3 Rama
`feat/collapsible-side-panels`

---

## Etapa B — Responsive phone + landscape-first

**Objetivo:** Verse bien en celular **en horizontal**; UI corta; drawers.

### B.0 Orientación (D13) — landscape-first, overlay suave

En phone (`≤768px` **y** no-tablet):

1. **Landscape = modo recomendado** (layout pensado para horizontal).
2. **Portrait = overlay suave** (no bloqueante):
   - Ícono de rotación + copy: p.ej. *“Mejor en horizontal — girá el teléfono”*.
   - Botón **Cerrar / Entendido** (o tap fuera) descarta el overlay.
   - Tras descartar, la app sigue usable en vertical (degradada); no re-spamear en la misma sesión (flag en `sessionStorage`).
   - Opcional: volver a mostrar si el usuario rota a landscape y luego regresa a portrait en otra visita (nueva sesión).
3. **No depender** de `screen.orientation.lock('landscape')` como único mecanismo (iOS Safari).
4. No pausar el render loop solo por portrait (el usuario eligió continuar).

### B.1 Layout landscape phone
- Navbar compacta / UI más corta (D11).
- Docks default collapsed; al abrir = drawer overlay (no empujar canvas hasta romperlo).
- Targets táctiles ≥44px; inputs ≥16px.
- Safe-area insets.
- Portrait tras dismiss: layout usable aunque apretado (misma lógica de drawers).

### B.2 Criterios de aceptación
- [x] Portrait phone: overlay suave visible; se puede cerrar.
- [x] Tras cerrar, se puede usar la app en portrait sin quedar atrapado.
- [x] Landscape phone: navbar + canvas + docks usables; sin overlay.
- [x] Tablet = layout desktop, sin overlay de rotación.
- [x] Desktop sin regresión.

### B.3 Rama
`feat/responsive-mobile-layout`

---

## Etapa C — Navegación mobile (esquema juegos 3D)

**Objetivo:** Volar/explorar sin teclado, familia de controles que ya conocen usuarios de COD/Fortnite/Roblox mobile.

### C.1 Esquema propuesto (D6)

| Control | Acción (mapeo VectorLab) |
|---|---|
| **Joystick virtual (mitad/izq. inferior)** | Move: W/S/A/D en espacio de cámara (misma semántica desktop, con `lerp` §3.1) |
| **Drag dedo en zona derecha / canvas** | Look: yaw/pitch (como mouse look) |
| **Pinch** | Dolly / zoom (opcional v1) |
| **Botones ▲/▼ o Q/E** | Subir / bajar *(si se confirma en re-pregunta)* |
| **Gyro** | Off por default |

- Touches que empiezan en docks/HUD/joystick **no** roban look del canvas.
- Desktop path intacto.

### C.2 Criterios de aceptación
- [x] Landscape phone: mover + mirar sin teclado.
- [x] Scroll en drawer Compare no mueve cámara.
- [x] Sin regresión WASDQE desktop.

**D6 resuelto:** joystick + look + botones ▲/▼ (Q/E) visibles en mobile.

### C.3 Rama
`feat/mobile-touch-navigation`

---

## Etapa D — Vista MESH (según captura)

**Objetivo:** `RENDER: MESH` = superficie continua de quads, no POINTS.

### D.1 Spec visual (de captura)
- Grid/mesh de quads ondulados (height ≈ activación).
- Colormap continuo picos claros → valles oscuros (viridis-like en referencia).
- Metáfora de ejes: secuencia × embedding dimensions (adaptar labels al dominio VectorLab: dim index × thread/slot según Arithmetic/Compare).
- Sin sidebars en la captura ⇒ modo “escena limpia” compatible con docks colapsados.

### D.2 Trabajo técnico
- `MeshFactory.createSurfaceMesh(...)` (BufferGeometry indexada).
- Branch real en `Instancer` por `renderMode === 'MESH'`.
- Decidir colormap (divergente vs surface) — §1.6.
- API/backend solo si hace falta agregar datos de grilla; preferir construir surface desde embeddings ya presentes.

### D.3 Criterios de aceptación
- [x] MESH ≠ POINTS a simple vista (superficie quad).
- [x] Sliders de layout afectan la surface.
- [x] Arithmetic y Compare soportados (N hilos → **una grilla** threads×dims; 1 hilo → strip).
- [x] Tests de creación de geometría + mode switch.

**Colormap:** rampa divergente VectorLab (opción a).

### D.4 Rama
`feat/render-mode-mesh`

---

## Etapa E — Vista RIBBONS (según captura)

**Objetivo:** `RENDER: RIBBONS` = cintas anchas sobre plano base.

### E.1 Spec visual (de captura)
- Plano base semitransparente (suelo de referencia).
- ~N cintas con ancho real, color por activación, paths ondulados.
- **No** usar `LineBasicMaterial.linewidth` (§1.4 WebGL cap 1px).

### E.2 Trabajo técnico
- `MeshFactory.createWideRibbonMesh` + `createBasePlane`.
- Branch `renderMode === 'RIBBONS'` (sin points).
- Diferenciar claramente de MESH (cintas discretas vs superficie continua).

### E.3 Criterios de aceptación
- [x] RIBBONS ≠ MESH ≠ POINTS.
- [x] Plano base presente; cintas legibles en Analysis y Navigation.
- [x] Tests + checklist visual.

### E.4 Rama
`feat/render-mode-ribbons`

---

## 3. Orden de ejecución

```text
A Collapsible docks
    ↓
B Responsive + landscape-first overlay
    ↓
C Touch nav (joystick + look)
    ↓
D MESH surface
    ↓
E RIBBONS + base plane
```

D/E pueden prepararse en paralelo tras B si hay bandwidth; E reutiliza helpers de ancho de D cuando aplique.

---

## 4. Doc-sync al cerrar el epic

| Asset | Cuándo |
|---|---|
| `lessons-learned.md` | Overlay landscape, touch vs UI, MESH surface, wide ribbons |
| `CHANGELOG.md` | Cada etapa mergeada |
| `CONTEXT.md` | Términos nuevos (Dock, Surface Mesh, Wide Ribbon, Landscape Gate) |

---

## 5. Fuera de alcance

- PWA install / offline.
- VR / WebXR.
- Rediseño total de marca.
- Soporte portrait-phone como layout primario (solo overlay suave de sugerencia).
