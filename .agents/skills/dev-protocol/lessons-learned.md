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

### 2.3. Conexión Incondicional de Hilos
- Los puntos de cada hilo vectorial deben estar siempre conectados incondicionalmente por líneas de cinta (`RibbonMesh`), independientemente del modo de renderizado (`POINTS`, `MESH`, `RIBBONS`), para preservar la estructura visual del hilo.

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

---

## 4. Protocolo de Mantenimiento de Lecciones Aprendidas

1. **Consulta Obligatoria**: El agente **DEBE** leer este archivo al iniciar cualquier tarea de implementación, diseño de shaders, navegación o refactorización.
2. **Actualización Continua**: Al descubrir una nueva invariante técnica, bug de renderizado o patrón de rendimiento, el agente **DEBE** agregarla a este archivo antes de finalizar la tarea.
