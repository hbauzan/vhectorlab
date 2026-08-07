# GUI & Art direction — VHectorLab 3D

Epic de **pulido visual / arte de producto** sobre un stack ya funcional (embeddings, SAE, docks, mobile chrome, tips).

**Estado:** activo (post `2.2.0`)  
**Prompt agente:** [`PROMPT-gui-art.md`](./PROMPT-gui-art.md)

---

## 0. Norte

La app debe sentirse como un **instrumento científico-cinemático**, no como un dashboard genérico dark-mode:

- El **canvas 3D** es el héroe; la UI es cristal fino alrededor.
- Marca **VHectorLab 3D** legible y propia (tipografía, acentos gold/cyan/magenta ya en `:root`).
- Motion con intención (2–3 gestos), no ruido.
- Mobile portrait-first; landscape phone sigue siendo chrome táctil (`MOBILE_MQ`).

## 1. Inventario de superficies a artear

| Superficie | Archivos clave | Notas |
| :--- | :--- | :--- |
| Navbar | `Navbar.js`, `style.css` `.glass-navbar` | Tabs densos en mobile; brand + version |
| Left dock | `Sidebar.js`, `ComparePanel.js`, `SaeControls.js` | Glass cards, CTAs emoji-heavy |
| Right dock | `ThreadSliders.js`, AxisGizmo | Spatial controls density |
| Viz sheet | `VisualizationControls.js` | HUD-glued; colors + filter |
| HUD | `HUD.js` | Telemetry strip |
| Thread labels | `ThreadLabels.js` | Glass badges en 3D |
| POINTS / RIBBONS | shaders, `MeshFactory`, `DivergentShading` | Look 3D = “arte” real |
| Touch chrome | `TouchControls.js` | Joystick / Q-E |
| Tips | `fieldInfo.js` | “i” popovers |

## 2. Decisiones abiertas (el agente DEBE preguntar antes de codear)

| ID | Pregunta | Opciones sugeridas |
| :--- | :--- | :--- |
| A1 | Tipografía de producto | Mantener Inter / cambiar display (una sola familia expresiva) / split UI vs brand |
| A2 | Intensidad glass | Más blur+borde / más sólido opaco / menos glass |
| A3 | Emoji en CTAs (⚡🔍📐) | Quitar / reducir a iconos SVG / dejar |
| A4 | Rampa de marca (±1) | Conservar `#FFE600`/`#000`/`#9900E6` / proponer nueva triad |
| A5 | Motion budget | Solo docks+tips / + label fade / + thread entrance |
| A6 | Scope del primer slice | Solo chrome 2D / solo look 3D POINTS / ambos en un MINOR |

## 3. Invariantes que NO romper

- English-only product copy (§4.7).
- Startup **ARITHMETIC \| ANALYSIS \| POINTS** (`appViewDefaults.js`).
- Top-10 / cosine scroll contracts (§4.1 / §4.2).
- Mobile MQ incluye landscape corto (§4.1b).
- Landscape gate **retired** (§4.4).
- Field-info tips tap-not-hover (§4.13).
- WebGL: `frustumCulled=false`, fog RIBBONS off, sin grid de piso (§1).
- SemVer §7 + sync Navbar/manifest/package/FastAPI/CHANGELOG.

## 4. Fuera de alcance (salvo pedido explícito)

- Nuevos endpoints / SAE math / vocab size.
- Reintroducir MESH o landscape-gate.
- i18n framework.
- Redesign total del backend.

## 5. Entrega sugerida

1. Preguntar A1–A6 → cerrar decisiones en este doc.
2. Branch `feat/gui-art-<slice>`.
3. TDD donde haya helpers puros (tokens CSS, motion timings).
4. Verificar desktop + phone portrait + phone landscape.
5. Approval gate → merge main → HF Space force-publish.
