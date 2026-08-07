# LESSONS LEARNED & ARCHITECTURAL INVARIANTS

Este archivo registra las lecciones aprendidas, invariantes de arquitectura y patrones de ingeniería descubiertos en el desarrollo del proyecto. Debe ser **revisado, consultado y actualizado continuamente** por los agentes de IA en cada ciclo de trabajo del `dev-protocol`.

---

## 1. WebGL & GPU Shaders (Three.js)

### 1.1. Desactivación de Frustum Culling (`frustumCulled = false`)
- **Problema**: Three.js descarta automáticamente objetos fuera de la vista calculando una esfera delimitadora (`boundingSphere`) al instanciar. Al modificar buffers `Float32Array` in-situ o al mover/estirar la cámara, las mallas de puntos y líneas desaparecen repentinamente.
- **Solución Obligatoria**: Fijar `frustumCulled = false` en todas las mallas de puntos y líneas:
  ```javascript
  pointsMesh.frustumCulled = false;
  lineMesh.frustumCulled = false;
  ```

### 1.2. Transparencia y Profundidad (`depthWrite = false`, `transparent: true`)
- **Problema**: Mallas de puntos con opacidad dinámica solapadas se bloquean entre sí si la memoria de profundidad (*depth buffer*) bloquea píxeles traseros.
- **Solución Obligatoria**: Desactivar escritura de profundidad en el material:
  ```javascript
  transparent: true,
  depthWrite: false,
  blending: THREE.NormalBlending
  ```

### 1.2c. Sin GridHelper de referencia en el piso
- **Problema**: `GridHelper(800, 80)` bajo la escena competía visualmente con RIBBONS/COMPARE (cuadrícula visible a lo lejos).
- **Solución Obligatoria**: No montar grid en `SceneSetup` — fondo + fog bastan; el AxisGizmo del dock cubre orientación.
- **Invariante**: no reintroducir grid de piso sin pedido explícito.

### 1.2b. Fog de escena vs RIBBONS (no confundir con depthWrite)
- **Problema**: `FogExp2(0x050505, 0.008)` oscurecía `MeshBasicMaterial` (RIBBONS, `fog: true` por default) según distancia a cámara — a poses COMPARE (~Z 390) las cintas casi negras y la “sombra trepa” al orbitar. POINTS (shader custom sin fog chunks) no se veían igual.
- **Solución Obligatoria**: Densidad suave `SCENE_FOG_DENSITY = 0.0008` (`SceneSetup.js`) — atmósfera leve, legible a ~400u (`exp(-d·dist) > 0.5`). **RIBBONS**: fog desactivado (`setFogForRenderMode` / `shouldEnableSceneFog`) para probar saturación total a distancia. No es lighting ni colormap.
- **Invariante**: Si reaparece oscurecido al mover cámara en RIBBONS, revisar fog **antes** que normales/luces. PR aparte: solapamiento por `depthWrite: false` en ribbons.
- **Seguimiento**: RIBBONS ya no monta `basePlane`. Compare+RIBBONS no monta POINTS (bug: `else if (pointsData.length)` atrapaba RIBBONS). `depthWrite` / opacidad de wide ribbons → si reaparece solapamiento al orbitar.

### 1.3. Renderizado de Puntos Sólidos y Definidos (Sin Halos Esfumados)
- **Problema**: Un gradiente suave amplio de `smoothstep(0.0, 0.5, dist)` genera puntos borrosos, translúcidos y "esfumados".
- **Solución Obligatoria**: Renderizar discos sólidos con un borde de anti-aliasing ultra-definido de 1 píxel:
  ```glsl
  float solidEdge = 1.0 - smoothstep(0.44, 0.49, dist);
  vec3 finalColor = color * solidEdge;
  float alpha = dynamicAlpha * solidEdge;
  ```

### 1.4. Limitación de Grosor de Líneas en WebGL
- **Problema**: La especificación WebGL sobre ANGLE/macOS/Windows limita `LineBasicMaterial.linewidth` a máximo 1px.
- **Solución Obligatoria**: Escalar el grosor visual mediante el tamaño de los puntos (`pointSize` en `ShaderMaterial`), los cuales sí escalan correctamente en GPU con `sizeAttenuation: true`.

### 1.5. Renderizado de Puntos Cuadrados/Cúbicos GLSL y Línea Base de Origen
- **Invariante**: Para renderizar puntos cuadrados/cúbicos nítidos en GPU, se calcula la distancia Chebyshev `max(abs(coord.x), abs(coord.y))` y se aplica suavizado de borde de 1 píxel `smoothstep(0.44, 0.49, maxDist)`.
- **Línea Base en Análisis**: En el modo **Análisis**, se renderiza una malla de línea vertical (`THREE.Line`) con opacidad de cristal (`opacity: 0.6`, `transparent: true`, `frustumCulled = false`) anclando el inicio ($X = \text{startX}$) de todos los hilos vectoriales apilados.

---

## 2. Visualización y Normalización de Embeddings LLM

### 2.1. Estandarización Z-Score + Tanh
- **Problema**: Los vectores de embeddings de LLMs (`all-mpnet-base-v2`, OpenAI, etc.) tienen magnitudes absolutas pequeñas ($v_i \in [-0.15, +0.15]$). Dividir directamente por el valor máximo genera puntos oscuros e invisibles (5% de opacidad).
- **Solución Obligatoria**: Calcular la media ($\mu$) y desviación estándar ($\sigma$) del dataset y aplicar compresión sigmoidal simétrica:
  ```javascript
  export function calculateZScoreNormalized(values, scaleFactor = 1.2) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length) || 1.0;
    return values.map(v => Math.tanh(scaleFactor * ((v - mean) / std)));
  }
  ```

### 2.2. Rampas Cromáticas Divergentes (Color Anchors)
User-editable hex anchors replace the former fixed dual ramp (no product mid-stops at ±0.5 orange/blue):
- **+1** default `#FFE600`, **0** `#000000`, **−1** `#9900E6`.
- Interpolation: lerp(`zero`, `positive`, t) for t≥0; lerp(`zero`, `negative`, −t) for t<0.
- POINTS shader: uniforms `uColorPos` / `uColorNeg` / `uColorZero` (never hardcode ramp in GLSL).
- Sign filter + colors are **global** (`vl3d.viz.*` in localStorage); filter runs on **normalized t** (ε=0.01), not raw dims.
- Continuity lines use `LineSegments` + index pairs; wide ribbons omit quad indices for filtered pairs (keeps full vertex buffers for compare reorder).

### 2.3. Continuidad de hilo según RENDER mode (mutuamente excluyentes)
- **POINTS**: puntos + línea fina `createRibbonMesh` (continuidad 1px).
- **RIBBONS**: la continuidad **es** la cinta ancha (`createWideRibbonMesh`); sin plano base (el quad oscuro se veía a través de cintas transparentes). No usar `LineBasicMaterial.linewidth` (§1.4).
- Colormap RIBBONS: rampa **divergente** VHectorLab (anchors) para consistencia de marca.
- **Retired**: `RENDER: MESH` (surface heightfield) removed in v1.6.0 — `normalizeRenderMode('MESH')` → POINTS. Do not reintroduce without an explicit product decision.

### 2.4. Optimización de Fragment Shader para Cero Activación ($|t| < 0.01$)
- **Patrón**: Evitar cálculos de interpolación `mix()` en fragmentos con intensidad casi nula.
- **Solución Obligatoria**: Evaluar $|t| < 0.01$ al inicio del Fragment Shader y realizar un early return con color negro y opacidad mínima ($\alpha \approx 0.05$):
  ```glsl
  if (absT < 0.01) {
      gl_FragColor = vec4(vec3(0.0), 0.05 * baseOpacity * solidEdge);
      return;
  }
  ```

---

## 3. Navegación y Controles 3D (WASDQE)

### 3.1. Inercia Acotada sin Acumulación Exponencial (`lerp`)
- **Problema**: Sumar aceleración en cada frame (`velocity.add(moveVector)`) con amortiguación `velocity.multiplyScalar(damping)` causa una acumulación exponencial de velocidad (hasta $\frac{1}{1-\text{damping}} \approx 8.33\times$ la velocidad base), haciendo que la cámara salga disparada tras presionar 'W' por medio segundo.
- **Solución Obligatoria**: Acotar la velocidad mediante interpolación lineal directa al vector objetivo:
  ```javascript
  if (moveVector.lengthSq() > 0) {
    moveVector.normalize().applyQuaternion(this.camera.quaternion).multiplyScalar(targetSpeed);
    this.velocity.lerp(moveVector, 0.25); // Velocidad acotada y constante
  } else {
    this.velocity.multiplyScalar(this.damping); // Desaceleración suave
  }
  ```

### 3.2. Aislamiento de Teclado durante Entrada de Texto en UI
- **Problema**: Al escribir en inputs HTML de la UI (ej. barra de búsqueda de palabras), las teclas 'W', 'A', 'S', 'D' mueven la cámara 3D involuntariamente.
- **Solución Obligatoria**: Filtrar eventos de teclado si el elemento activo es un input de formulario, y resetear la velocidad en el evento `blur`:
  ```javascript
  const tag = document.activeElement ? document.activeElement.tagName : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  ```

### 3.3. Vista de Análisis de Frente y Proyección de Etiquetas Flotantes
- **Patrón**: Proyectar los orígenes 3D ($X=0$) de los hilos vectoriales a coordenadas 2D de pantalla (`vector.project(camera)`) para renderizar cartelitos Glassmorphic anclados al inicio de cada hilo.
- **Invariante**: En el modo **Análisis**, los hilos se apilan verticalmente a lo largo de $Y$ con encuadre frontal directo (`Z=360`), permitiendo visualizar todos los componentes y el resultado inmediatamente sin desplazamientos manuales.

### 3.5. Touch mobile: joystick/look no roban eventos de docks/HUD
- **Problema**: Pointers que empiezan en drawers/Compare/HUD mueven la cámara o pelean con scroll.
- **Solución Obligatoria**: Look solo si `target` es `CANVAS` y no hace match de docks/HUD/joystick (`isUiTouchTarget`). Joystick y botones Q/E escriben ejes en `Navigation` (`setMoveAxes` / `setVertical`); el update sigue el mismo `lerp` §3.1. Desktop mouse/WASD intacto.
- **Invariante**: scroll en `.compare-cosine-list` no mueve cámara; touch UI ≠ look.

### 3.4. Default poses by MODE|VIEW|RENDER
- **Invariante**: Al cambiar MODE / VIEW / RENDER se reaplica cámara (`resolveCameraPose` → `Navigation.setContextView`) + sliders (`resolveSpatialDefaults` → sync UI). Claves `MODE`, `MODE|VIEW`, `MODE|VIEW|RENDER` (más específico gana).
- **Fallbacks de VIEW** (sin override): NAVIGATION corridor `POS (-178.3, 13.5, 52.2)` / `ROT (-5.4°, -51.5°, 0°)`; ANALYSIS `POS (-75.2, -0.8, 62.5)` / `ROT (0°, 0°, 0°)`.
- **Overrides capturados**:
  - `ARITHMETIC|ANALYSIS|POINTS` — sliders Amplitud $Y=40$, Grosor $0.05$; cámara vía fallback ANALYSIS.
  - `COMPARE|NAVIGATION|POINTS` — sliders Spacing `0.7`, Dist Y `10`, Amp `4.9`, Length `0.1`, Thickness `0.01`; cámara `POS (-106.5, 20.4, 390.2)` / `ROT (-3.9°, -8.4°, 0°)`; primer load COMPARE usa `COMPARE_AUTO_PRESETS.default` (lexicón completo), no `sample5`.
  - `COMPARE|NAVIGATION|RIBBONS` — sliders Spacing `1.55`, Dist Y `10`, Amp `7`, Length `0.057`, Thickness `0.05`; cámara `POS (-575.8, 43.8, 237.9)` / `ROT (-22.4°, -35.7°, 0°)`; fog **off** en RIBBONS (`shouldEnableSceneFog`).
- **Overlay de captura**: El HUD `CAM POSE` solo se monta si `VITE_SHOW_CAM_POSE=true` (default `false` en `.env.example`).
- **Workflow de captura**: Activar overlay → navegar a la pose → screenshot POS/ROT → actualizar `CAMERA_DEFAULT_OVERRIDES` y/o `SPATIAL_DEFAULT_OVERRIDES` para la clave `MODE|VIEW|RENDER`.

---

## 4. UI Panels (Sidebar / Compare)

### 4.1. Panel Arithmetic sin Scrollbar + Top-10 Compacto Read-Only
- **Problema**: Expandir `.results-list` con `min-height` grande + `overflow-y: auto` en el panel y en la lista generaba una barra deslizante molesta en Vector Arithmetic.
- **Solución Obligatoria**:
  - `.glass-sidebar`: `height: fit-content`, `overflow: hidden` (sin scroll del panel).
  - Top-10 compacto (padding/gap/font reducidos) para que los 10 resultados quepan sin overflow.
  - Items del Top-10 **solo lectura**: sin `click`, sin hover interactivo, `pointer-events: none`, `cursor: default`. No re-enfocar la cámara al clicar un vecino.
- **Invariante**: El Top-10 es métrica visible, no control de navegación 3D.

### 4.2. COMPARE Cosine-vs-Anchor: scroll interno + reorder 3D con tween in-situ
- **Problema**: Listas largas (20/50/1024) en Compare rompen el invariante §4.1 si el scroll vive en el panel; un reorder con `clear()` + rebuild provoca flicker y desync lista↔3D.
- **Solución Obligatoria**:
  - Scroll **solo** en `#compare-panel .compare-cosine-list` (`overflow-y: auto` + `max-height`); el panel permanece `overflow: hidden` / `fit-content`.
  - Filas de similitud: `pointer-events: none` en la fila; solo ▲/▼ con `pointer-events: auto` (métrica + reorder, sin focus de cámara).
  - Reorder: recalcular `cosine_vs_first` en memoria (`compareCosine.js`); animar slots con `Instancer.animateCompareReorder` (lerp de `sequenceIndex` fraccionario ~200–400ms, reuse de ribbon/points meshes, `ThreadLabels.updateOrigins` por frame).
  - Bloquear spamming de flechas mientras `_reorderBusy` (un tween a la vez).
- **Invariante**: lista COMPARE ↔ orden de hilos 3D siempre sincronizados; #1 es ancla REF con score `1.0000`.

### 4.3. Docks colapsables: transform + tab, sin desmontar DOM; MODE comparte estado izq.
- **Problema**: Ocultar paneles con `display: none` / desmontar nodos pierde estado de formularios, sliders y lista cosine; duplicar lógica left/right y resetear collapse al cambiar MODE rompe la UX.
- **Solución Obligatoria**:
  - Host único `CollapsibleDock` por borde: slide con `transform` (~250ms); hijos permanecen montados.
  - Colapsado: `pointer-events: none` en `.dock-body`; la pestaña (`.dock-tab`) sigue `pointer-events: auto` y expone `aria-expanded`.
  - **Dock izq. / MODE**: un solo flag collapsed (y una key `localStorage`) para Arithmetic|Compare; el cambio de MODE solo alterna `.hidden` del panel activo dentro del body — no toca collapse.
  - **Dock der.**: sliders + AxisGizmo viven en el mismo host; el HUD inferior de telemetría **nunca** entra al dock (siempre visible).
  - Desktop: persistir collapsed en `localStorage`. Mobile (`max-width: 768px`): default collapsed y no persistir (hook Etapa B).
  - El dock host mantiene `overflow: hidden` / `fit-content` — no reintroducir scrollbar externa (§4.1 / §4.2).
- **Invariante**: collapse ≠ unmount; MODE no resetea el dock izquierdo; HUD bottom ∉ docks.

### 4.5. Control Espacial 3D — defaults = mid del rango + steps finos + dblclick reset
- **Problema**: Rangos históricos asimétricos (Distancia Y / Grosor con default = min; Amplitud hasta 240) dejan el thumb pegado a un extremo al load — solo se puede agrandar, no afinar alrededor del punto dulce. Steps gruesos (enteros / 0.1 en rangos chicos) impiden valores intermedios. Sin gesto de reset, volver al punto dulce exige adivinar el valor.
- **Solución Obligatoria**: Un solo set global de min/max (mismo track en todas las combos MODE|VIEW|RENDER). Separación $X$ ∈ $[0.4,2.0]$ step $0.05$ (COMPARE default $0.7$ se conserva; global $0.4$ en el min). Distancia $Y=10$ ∈ $[1,19]$ step $0.1$, Amplitud $Y=7$ ∈ $[1,40]$ step $0.1$ (**asimétrico**: default global 7 y override Analysis 40 se conservan; COMPARE Amp $4.9$ no fuerza mid). Longitud $Z$ ∈ $[0.001,0.2]$ step $0.001$ (nunca 0; COMPARE $0.1$ ≈ mid; global $0.2$ en el max; label 3 dec). Grosor $=0.05$ ∈ $[0.01,0.09]$ step $0.01$. Labels: 2 dec (X/Grosor), 3 dec (Z), 1 dec (Y). Defaults vía `resolveSpatialDefaults` / overrides por clave. **Doble clic** restaura solo ese slider al default del contexto.
- **Invariante**: rangos idénticos en todas las combos; defaults por combo se conservan; no todos los defaults son mid lineal; Length nunca llega a 0.

### 4.6. ThreadLabels 3D — Arithmetic corto; Compare = tokens ingresados
- **Problema**: Badge de `type` + texto largo (`WORD_A` + `VECTOR A`, `#1 COS VECTOR (queen)`) hinchaba las cards glassmorphic en Análisis Arithmetic.
- **Solución Obligatoria**:
  - **Arithmetic**: un solo span vía `arithmeticThreadLabel` → `WORD_A|WORD_B|WORD_C|RES|TOP1`. Sin badge de tipo; `res-label` / `top1-label` por `type`.
  - **Compare**: el texto de la label 3D es el **token ingresado completo** (como antes). No prefijar `TOPn`, no truncar. La lista Compare / reorder sigue mostrando todos los items.
- **Invariante**: no mezclar políticas Arithmetic↔Compare; labels 3D ≠ paneles laterales (Top-10 / cosine list).
- **Lección**: acortar labels en un mode no implica el mismo formato en el otro — validar Compare aparte antes de unificar.

### 1.6. RENDER: MESH retired (v1.6.0)
- **Decisión**: surface heightfield (`createSurfaceMesh`) removed from product — no aportaba vs POINTS/RIBBONS y costaba mantener.
- **Invariante**: navbar + runtime = POINTS | RIBBONS only. Legacy `"MESH"` → POINTS via `normalizeRenderMode`. No reintroduce surface mode without explicit ask.

### 1.7. RIBBONS = wide mesh strips (nunca Line linewidth; sin base plane)
- **Problema**: `LineBasicMaterial.linewidth` queda capado a 1px en WebGL (§1.4); no sirve para cintas anchas de referencia. Un `createBasePlane` semitransparente bajo las cintas se veía como rectángulo oscuro a lo lejos (bordes rectos).
- **Solución Obligatoria**: `createWideRibbonMesh` (quad strip a lo largo del centerline). Sin Points. Sin montar plano base en Instancer.
- **Invariante**: RIBBONS ≠ POINTS; no reintroducir base plane bajo ribbons sin opacificar/`depthWrite` conscientes.

### 4.4. Landscape Gate — RETIRED (portrait preferred)
- **Antes**: Soft overlay en phone portrait (“Better in landscape”).
- **Decisión**: Retirado — en producto real se ve **mejor en portrait** que de costado; el cartel era mentira UX.
- **Solución Obligatoria**: `shouldShowLandscapeGate` → siempre `false`; clase no monta copy. No reintroducir nudge landscape sin pedido explícito.
- **Invariante**: phone = portrait-first; no orientation lock; render loop nunca pausa por orientación.

---

### 4.7. Product copy = English; identifiers stay
- **Invariante**: Visible UI copy (navbar, panels, sliders, landscape gate, aria/titles/placeholders) is English-only. Internal keys (`data-view="ANALYSIS"`, `threadAmplitudeY`, CSS classes) are not renamed for i18n. No i18n framework — single-language product surface.
- **Compare 3D labels** remain raw input tokens (§4.6); panel chrome uses EN glossary.

### 4.8. COMPARE groups — parse frontend, flat /compare, badges follow centroids
- **Decisión (v1.7.0)**: `GROUP_name = tokens` en textarea → `parseCompareInput` concatena grupos; `/compare` sigue flat. Anchor = primer token global (D1a). Sort/reorder cosine **global** puede romper contigüidad (D2a); badges de grupo se re-anclan al centroide de miembros actuales.
- **Invariante**: groups = metadata UI/layout, no endpoint nuevo; duplicados entre groups permitidos.
- **Visibilidad**: con groups activos, overlay muestra **solo** badges de grupo (los token cards a N alto los tapaban y el offset grande los metía bajo el dock z-index 40). Lista cosine sigue con todos los tokens. `#thread-labels-container` z-index ≥ docks; offset screen de group badges chico.
- **Bootstrap**: textarea default **y** auto-Visualize al entrar a COMPARE deben salir de `getCompareBootstrap()` (groupsDemo + `tokenMeta`). Autoload de `COMPARE_AUTO_PRESETS.default` (136 flat, sin meta) mientras el textarea muestra `GROUP_*` → etiquetas de token forever. Preset buttons deben Visualize, no solo rellenar texto.
- **SAE + groups**: `applySaeToCompare` y encode path deben re-afirmar `groupId`/`groupLabel` desde RAW cache (no `groupName`). `ThreadLabels.updateOrigins` rebuilds DOM si el set de ids cambia (tokens → group badges).

### 4.9. Visualization Controls — sign filter + color anchors + zero coverage (v1.8.x)
- **Panel**: glass card glued to the **bottom HUD** (app root); EN copy; global (not per MODE|VIEW|RENDER). Right dock keeps Spatial Controls + AxisGizmo only.
- **Sign filter**: `all | positive | negative` on **normalized t** (post z-score/tanh), ε=`0.01` aligned with shader short-circuit. +/− only hide the opposite sign **and** near-zero. Applies to POINTS (fragment `discard`) **and** continuity `LineSegments` / wide-ribbon **index omission** (F4) — keep full vertex buffers so COMPARE reorder in-situ still works.
- **Color anchors**: user hex +1 / 0 / −1 replace fixed mid-stop ramps; lerp `0↔+1` and `0↔−1`. POINTS shader uses uniforms `uColorPos` / `uColorNeg` / `uColorZero` (never hardcode ramp in GLSL).
- **Zero coverage %**: slider **below Colors, above Reset**. Remaps `|t|` so zero color occupies `coverage` of the ± range before lerp (`remapAbsTWithZeroCoverage`); CPU + `uZeroCoverage` share math. Cap 90% so ±1 remains reachable. Persist `vl3d.viz.*` including `zeroCoverage`.
- **Collapse / HUD glue**: Visualization mounts on **app root**. Short **left** dock-tab (▼ raised / ▲ resting on HUD). Expanded + collapsed share the **same HUD top seam** (right end of the bar via `--hud-pad`). Collapse only hides the body — tab stays parked **on** the HUD (flat bottom, no side orphan slot). Desktop + mobile. Key `vl3d.viz.panelCollapsed`.
- **Bottom HUD width**: tip-to-tip with equal `--hud-pad` insets (navbar-like span, not edge-glued). Right dock / AxisGizmo sit **above** the HUD (`bottom: hud-bottom + hud-height + 8`) so full-width telemetry does not collide with the gizmo.
- **Mobile chrome density**: navbar **single row** `--navbar-height: 28px` (no wrap / no second tab row); tabs ~20px / ~0.55rem; status = green/red **dot only** (hide ONLINE text). Overflow tabs: ◀ ▶ arrows via `navbarTabsScroll.js` (`getTabsScrollState` / `nextTabsScrollLeft`) — arrows only when `.is-overflowing`. HUD strip compacta y fluida al ancho — no forzar 44px en chrome decorativo (inputs/CTAs del panel sí mantienen 44px / 16px iOS zoom guard). Docks `top: calc(var(--navbar-height) + 6px)`.
- **SemVer**: if `main` already shipped a MINOR (e.g. groups `1.7.0`), the next capability must take the **next** MINOR (`1.8.0`) — never reuse a version number already on `main`.
- **Invariante**: filter-on-normalized-t; F4 = geometry not points-only; anchors always drive ramp in v1; no backend for viz controls.

### 4.10. Top‑K SAE Clean/Denoise (v2.0.0)
- Roadmap: `roadmap/sae-denoise.md`. **Trained** Top‑K Sparse Autoencoder (PyTorch), ported from the predecessor tool — **not** sinusoidal fake projection.
- **Train scope = current workspace batch** (Compare items / Arithmetic vectors), **not** the full vocabulary. Model is **ephemeral** (RAM session); `POST /api/sae/clear` on Visualize/Calculate.
- Defaults caps: 768 → 8192 latents, K=32; `suggest_sae_dims(n)` auto-scales down for small N. Encode activations drive 3D when toggle ON; `/api/sae/status|train|encode|clear`.
- UI: Compare-only 50/50 CTA `Clean/Denoise (SAE)`; replace Compare vectors while ON; raw 768 cache restore on OFF; `vl3d.sae.*` localStorage; train progress via status poll. **Arithmetic has no SAE.**
- Archived “NO SAE” in `roadmap/archivo/big-picture.md` is **superseded**.
- **Train fast-path**: `from_numpy` + full-batch when N small; MPS/CUDA via `SAE_DEVICE=AUTO`; CUDA AMP; `inference_mode` for final metrics; `suggest_train_schedule` caps epochs (≤12 if hidden≤128). Defaults UI epochs=20.
- Encode already had bucketing + inference_mode + autocast; MPS autocast attempted with FP32 fallback.
- **Encode I/O bottleneck**: GPU matmul ~20ms; dense `.tolist()` of `[N, 8192]` JSON was the freeze. Fix: `encode_vectors_sparse` → `{format:topk_sparse, indices[N,K], values[N,K]}` + router `ORJSONResponse`; `RemoteProvider.saeEncode` densifies via `densifyTopKActivations`. `load_model()` is singleton (`model is not None` short-circuit) — do not `torch.load` per request.
- **Train UI hang**: UI could sit on `Starting SAE training… · working Ns` while backend was already `success`. Causes: (1) poll started only after `POST /train` returned — large embeddings JSON could stall the POST; (2) `refreshSaeStatusUi` nulled status on fetch error → fallback label "Starting…"; (3) async `setInterval` overlap. Fix: poll immediately on busy; keep last status on error; fetch timeouts; ignore pre-POST `idle`; clear poll in `_stopSaeTrainBusy`.

### 4.11. COMPARE group contrast visibility (v2.1.0)
- **SAE + global z-score**: Top‑K densified matrix (~5% nonzero) → exact zeros normalize to \(t \approx -0.24\) (false negative “dust”). Mitigation in v1: auto **+ Only** on SAE encode success; restore previous filter on SAE OFF (`saeFilterBridge`). Do not change global z-score contract without an explicit D10.
- **Amplitude floor**: `COMPARE|ANALYSIS|POINTS` at Amp `1.0` collapses relief even when math has signal — default Amp **16** (RIBBONS twin too).
- **Dim sort**: optional client permutation by max pairwise `|mean_Gi − mean_Gj|`; session-only, OFF default; only when ≥2 `groupId`. Does not mutate backend payload.
- **Cosine ▲/▼ vs groups**: disable while groups active — global cosine sort breaks GROUP_* contiguity and soft Y gaps.
- Soft ANALYSIS Y gap: +1 empty slot between consecutive different `groupId` blocks (`groupStackLayout`).

#### Handoff for predecessor / sister apps (architect brief)
Portable findings from VHectorLab 3D `v2.1.0` — apply if the older app shares ANALYSIS matrix paint + groups + SAE Top‑K:

| Finding | Detail | Recommended fix |
| :--- | :--- | :--- |
| Sparse SAE + **global** z-score+tanh | Exact zeros → \(t\approx-0.24\) (painted as negative “dust”); nonzeros saturate near +1 | Prefer **+ Only** when SAE ON; optionally restore prior filter on SAE OFF. Avoid changing global norm unless product accepts colormap shift |
| Flat relief | Amplitude default at slider floor (~1) hides real peaks (RAW peak \|a\|~0.22 → Y tiny) | Raise ANALYSIS Amplitude default (VL3D used **16**; ARITH often **40**) |
| Unsorted X | Dim index order hides domain bands even when between-group signal exists | Client **dim permutation** by `max_{i,j} \|mean_Gi − mean_Gj\|`; toggle OFF = raw order |
| Cosine list sort vs groups | Global cosine reorder breaks group contiguity on Y | Disable cosine ▲/▼ while ≥2 groups, or regroup after sort |
| Expectation vs math | RAW G1↔G2 centroid cosine ~0.55 (not antipodal); SAE can improve (~0.22) but paint still hides it | Fix paint/order first; wider SAE train is L3, not required for readability |
| Layout axes (ANALYSIS) | X=dim, Y=thread stack + val×amp, Z=0 | Soft Y gap between `GROUP_*` blocks (+1× spacing) aids domain reading |

**Modules shipped (reference):** `saeFilterBridge.js`, `groupStackLayout.js`, `dimContrastSort.js`; wiring in Compare panel + Instancer layout. Diagnosis: `scripts/diagnose_group_separation.py`. Roadmap: `roadmap/compare-group-contrast-viz.md`.

### 4.12. Bottom HUD hover activation (POINTS / RIBBONS)
- **Problema**: `ACTIVATION` siempre `0.0000` — `Interaction` pasaba `userData` del mesh (`{ pointsData }`), y el HUD leía `userData.val` / `data.activation` (inexistentes).
- **Solución Obligatoria**: Resolver vía `resolveHoverTelemetry` → `pointsData[index].activation` (POINTS) o `userData.activations` + face/`index` (RIBBONS / continuity). Formatear con `formatActivationValue` (hasta 32 decimales, shrink + scientific si el slot es angosto; label `ACT:` en mobile). `title` tooltip con valor completo.
- **Invariante**: telemetría de hover ≠ normalización de color; mostrar valor **crudo** del embedding/activación en ese índice.

---

### 4.13. Field-info tips ("i") — tap, not hover-only
- **Problema**: Native `title=` tooltips fail on phone (long-press unreliable); editable fields had almost no per-control help.
- **Solución Obligatoria**: Deep module `fieldInfo.js` — `FIELD_INFO` short EN catalog (≤28 chars), `infoTipMarkup`, `wireFieldInfo` (one tip at a time, outside/Escape closes, viewport-clamped). Wire on Arithmetic / Compare / SAE params / Spatial sliders / Visualization. Touch: `.field-info-btn` / `.field-info-tip` in `isUiTouchTarget`.
- **Invariante**: help copy = English, short, mobile-first; do not rely on hover-only `title` for field meaning.

---

## 5. Protocolo de Mantenimiento de Lecciones Aprendidas

1. **Consulta Obligatoria**: El agente **DEBE** leer este archivo al iniciar cualquier tarea de implementación, diseño de shaders, navegación o refactorización.
2. **Actualización Continua**: Al descubrir una nueva invariante técnica, bug de renderizado o patrón de rendimiento, el agente **DEBE** agregarla a este archivo antes de finalizar la tarea.

---

## 6. Dev tooling / ngrok / Vite ↔ backend

### 6.1. Proxy `/api` en Vite: prefijo general, no ruta-a-ruta
- **Problema**: Exponer frontend y backend con **el mismo** hostname ngrok (dos agentes → `:5173` y `:8000`) se pisa; el celu no puede llamar a `127.0.0.1:8000`.
- **Solución Obligatoria**:
  - Un solo túnel ngrok → Vite (`:5173`).
  - En `vite.config.js`, proxy de prefijo: `'/api' → http://127.0.0.1:8000` (el backend ya monta el router con `prefix="/api"`).
  - `VITE_API_BASE_URL=/api` en `.env` (habilitado por defecto en dev/ngrok). `RemoteProvider` usa esa base; header `ngrok-skip-browser-warning` cuando el host es ngrok.
- **¿Hay que mapear endpoint por endpoint?** **No**, si todo el API vive bajo el mismo prefijo (`/api/health`, `/api/arithmetic`, `/api/compare`, …). Un solo `proxy['/api']` cubre rutas nuevas automáticamente.
- **Cuándo sí ruta-a-ruta**: solo si exponés paths **fuera** de `/api` (p.ej. `/health` bare sin prefijo) y querés proxearlos — ahí cada path top-level necesita su propia entrada en `server.proxy`, o movés el contrato a `/api/*`.
- **Invariante**: nuevas rutas backend bajo `/api` → cero cambio en Vite; si alguien agrega un mount root-level, o lo mete bajo `/api` o agrega proxy explícito + lesson.

---

## 7. Product versioning (SemVer) — VHectorLab 3D

### 7.0. Product name (2026-08-03)
- Canonical product name: **VHectorLab 3D** (was VectorLab 3D / VECTORLAB). Keep `roadmap/` historical docs as-is.
- Do **not** rename `localStorage` keys `vl3d.*` — technical prefix, not brand; renaming breaks persisted prefs.
- Sync brand + SemVer: `manifest.json`, `package.json`, Navbar `version-tag`, FastAPI `app.version`, `CHANGELOG`.

### 7.1. Diagnosis (why it felt broken)
- **Too fast (Aug 2026 epic day)**: `1.1.0`→`1.5.0` burned a **MINOR per roadmap etapa** (docks / landscape / touch / MESH / RIBBONS) on the same calendar day. Semantically each etapa *was* a capability, but the Navbar tag looked like five releases without five ship moments.
- **Too slow (post-`1.5.0`)**: many user-visible changes (defaults, fog, EN copy, slider ranges) sat only under `[Unreleased]` while `manifest` / Navbar stayed `1.5.0`. The tag stopped tracking “what users can do now.”

### 7.2. Policy (what to bump when)
Sync **`manifest.json` + `package.json` + Navbar `version-tag` + `CHANGELOG` section** together.

| Bump | When |
| :--- | :--- |
| **MAJOR (`x.0.0`)** | Breaking backend/API contracts, embedding dim, or data shapes that break clients. |
| **MINOR (`1.y.0`)** | Add **or remove** a product surface: MODE / VIEW / RENDER mode, major panel capability, or comparable user-facing feature. *This release:* retiring MESH → **1.6.0** (same weight class as when MESH shipped as `1.4.0`). |
| **PATCH (`1.y.z`)** | Fixes, spatial/camera defaults, fog/copy/i18n polish, docs-only sync that still ships. Prefer PATCH over leaving long Unreleased tails. |

**Cadence rule**: bump **once per shippable delivery** of a notable change — not once per internal etapa on the same day, and not “never until the next epic.” Batch same-day etapas into one MINOR if they ship together.

### 7.3. Build numbers — analysis (do **not** use as product version)
Options considered: `1.5.0+42`, `1.5.0.42`, CI build id in the Navbar.

| Approach | Pros | Cons for this repo |
| :--- | :--- | :--- |
| **SemVer build metadata (`1.6.0+gitsha`)** | Traceable artifacts | Not for “is this a new feature?”; Navbar noise; easy to confuse with PATCH |
| **Four-part `1.6.0.N`** | Monotonic every merge | Not npm/SemVer; invents a fourth digit users don’t understand |
| **CI build only in debug HUD** | Debug without product inflation | Fine as *optional* `VITE_SHOW_BUILD` — not the public version |

**Decision**: product version stays **three-part SemVer**. History of capability = `CHANGELOG`. Optional CI/git SHA belongs in a debug overlay (like cam pose), **not** in the brand version tag. Build numbers do **not** replace PATCH/MINOR discipline.

---

## 8. Local onboarding / `setup.sh` (macOS)

### 8.1. README must describe the control panel, not a backend-only path
- **Problema**: Un README que solo documenta `cd backend && uv sync && uv run …` deja a juniors sin el flujo real (`./setup.sh` opción 1: deps, tests, backend+frontend, browser).
- **Solución Obligatoria**: README en **inglés**, centrado en `./setup.sh` opción **1** como camino recomendado. Documentar qué hace cada opción del menú.

### 8.2. Prerequisites: check **and install** on macOS (do not only fail)
- **Problema**: “Verificar que estén instalados” y abortar con “instalalo vos” frena onboarding; el panel debe cerrar el gap.
- **Solución Obligatoria** en `setup.sh` (opción 1 / `ensure_prerequisites`):
  - Si falta **`uv`** → instalar con el installer oficial Astral; refrescar `PATH` (`~/.local/bin`, Homebrew).
  - Si falta **Node/`npm`** → asegurar Homebrew y `brew install node`.
  - Si falta **`.env`** → copiar desde `.env.example`.
  - Sync backend: `uv sync --extra dev`; frontend: `npm install` si no hay `node_modules`.
- **Invariante**: en Darwin, option 1 no debe pedir instalación manual de `uv`/Node salvo fallo de red/permisos.

### 8.3. Platform scope is macOS-only until explicitly ported
- **Problema**: Scripts con `open`, Homebrew paths y bash asumen Mac; documentar “multiplataforma” sin pruebas miente.
- **Hecho / soportado**: creado y probado en **macOS 26.5.1 (Darwin 25.5.0, arm64)**.
- **No preparado**: Windows ni Linux (aunque con pocos ajustes de package manager / PATH / process control suele ser viable).
- **Invariante**: README + banner de `setup.sh` deben declarar esa versión de SO y el estado unsupported; auto-install de Node vía Brew es **macOS-only**. En no-Darwin: warn claro; no fingir soporte.

### 8.4. Docker Desktop is optional (HF image only)
- **Problema**: Juniors asumen que hace falta Docker Desktop para correr la app; o al revés, option 7 falla sin explicación.
- **Hecho**: el flujo diario (opción **1**) es bare-metal (`uv` + Vite) — **no** requiere Docker.
- **Cuándo sí**: opción **7** (`docker build` de la imagen HF Spaces, torch CPU + vocab NPZ). Opción **8** publica Space Docker cpu-basic vía `hf repos create` + `git push` — **no** necesita Docker Desktop local (el Hub buildea).
- **Solución Obligatoria**: README marca Docker como **optional**; menú etiqueta option 7 con Docker Desktop; `ensure_docker` antes del build; option 8 usa `ensure_hf_cli` + `hf auth`.
- **Invariante**: no meter Docker en `ensure_prerequisites` de option 1.

### 8.5. HF Space cpu-basic packaging
- **Problema**: `uv sync` en Linux tira wheels NVIDIA; encode de ~10k vocab en cada cold start OOMea o tarda demasiado.
- **Solución Obligatoria**: `UV_TORCH_BACKEND=cpu` en Dockerfile; precompute `public/vocab_embeddings.npz` en build; `.dockerignore`; `UVICORN_RELOAD=0`; README YAML `sdk: docker` + `app_port: 7860`.
- **Runtime device**: `/health.device` + navbar `ONLINE (model · cpu|cuda|mps)`.
- **ARITHMETIC persist**: por visitante en `localStorage` (`vl3d.arithmetic.*`) — no disco del Space.
- **Invariante**: no asumir GPU en Spaces Docker; ZeroGPU no aplica a sdk docker.

### 8.5. Local folder / clone name = `vhectorlab`
- **Problema**: el working copy histórico se llamaba `lsv2`, luego `VHectorLab-3D`, mientras el remoto GitHub pasó a **`vhectorlab`**.
- **Solución Obligatoria**: carpeta local canónica **`vhectorlab`** (minúsculas, alineada al repo). README: `git clone …/vhectorlab.git` + `cd vhectorlab`. Producto UI sigue **VHectorLab 3D**. No renombrar `vl3d.*` localStorage ni packages npm (`vhectorlab-3d`) solo por el folder/repo slug.
- **Invariante**: `roadmap/` puede seguir mencionando `lsv2` / VectorLab / `VHectorLab-3D` como historia; no reescribir archivo salvo necesidad.

### 8.6. Renaming the repo folder breaks `backend/.venv` shebangs
- **Problema**: Tras `mv lsv2 → VHectorLab-3D`, `uv sync` reporta OK pero `uv run pytest` falla: `Failed to spawn: pytest` / `No such file or directory`. Los entrypoints en `.venv/bin/*` siguen con shebang absoluto a la ruta vieja (`…/lsv2/backend/.venv/bin/python3`).
- **Solución Obligatoria**:
  1. En `setup.sh` `ensure_project_deps`: si `backend/.venv/bin/pytest` existe y su intérprete shebang **no existe**, `rm -rf backend/.venv` y re-sync.
  2. Invocar tests como `uv run python -m pytest` (menos frágil que el script `pytest` con shebang roto).
  3. Recuperación manual: `rm -rf backend/.venv && cd backend && uv sync --extra dev`.
- **Invariante**: un rename/move del working copy **implica** recrear el venv; `uv sync` solo no reescribe shebangs rotos.

### 8.7. Idempotent start — never bounce a healthy stack
- **Problema**: Opción 1 hacía `pkill` + relaunch siempre, aunque backend/frontend ya estuvieran healthy → pérdida de estado, re-carga del modelo, downtime innecesario.
- **Problema 2 (Ctrl+C / PGID)**: sin sesión nueva, backend/vite compartían señales con el panel → SIGINT los mataba.
- **Problema 3 (`set -m` / STAT T)**: `set -m` + job control dejó Vite en **stopped** (`STAT T`): puerto en LISTEN pero HTTP timeout → probe **sick** y el usuario quedaba trabado si option 1 solo abortaba.
- **Solución Obligatoria** en `setup.sh` (opciones que arrancan servicios):
  - Arrancar con **`launch_detached`** (`python3` + `start_new_session=True`, stdin DEVNULL) — sin controlling TTY; **no** usar `set -m` para esto.
  - **healthy** = proceso matching (`pgrep`) **y** health OK (`/health` con `"status":"ok"` en `:8000`; HTTP OK en `:5173`). Puerto ocupado sin ese combo = **sick**.
  - Ambos healthy → **skip** prerequisites, **skip** tests y **skip** start; abrir browser. Tests explícitos = opciones **4/5**.
  - **Sick** o parcial → **recycle** ambos (kill + start), no abortar dejando al usuario trabado.
  - Ambos down → flujo normal (prereqs → tests → start).
  - Opción **2** (backend only): skip si healthy; recycle si sick.
  - Opción **10** siempre hace stop real (`kill_stack`), no no-op.
  - **Ctrl+C** nunca baja servicios: en live logs pausa → Enter vuelve al menú; segundo Ctrl+C sale del panel.
- **Invariante**: no hay flag “force restart” separado; el stop explícito basta. No bajar+subir un stack ya healthy. Solo opción **10** detiene el stack a propósito. Servicios NUNCA comparten sesión/TTY con el panel.
