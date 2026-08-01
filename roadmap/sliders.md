# 🗺️ Roadmap de Desarrollo: Thread Geometry & Spatial Sliders 3D

> **Instrucciones para el Agente de IA:**
> Construir un prototipo aislado e hiper-enfocado en WebGL (Vite + Vanilla JS + Three.js) que demuestre la reactividad en tiempo real de **3 sliders de control espacial sobre hilos/vectores 3D**:
> 1. **Separación Lateral ($X$):** Distancia entre hilos paralelos.
> 2. **Escala Longitudinal ($Z$):** Estiramiento/compresión de los puntos a lo largo del eje $Z$.
> 3. **Grosor Visual:** Tamaño de los puntos/líneas 3D.

---

## 🎯 1. Definición Estricta de Alcance (In Scope vs. Out of Scope)

### ✅ Dentro del Alcance (IN SCOPE)
* **Frontend:** Vite + Vanilla JavaScript (ES Modules) + Three.js.
* **Escena 3D:** Cámara en perspectiva, luces básicas, grilla de referencia y controles de órbita/cámara.
* **Datos Sintéticos:** Generador local de $N$ hilos vectoriales sintéticos (arreglos de floats sin backend) para pruebas.
* **UI Component (`ThreadSliders.js`):**
  * Slider 1: `Thread Spacing (X)` (Rango: `0.1` a `10.0`, paso `0.1`).
  * Slider 2: `Thread Width (Z)` (Rango: `0.1` a `5.0`, paso `0.1`).
  * Slider 3: `Thread Thickness` (Rango: `1.0` a `10.0`, paso `0.5`).
* **Motor de Transformación Espacial (`LayoutEngine.js`):** Mutación directa de arreglos `Float32Array` en la GPU sin reconstruir geometrías.

### ❌ Fuera del Alcance (OUT OF SCOPE - NO IMPLEMENTAR)
* **NO** Backend Python, FastAPI, ni servidores remotos.
* **NO** Carga de archivos PDF, vectores de embeddings reales ni bases de datos.
* **NO** Aritmética vectorial ($A - B + C$), búsqueda semántica ni menú `setup.sh` complejo.
* **NO** Modales, selectores de modelos, ni temas visuales adicionales.

---

## 📁 2. Estructura de Archivos del Proyecto

```text
thread-geometry-lab/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.js                 <-- Orquestador de arranque
│   ├── style.css               <-- Estilos mínimos para layout y sliders
│   ├── engine/
│   │   └── Scene.js            <-- Inicialización de Three.js (Canvas, Cámara, Luces)
│   ├── visualizer/
│   │   ├── ThreadFactory.js    <-- Creación de BufferGeometry para hilos y puntos
│   │   └── LayoutEngine.js     <-- Matemática de actualización X, Z y Grosor
│   └── ui/
│       └── ThreadSliders.js    <-- Componente aislado HTML + Event Listeners
└── tests/
    └── LayoutEngine.test.js    <-- Tests unitarios con Vitest
📋 3. Fases de Implementación (Paso a Paso)
Fase 1: Entorno de Desarrollo y Escena 3D Base
Inicializar proyecto Vite + Vanilla JS:
Archivo package.json con dependencias: three, vite, vitest.
Crear src/engine/Scene.js:
Instanciar THREE.Scene, THREE.PerspectiveCamera (posición (0, 5, 15)), THREE.WebGLRenderer con antialias: true.
Agregar un THREE.GridHelper(50, 50) en 
Y
=
0
Y=0
 para tener referencia espacial clara.
Configurar el loop de renderizado continuo mediante requestAnimationFrame.
Fase 2: Modelo de Datos Sintético y Fábrica de Hilos (ThreadFactory.js)
Crear generador de datos en src/visualizer/ThreadFactory.js:
Crear la función createSyntheticThreads(count = 5, pointsPerThread = 100) que genere un arreglo de objetos de hilo sintéticos:
code
JavaScript
{
  id: 0,
  label: "Vector 0",
  rawValues: [ /* 100 floats sintéticos entre -1.0 y 1.0 */ ],
  color: 0x6C63FF,
  lineMesh: null,   // Instancia THREE.Line
  pointsMesh: null  // Instancia THREE.Points
}
Construir geometrías con THREE.BufferGeometry:
Crear un arreglo de posiciones iniciales de tamaño pointsPerThread * 3 (Float32Array).
Asignar el atributo position a la geometría.
Crear THREE.LineBasicMaterial para la estructura del hilo.
Crear THREE.PointsMaterial con sizeAttenuation: true para los nodos/puntos.
REGLA CRÍTICA: Asignar frustumCulled = false a las mallas de líneas y puntos (ver Sección 4).
Agregar las mallas creadas a la escena Three.js.
Fase 3: Motor de Disposición Espacial (LayoutEngine.js)
Implementar updateAllThreadPositions(threads, config):
Leer las propiedades globales de configuración:
config.threadSpacing (Separación X)
config.threadWidth (Escala Z)
config.threadThickness (Grosor Puntos)
Matemática de transformación in-situ:
Para cada hilo 
i
i
 en el arreglo de hilos:
Calcular el offset horizontal: 
offsetX
=
i
×
config.threadSpacing
offsetX=i×config.threadSpacing
.
Posicionar la malla del hilo en 
X
=
offsetX
X=offsetX
.
Recorrer el atributo position del BufferGeometry del hilo y recalcular la coordenada 
Z
Z
 de cada punto 
p
p
:
posZ
p
=
p
×
pointSpacing
×
config.threadWidth
posZ 
p
​
 =p×pointSpacing×config.threadWidth
Marcar el atributo de posición para actualización en la GPU:
code
JavaScript
positionsAttribute.needsUpdate = true;
Recalcular la esfera delimitadora de la geometría:
code
JavaScript
geometry.computeBoundingSphere();
Actualización de Grosor:
Para cada hilo, actualizar el tamaño del material de puntos:
code
JavaScript
pointsMesh.material.size = config.threadThickness * 0.05;
pointsMesh.material.needsUpdate = true;
Fase 4: Componente Aislado de UI (ThreadSliders.js)
Crear src/ui/ThreadSliders.js:
Exportar la función threadSlidersMarkup() que retorne la estructura HTML limpia:
code
Html
<div id="thread-sliders-container" class="section-card">
  <!-- Slider 1: Spacing X -->
  <label for="thread-spacing-slider">Separación (X):</label>
  <input type="range" id="thread-spacing-slider" min="0.1" max="10.0" step="0.1" value="2.0">
  <span id="thread-spacing-val">2.0</span>

  <!-- Slider 2: Width Z -->
  <label for="thread-width-slider">Longitud (Z):</label>
  <input type="range" id="thread-width-slider" min="0.1" max="5.0" step="0.1" value="1.0">
  <span id="thread-width-val">1.0</span>

  <!-- Slider 3: Thickness -->
  <label for="thread-thickness-slider">Grosor Línea:</label>
  <input type="range" id="thread-thickness-slider" min="1.0" max="10.0" step="0.5" value="2.0">
  <span id="thread-thickness-val">2.0</span>
</div>
Exportar la función wireThreadSliders(threads, config):
Conectar los eventos oninput de cada slider para:
Actualizar el valor en el objeto config.
Actualizar el texto numérico del indicador (<span>).
Invocar inmediatamente updateAllThreadPositions(threads, config) para lograr reactividad fluida a 60 fps.
⚠️ 4. Lecciones Aprendidas e Invariantes Técnicas (OBLIGATORIO)
El agente de IA DEBE aplicar rigurosamente las siguientes reglas para prevenir bugs de renderizado WebGL:
1. Desactivación de Frustum Culling (frustumCulled = false)
Problema: Three.js descarta objetos fuera de la vista de la cámara usando una esfera delimitadora (boundingSphere) calculada al crear la geometría. Al mover los sliders, la geometría se estira o desplaza en 
X
/
Z
X/Z
, pero si la cámara se mueve, Three.js puede asumir erróneamente que el objeto está fuera de cuadro y hacer que desaparezca por completo de la pantalla.
Solución Obligatoria: Fijar frustumCulled = false en todas las mallas de hilos/puntos:
code
JavaScript
lineMesh.frustumCulled = false;
pointsMesh.frustumCulled = false;
2. Mutación de Buffers In-Situ (Cero Re-creación de Geometría)
Problema: Re-crear objetos new THREE.BufferGeometry() o new THREE.Mesh() en cada movimiento del slider causa fugas de memoria (memory leaks) y congelamientos en el navegador.
Solución Obligatoria: Mutar el arreglo de posiciones Float32Array existente e informar a Three.js mediante la bandera needsUpdate:
code
JavaScript
const positions = geometry.attributes.position;
// Modificar valores de positions.array
positions.needsUpdate = true;
geometry.computeBoundingSphere();
3. Limitaciones de Grosor de Líneas en WebGL (LineBasicMaterial)
Problema: En muchas plataformas y navegadores (especialmente sobre ANGLE/Windows/macOS), la especificación de WebGL limita el grosor de LineBasicMaterial.linewidth a máximo 1 píxel, ignorando valores mayores.
Solución Obligatoria: El slider de "Grosor" debe controlar el tamaño de los puntos (PointsMaterial.size), los cuales sí escalan correctamente en GPU con sizeAttenuation: true.
🧪 5. Pruebas y Verificación
Test Unitario (tests/LayoutEngine.test.js)
El agente debe escribir una prueba unitaria con Vitest que verifique la matemática de transformación de coordenadas sin necesidad de un navegador completo:
code
JavaScript
import { describe, it, expect } from 'vitest';
import { executeLayoutMath } from '../src/visualizer/LayoutEngine.js';

describe('LayoutEngine Math Tests', () => {
    it('debe calcular la coordenada X correcta según el índice e intervalo', () => {
        const threadIndex = 3;
        const spacingX = 2.5;
        const posX = threadIndex * spacingX;
        expect(posX).toBe(7.5);
    });

    it('debe escalar las posiciones Z según el factor de ancho Z', () => {
        const pointIndex = 10;
        const baseSpacing = 0.1;
        const zWidth = 2.0;
        const posZ = pointIndex * baseSpacing * zWidth;
        expect(posZ).toBeCloseTo(2.0, 5);
    });
});
Checklist de Verificación Manual

Iniciar el servidor local con npm run dev.

Mover el slider Separación (X): Los hilos sintéticos deben separarse o juntarse horizontalmente de forma suave.

Mover el slider Longitud (Z): Los puntos de cada hilo deben estirarse o comprimirse a lo largo de la profundidad.

Mover el slider Grosor: El tamaño visual de los puntos debe aumentar o disminuir.

Rotar la cámara y verificar que ningún hilo desaparezca repentinamente al modificar los valores.