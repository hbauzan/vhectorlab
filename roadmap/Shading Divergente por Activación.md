
# 🗺️ Roadmap de Desarrollo: Thread Geometry, Spatial Sliders & Divergent Shading 3D

> **Instrucciones para el Agente de IA:**
> Construir un prototipo aislado e hiper-enfocado en WebGL (Vite + Vanilla JS + Three.js) que integre dos capacidades fundamentales:
> 1. **3 Sliders de Control Espacial:** Separación Lateral ($X$), Escala Longitudinal ($Z$) y Grosor Visual.
> 2. **Shading Divergente por Activación:** Renderizado cromático por GPU (GLSL Shaders) y CPU donde:
>    * $v > 0$ (Positivo) $\rightarrow$ Transición de Negro a **Rojo** (`#FF0000`).
>    * $v = 0$ (Cero) $\rightarrow$ **Negro casi transparente** ($\alpha \approx 0.05$).
>    * $v < 0$ (Negativo) $\rightarrow$ Transición de Negro a **Violeta** (`#8C00E6`).
>    * Opacidad/Brillo dinámico modulado por la magnitud $|v|^{1.2}$.

---

## 🎯 1. Definición Estricta de Alcance (In Scope vs. Out of Scope)

### ✅ Dentro del Alcance (IN SCOPE)
* **Frontend:** Vite + Vanilla JavaScript (ES Modules) + Three.js.
* **Escena 3D:** Cámara en perspectiva, luces básicas, grilla de referencia y controles de órbita/cámara.
* **Datos Sintéticos:** Generador local de $N$ hilos vectoriales sintéticos con posiciones $(x, y, z)$ y valores de activación $v \in [-1.0, 1.0]$.
* **Módulo de Shading Divergente (`DivergentShading.js`):**
  * Custom GLSL `ShaderMaterial` para GPU (Vertex + Fragment Shader).
  * Función auxiliar pura en JavaScript para cálculo de color/opacidad en CPU.
* **UI Component (`ThreadSliders.js`):**
  * Slider 1: `Thread Spacing (X)` (Rango: `0.1` a `10.0`, paso `0.1`).
  * Slider 2: `Thread Width (Z)` (Rango: `0.1` a `5.0`, paso `0.1`).
  * Slider 3: `Thread Thickness` (Rango: `1.0` a `10.0`, paso `0.5`).
* **Motor Espacial (`LayoutEngine.js`):** Mutación directa de arreglos `Float32Array` en GPU sin reconstruir geometrías.

### ❌ Fuera del Alcance (OUT OF SCOPE - NO IMPLEMENTAR)
* **NO** Backend Python, FastAPI, ni servidores remotos.
* **NO** Carga de archivos PDF, vectores de embeddings reales ni bases de datos (LanceDB).
* **NO** Aritmética vectorial ($A - B + C$), búsqueda semántica ni menú `setup.sh` complejo.
* **NO** Autoencoders Dispersos (SAE) ni API de Gemini/OpenAI.

---

## 📁 2. Estructura de Archivos del Proyecto

```text
thread-shading-lab/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.js                 <-- Orquestador de arranque
│   ├── style.css               <-- Estilos mínimos para layout y sliders
│   ├── engine/
│   │   └── Scene.js            <-- Inicialización de Three.js (Canvas, Cámara, Luces)
│   ├── visualizer/
│   │   ├── DivergentShading.js <-- GLSL Shaders y helper CPU
│   │   ├── ThreadFactory.js    <-- Creación de geometrías e intensidades de activación
│   │   └── LayoutEngine.js     <-- Matemática de actualización X, Z y Grosor
│   └── ui/
│       └── ThreadSliders.js    <-- Componente aislado HTML + Event Listeners
└── tests/
    ├── DivergentShading.test.js <-- Test unitario del algoritmo de color
    └── LayoutEngine.test.js    <-- Test unitario de matemática espacial
```

---

## 📋 3. Fases de Implementación (Paso a Paso)

### Fase 1: Entorno de Desarrollo y Escena 3D Base
1. **Inicializar proyecto Vite + Vanilla JS:**
   * Archivo `package.json` con dependencias: `three`, `vite`, `vitest`.
2. **Crear `src/engine/Scene.js`:**
   * Instanciar `THREE.Scene`, `THREE.PerspectiveCamera` (posición `(0, 5, 15)`), `THREE.WebGLRenderer` con `antialias: true`.
   * Agregar un `THREE.GridHelper(50, 50)` en $Y = 0$ para tener referencia espacial.
   * Configurar el loop de renderizado continuo mediante `requestAnimationFrame`.

---

### Fase 2: Módulo de Shading Divergente (`DivergentShading.js`)
1. **Crear `src/visualizer/DivergentShading.js`:**
   * Implementar la función de cálculo CPU `getDivergentColor(val, absMax)`:
     ```javascript
     export function getDivergentColor(val, absMax = 1.0) {
         const denom = absMax > 1e-9 ? absMax : 1.0;
         let t = Math.max(-1.0, Math.min(1.0, val / denom));
         const absT = Math.abs(t);
         const alpha = Math.min(Math.max(Math.pow(absT, 1.2), 0.05), 1.0);

         let r = 0.0, g = 0.0, b = 0.0;
         if (t >= 0) {
             r = t;       // Positivo: Negro -> Rojo (1.0, 0.0, 0.0)
         } else {
             const f = -t;
             r = 0.55 * f; // Negativo: Negro -> Violeta (0.55, 0.0, 0.9)
             b = 0.9 * f;
         }
         return { r, g, b, alpha };
     }
     ```
2. **Escribir Shaders GLSL para GPU:**
   * **Vertex Shader:**
     ```glsl
     attribute float intensity;
     varying float vIntensity;
     uniform float pointSize;

     void main() {
         vIntensity = intensity;
         vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
         float dist = length(mvPosition.xyz);
         gl_PointSize = clamp(pointSize * (300.0 / dist), 2.0, 60.0);
         gl_Position = projectionMatrix * mvPosition;
     }
     ```
   * **Fragment Shader:**
     ```glsl
     varying float vIntensity;
     uniform float baseOpacity;

     void main() {
         vec2 coord = gl_PointCoord - vec2(0.5);
         if (length(coord) > 0.5) discard; // Círculo perfecto

         float t = clamp(vIntensity, -1.0, 1.0);
         float absT = abs(t);
         float dynamicAlpha = clamp(pow(absT, 1.2), 0.05, 1.0) * baseOpacity;

         vec3 color = vec3(0.0);
         if (t >= 0.0) {
             color = vec3(t, 0.0, 0.0); // Positivo: Rojo
         } else {
             float f = -t;
             color = vec3(0.55 * f, 0.0, 0.9 * f); // Negativo: Violeta
         }

         gl_FragColor = vec4(color, dynamicAlpha);
     }
     ```
3. **Exportar la función `createDivergentMaterial(pointSize)`** que retorne un `THREE.ShaderMaterial` configurado con `transparent: true`, `depthWrite: false` y `blending: THREE.NormalBlending`.

---

### Fase 3: Fábrica de Hilos Sintéticos con Activación (`ThreadFactory.js`)
1. **Generar datos sintéticos enriquecidos con valores de activación:**
   * Crear la función `createSyntheticThreads(count = 5, pointsPerThread = 100)`:
     ```javascript
     {
       id: 0,
       label: "Vector 0",
       rawValues: [ /* 100 floats sintéticos entre -1.0 y 1.0 */ ],
       lineMesh: null,   // THREE.LineSegments
       pointsMesh: null  // THREE.Points con ShaderMaterial
     }
     ```
2. **Asignar atributos de Buffer a la Geometría:**
   * Crear `positions` (`Float32Array` de tamaño `pointsPerThread * 3`).
   * Crear `intensities` (`Float32Array` de tamaño `pointsPerThread`) asignando directamente el valor de activación sintético $v \in [-1.0, 1.0]$.
   * Asignar `geometry.setAttribute('intensity', new THREE.BufferAttribute(intensities, 1))`.
3. **Construir Mallas:**
   * Usar `createDivergentMaterial()` para la malla de puntos (`THREE.Points`).
   * Usar `THREE.LineBasicMaterial` con colores de vértices (`vertexColors: true`) calculados vía `getDivergentColor()` para la estructura de la línea.
   * **REGLA CRÍTICA:** Asignar `frustumCulled = false` a las mallas de líneas y puntos.

---

### Fase 4: Motor Espacial y Sliders (`LayoutEngine.js` & `ThreadSliders.js`)
1. **Implementar `updateAllThreadPositions(threads, config)` en `LayoutEngine.js`:**
   * Recorrer cada hilo $i$ y aplicar offset horizontal $X = i \times \text{config.threadSpacing}$.
   * Recorrer el atributo `position` de cada punto $p$ y escalar la profundidad $Z$:
     $$\text{posZ}_p = p \times \text{pointSpacing} \times \text{config.threadWidth}$$
   * Indicar actualización a la GPU: `positionsAttribute.needsUpdate = true` y `geometry.computeBoundingSphere()`.
   * Actualizar el tamaño del shader en la GPU:
     ```javascript
     pointsMesh.material.uniforms.pointSize.value = config.threadThickness * 1.5;
     ```
2. **Crear `src/ui/ThreadSliders.js`:**
   * Exportar `threadSlidersMarkup()` con los 3 sliders HTML:
     * Separación ($X$)
     * Longitud ($Z$)
     * Grosor (Puntos)
   * Exportar `wireThreadSliders(threads, config)` conectando los eventos `oninput` con `updateAllThreadPositions()`.

---

## ⚠️ 4. Lecciones Aprendidas e Invariantes Técnicas (OBLIGATORIO)

El agente de IA **DEBE** aplicar rigurosamente las siguientes reglas para prevenir bugs de renderizado WebGL:

### 1. Desactivación de Frustum Culling (`frustumCulled = false`)
* **Problema:** Three.js descarta objetos fuera de la vista usando una esfera delimitadora (`boundingSphere`) calculada al inicio. Al modificar la escala $Z$ o separar en $X$, los hilos pueden desaparecer repentinamente si la cámara gira o se acerca.
* **Solución Obligatoria:** Fijar `frustumCulled = false` en todas las mallas:
  ```javascript
  lineMesh.frustumCulled = false;
  pointsMesh.frustumCulled = false;
  ```

### 2. Configuración de Transparencia y Blending en Shaders
* **Problema:** Puntos con opacidad dinámica baja pueden solaparse de forma opaca si la memoria de profundidad (*depth buffer*) bloquea los píxeles traseros.
* **Solución Obligatoria:** Desactivar escritura de profundidad e integrar transparencia limpia en el `ShaderMaterial`:
  ```javascript
  transparent: true,
  depthWrite: false,
  blending: THREE.NormalBlending
  ```

### 3. Mutación de Buffers In-Situ (Cero Re-creación de Geometría)
* **Problema:** Re-crear objetos `new THREE.BufferGeometry()` o `new THREE.Mesh()` en cada movimiento del slider causa fugas de memoria (*memory leaks*) y congelamientos en el navegador.
* **Solución Obligatoria:** Mutar el arreglo `Float32Array` existente e informar a la GPU:
  ```javascript
  const positions = geometry.attributes.position;
  // Modificar positions.array in-situ
  positions.needsUpdate = true;
  geometry.computeBoundingSphere();
  ```

### 4. Limitaciones de Grosor de Líneas en WebGL (`LineBasicMaterial`)
* **Problema:** En muchas plataformas y navegadores (especialmente sobre ANGLE/Windows/macOS), la especificación de WebGL limita el grosor de `LineBasicMaterial.linewidth` a máximo **1 píxel**, ignorando valores mayores.
* **Solución Obligatoria:** El slider de "Grosor" debe controlar el tamaño de los puntos (`PointsMaterial.size`), los cuales sí escalan correctamente en GPU con `sizeAttenuation: true`.

---

## 🧪 5. Pruebas y Verificación

### Test Unitario 1: Algoritmo de Shading (`tests/DivergentShading.test.js`)
```javascript
import { describe, it, expect } from 'vitest';
import { getDivergentColor } from '../src/visualizer/DivergentShading.js';

describe('Divergent Shading CPU Algorithm', () => {
    it('debe mapear valores positivos a Rojo con opacidad proporcional', () => {
        const { r, g, b, alpha } = getDivergentColor(1.0, 1.0);
        expect(r).toBeCloseTo(1.0, 5);
        expect(g).toBe(0.0);
        expect(b).toBe(0.0);
        expect(alpha).toBeCloseTo(1.0, 5);
    });

    it('debe mapear el valor cero a Negro con opacidad mínima (~0.05)', () => {
        const { r, g, b, alpha } = getDivergentColor(0.0, 1.0);
        expect(r).toBe(0.0);
        expect(g).toBe(0.0);
        expect(b).toBe(0.0);
        expect(alpha).toBeCloseTo(0.05, 5);
    });

    it('debe mapear valores negativos a Violeta', () => {
        const { r, g, b } = getDivergentColor(-1.0, 1.0);
        expect(r).toBeCloseTo(0.55, 5);
        expect(g).toBe(0.0);
        expect(b).toBeCloseTo(0.9, 5);
    });
});
```

### Test Unitario 2: Matemática de Disposición Espacial (`tests/LayoutEngine.test.js`)
```javascript
import { describe, it, expect } from 'vitest';

describe('LayoutEngine Math', () => {
    it('debe calcular correctamente las posiciones X y Z', () => {
        const index = 2;
        const spacingX = 3.0;
        const posX = index * spacingX;
        expect(posX).toBe(6.0);

        const pointIdx = 5;
        const widthZ = 1.5;
        const baseZ = 0.1;
        const posZ = pointIdx * baseZ * widthZ;
        expect(posZ).toBeCloseTo(0.75, 5);
    });
});
```

### Checklist de Verificación Manual
* [ ] Iniciar el proyecto con `npm run dev`.
* [ ] **Verificación de Colores:** Confirmar que los puntos con valores positivos se vean **rojos**, los valores cero sean **negros/casi invisibles**, y los valores negativos se vean **violetas/púrpuras**.
* [ ] **Verificación de Sliders:**
  * Slider **Separación (X)**: Separa o junta los hilos horizontalmente.
  * Slider **Longitud (Z)**: Estira o comprime la profundidad de los hilos.
  * Slider **Grosor**: Modifica el tamaño de los puntos con shading divergente.
* [ ] **Cero Parpadeos:** Rotar la escena 3D y confirmar que ningún hilo desaparezca por frustum culling.