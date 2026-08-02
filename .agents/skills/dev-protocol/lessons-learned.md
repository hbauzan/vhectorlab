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

### 2.2. Rampas Cromáticas Divergentes Simplificadas (Dual Color Ramps)
Para lecturas de alta visibilidad y ligera carga computacional, implementar la paleta divergente simplificada (sin transiciones intermedias a rojo o verde):
- **Rango Positivo ($0 \rightarrow +1$)**: Negro ($0.0$) $\rightarrow$ Naranja ($+0.50$, `#FF8000`) $\rightarrow$ Amarillo Incandescente ($+1.00$, `#FFE600`).
- **Rango Negativo ($0 \rightarrow -1$)**: Negro ($0.0$) $\rightarrow$ Azul Eléctrico ($-0.50$, `#0040FF`) $\rightarrow$ Violeta Neón ($-1.00$, `#9900E6`).

### 2.3. Continuidad de hilo según RENDER mode (mutuamente excluyentes)
- **POINTS**: puntos + línea fina `createRibbonMesh` (continuidad 1px).
- **MESH**: la continuidad **es** la superficie de quads (`createSurfaceMesh`); no montar Points.
- **RIBBONS**: la continuidad **es** la cinta ancha (`createWideRibbonMesh`) + plano base; no usar `LineBasicMaterial.linewidth` (§1.4).
- Colormap MESH/RIBBONS: rampa **divergente** VectorLab (opción a del roadmap) para consistencia de marca.

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

### 3.4. Default Navigation Corridor Pose
- **Invariante**: La vista inicial de **Navegación** usa la pose capturada `POS (-178.3, 13.5, 52.2)` + euler YXZ `ROT (-5.4°, -51.5°, 0°)` con sliders espaciales por defecto Separación $X=0.4$, Amplitud $Y=7.0$, Longitud $Z=0.2$.
- **Overlay de captura**: El HUD `CAM POSE` solo se monta si `VITE_SHOW_CAM_POSE=true` (default `false` en `.env.example`). Sirve para releer POS/ROT desde una captura y actualizar `setNavigationView()`.
- **Workflow de captura**: Para fijar una nueva vista default, activar el overlay, navegar a la pose deseada, screenshotear `POS`/`ROT` legibles, y actualizar `Navigation.setNavigationView()` + defaults de sliders espaciales si cambian.

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
- **Solución Obligatoria**: Un solo set global de min/max con defaults fijos: Separación $X=0.4$ ∈ $[0.1,0.7]$ step $0.05$, Distancia $Y=10$ ∈ $[1,19]$ step $0.1$, Amplitud $Y=7$ ∈ $[1,20]$ step $0.1$ (**asimétrico**: default se mantiene en 7 para no regresar el punto dulce; no forzar mid lineal si max sube), Longitud $Z=0.2$ ∈ $[0.1,0.3]$ step $0.01$, Grosor $=0.10$ ∈ $[0.05,0.15]$ step $0.01$. El resto sí es simétrico lineal (`default === (min+max)/2`). Labels: 2 dec (X/Z/Grosor), 1 dec (Y). Defaults vía `resolveSpatialDefaults({ workspaceMode, viewMode, renderMode })` (`spatialSliderDefaults.js`): hoy todos caen al global; overrides por clave `MODE`, `MODE|VISTA`, `MODE|VISTA|RENDER` cuando los definás. **Doble clic** en un `<input type="range">` restaura **solo ese** slider al default resuelto del contexto actual (sin feedback extra).
- **Invariante**: al load, defaults espaciales no cambian de valor (Amplitud sigue 7); se puede disminuir y aumentar con granularidad gradual; dblclick → default del contexto.

### 1.6. MESH surface = grilla threads × dims, no tubo
- **Invariante**: `RENDER: MESH` construye un heightfield indexado (filas = hilos/secuencia, columnas = dims embedding) con `frustumCulled = false`, `transparent` + `depthWrite = false`. Un solo hilo se expande a strip de 2 filas. Sliders espaciales afectan vía `LayoutEngine` antes de crear/actualizar la surface.

### 1.7. RIBBONS = wide mesh strips + base plane (nunca Line linewidth)
- **Problema**: `LineBasicMaterial.linewidth` queda capado a 1px en WebGL (§1.4); no sirve para cintas anchas de referencia.
- **Solución Obligatoria**: `createWideRibbonMesh` (quad strip a lo largo del centerline) + `createBasePlane` semitransparente. Sin Points. Distincto de MESH (cintas discretas vs superficie continua).

### 4.4. Landscape Gate suave (portrait phone) — no lock, no pause
- **Problema**: Forzar `orientation.lock('landscape')` falla en iOS Safari; un blocker duro atrapa al usuario en portrait.
- **Solución Obligatoria**: Overlay soft solo en phone portrait (`width ≤ 768` y `height > width`); dismiss escribe `sessionStorage` y no re-spamea en la sesión; tablet = desktop (sin overlay). El render loop **nunca** se pausa por portrait.
- **Invariante**: landscape-first sugerido, nunca bloqueante.

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
