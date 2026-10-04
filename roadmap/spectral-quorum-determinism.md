# Roadmap: Spectral Quorum Determinista (Alineación DDI-FW)

**Estado:** ACTIVO (En planificación / listo para ejecución por slices)  
**Fecha:** 2026-10-04  
**Área:** `src/visualizer/`, `src/ui/`, `tests/`  
**Referencia de dominio:** DDI-FW (`ddi_fw/ecualizador/`, Protocolos 01–04)

---

## 1. Objetivo y Principio Rector

**Mandan los datos, no las sensaciones.**

Este roadmap define la corrección integral y reestructuración determinista del módulo **Spectral Quorum** en VHectorLab 3D. El objetivo es eliminar cualquier heurística artificial o afirmación inflada generada por IA en el commit `ce1109b` (v3.3.0), restaurando la fidelidad matemática rigurosa con la investigación original de **Deep Dimensional Inspector Firewall (`ddi-fw`)**.

### Principios no negociables:
1. **Cero alucinaciones y cero "dejar contento"**: Si dos grupos comparten dimensiones discriminantes frente a un tercero, se muestran compartidas; no se fuerza exclusividad mutua mediante trucos algorítmicos.
2. **Si no hay señal, no se inventa señal**: Un conjunto de palabras aleatorias sin correlación temática interna debe arrojar un Quorum vacío (pantalla apagada / silencio base), en lugar de forzar a pintar el 10% del espacio vectorial.
3. **Cero redondeos en el motor de cálculo**: Todo el pipeline de centro de masa, varianza y separabilidad opera estrictamente en `Float64Array`. Las inspecciones y tooltips en UI formatean a 6 decimales exactos (`.toFixed(6)`), reflejando la resolución sin truncamientos engañosos.
4. **Respeto a la bidireccionalidad de la firma**: Una dimensión que se deprime (valor sistemáticamente más bajo o negativo en un grupo) es tan discriminante como una que se eleva.

---

## 2. Diagnóstico Técnico de la Auditoría

La auditoría sobre el código de `ce1109b` y sobre los vectores reales de `BAAI/bge-m3` (10,338 palabras × 1024-D) identificó las siguientes discrepancias y bugs:

### 2.1. Distorsiones respecto a `ddi-fw`
* **Exclusividad forzada artificialmente**: `spectralQuorum.js` implementó $\Delta_g(d) = \mu_g(d) - \max_{h \neq g} \mu_h(d)$ exigiendo $\Delta > 0$. Por definición del $\text{argmax}$, solo un grupo puede ser el máximo en cada coordenada. El código impedía matemáticamente que dos grupos compartieran una dimensión, vendiendo una tautología de código como un "hallazgo empírico de BGE-M3".
* **Ceguera a la infra-activación / signo**: Al descartar $\Delta \le 0$, se eliminó la mitad de la firma semántica ($50\%$ de las dimensiones informativas en BGE-M3 distinguen por descenso relativo).
* **Cuota ciega de 10%**: El cálculo seleccionaba siempre las $\lceil 0.10 \times D \rceil = 103$ dimensiones principales sin evaluar significancia estadística ni umbral mínimo de $S_d$, pintando firmas incandescentes sobre palabras seleccionadas al azar.
* **Narrativa de "4º a 6º decimal" desmentida por datos**: Las diferencias reales $\Delta$ en BGE-M3 entre grupos temáticos residen en el 2º a 3º decimal ($\Delta \in [0.006, 0.053]$). La resolución a 6 decimales es una exigencia de acumulación numérica en memoria (`Float64` frente a deriva de hardware), no la magnitud de la separación macroscópica.

### 2.2. Bugs de Software Confirmados
* **Bug B1 (Falsa firma en grupos dominados)**: En `spectralQuorum.js:L203`, si un grupo nunca lidera en ninguna dimensión, el fallback `r === 0` le asigna `isQuorum: true` con `relativeScore: 1.0` a una dimensión donde $\Delta < 0$, encendiéndole una columna falsa.
* **Bug B2 (Tinte de ribbons en CPU)**: En `groupHuePaint.js:L103`, se pasa como parámetro fijo `oppositeHighlightColor` a `applyGroupDimPaint`. En modo `RIBBONS` o con `threadLinesVisible`, el render en CPU ignora `spectralHighlightColor`.
* **Bug B3 (Parámetro huérfano)**: `Instancer.js` envía `{ decimalGain }` a `computeSpectralQuorumMetrics`, pero la función no lo consume.

---

## 3. Especificación Matemática Formal

### 3.1. Centros y Dispersión (`Float64`)
Dado un conjunto de $G \ge 2$ grupos con $N_g \ge 1$ tokens y dimensión $D$:
$$\mu_g(d) = \frac{1}{N_g} \sum_{i \in g} x_{i,d}, \quad \sigma_g^2(d) = \frac{1}{N_g} \sum_{i \in g} (x_{i,d} - \mu_g(d))^2$$
Para el conjunto complementario $\text{otros} = \{ h \in \text{Grupos} \mid h \neq g \}$:
$$\mu_{\text{otros}}(d) = \frac{1}{\sum_{h \neq g} N_h} \sum_{h \neq g} \sum_{i \in h} x_{i,d}$$
$$\sigma_{\text{otros}}(d) = \sqrt{\frac{1}{\sum_{h \neq g} N_h} \sum_{h \neq g} \sum_{i \in h} (x_{i,d} - \mu_{\text{otros}}(d))^2}$$

### 3.2. Contraste y Separabilidad Bidireccional ($S_d$)
Para cada dimensión $d$:
$$\Delta_g(d) = \mu_g(d) - \mu_{\text{otros}}(d)$$
$$\text{polaridad}_g(d) = \operatorname{sign}(\Delta_g(d)) \in \{+1, -1, 0\}$$
$$S_g(d) = \frac{|\Delta_g(d)|}{\sigma_g(d) + \sigma_{\text{otros}}(d) + \epsilon} \quad (\epsilon = 10^{-6})$$

* Si $N_g = 1$ (un solo token por grupo, $\sigma_g = 0$), el denominador utiliza $\sigma_{\text{otros}}(d) + \epsilon$. Si todos los grupos tienen $N = 1$, la separabilidad degenera limpiamente en el contraste crudo escalado $|\Delta_g(d)| / \epsilon$, ordenando por magnitud de diferencia sin divisiones espurias.

### 3.3. Criterio de Admisión al Quorum (Señal Real)
Una dimensión $d$ califica como miembro del Quorum del grupo $g$ si y solo si:
1. Supera el umbral de discriminación base: $S_g(d) \ge S_{\min}$ (configurable, default $S_{\min} = 1.0$, alineado a zona de separación de `ddi-fw`).
2. Se encuentra dentro del límite de capacidad máxima definido por el usuario:
   $$\text{rank}(d) < K_{\max} = \max\left(1, \left\lceil \frac{p}{100} \times D \right\rceil\right)$$
   donde $p$ es el porcentaje del slider (default 10%, $K_{\max} = 103$ en 1024-D).

**Consecuencia determinista**: Si un grupo no tiene ninguna dimensión con $S_g(d) \ge S_{\min}$ (ej. ruido o palabras incoherentes), el Quorum tiene longitud 0. **No se fuerza ninguna dimensión falsa.**

### 3.4. Ponderación de Pintura y Ganancia
Para un punto $i$ perteneciente al grupo $g$ en la dimensión $d$:
* Si $d \in \text{Quorum}_g$:
  * $\text{relScore} = \frac{S_g(d)}{\max_{k \in \text{Quorum}_g} S_g(k)} \in [0, 1]$.
  * $\text{highlight} = \min\left(1.0, \frac{\text{strength}}{100} \times \text{relScore} \times \frac{\text{decimalGain}}{10}\right)$.
  * $\text{cancel} = 0$.
* Si $d \notin \text{Quorum}_g$:
  * $\text{highlight} = 0$.
  * $\text{cancel} = \frac{\text{pajaCancelCoverage}}{100}$.

---

## 4. Slices de Ejecución (TDD)

### Slice 1: Reescritura Matemática del Núcleo (`src/visualizer/spectralQuorum.js`)
* Implementar cálculo `Float64` bidireccional ($|\Delta|$, polaridad $+/-$, $S_g(d)$ contra el resto).
* Implementar filtro por umbral de señal $S_{\min}$ con techo porcentual $K_{\max}$.
* Eliminar el fallback erróneo `r === 0`. Quorum vacío cuando no hay señal.
* Suite de tests unitarios exhaustiva en `tests/spectralQuorum.test.js`:
  1. Caso analítico sintético con valores exactos de $\Delta$ y $S_d$.
  2. Detección de firma por infra-activación / depresión ($\Delta < 0$).
  3. Firma compartida por afinidad entre 2 grupos frente a un 3º.
  4. Caso grupo aleatorio / ruido blanco: quorum vacío cuando $S < S_{\min}$.
  5. Regresión Bug B1: grupo dominado recibe `quorumCount: 0`, `topQuorumDims: []`.
  6. Precisión decimal: verificar que Float64 preserve deltas de orden $10^{-6}$.

### Slice 2: Integración en Pintura de CPU y GPU
* **Fix Bug B2**: Corregir `groupHuePaint.js` para aplicar `spectralHighlightColor` cuando `spectralQuorumEnabled` esté activo.
* Actualizar `groupDimContrast.js`:
  * `paintWeightsForSpectralQuorum`: recibir y propagar polaridad si aplica.
  * Mantener compatibilidad 100% con los shaders de GPU (`MeshFactory.js`, `DivergentShading.js`) y ribbons de Three.js.
* Limpiar la firma de llamadas en `Instancer.js` eliminando parámetros no utilizados.
* Pruebas de integración visual y cobertura en `tests/visualizationControls.test.js`.

### Slice 3: Ajustes de Controles UI y Formateo a 6 Decimales
* Asegurar que tooltips e inspección de valores numéricos de Spectral Quorum formateen con `.toFixed(6)`.
* Exponer o calibrar el umbral $S_{\min}$ (o mantener constante calibrada $1.0$ alineada a `ddi-fw`).
* Sincronizar estados de activación de controles (reactividad cuando hay $\ge 2$ grupos con $\ge 1$ item).

### Slice 4: Saneamiento de Documentación y Lecciones Aprendidas
* Actualizar `README.md`:
  * Retirar claims no comprobados ("exclusividad mutua como hallazgo", "decimales $10^{-4}$ a $10^{-6}$ como regla general").
  * Explicar el funcionamiento real: ecualización de separabilidad estadística, silencio de ruido base y amplificación de contraste.
* Actualizar `CHANGELOG.md` documentando la versión corregida.
* Actualizar `.agents/skills/dev-protocol/lessons-learned.md` (§4.15 y §8.10) con la formulación bidireccional y las métricas empíricas reales.

---

## 5. Criterios de Aceptación y Verificación

1. `npx vitest run tests/spectralQuorum.test.js tests/visualizationControls.test.js`: 100% de tests en verde.
2. Script de verificación empírica contra `public/vocab_embeddings.npz` confirmando:
   - Grupos temáticos reales generan quorums con $S_d \ge 1.0$ y reproducibilidad $>40\%$.
   - Grupos de palabras puramente aleatorias producen Quorums nulos o fuertemente atenuados.
3. Ribbons en modo CPU y puntos en modo GPU responden al mismo selector de color `#viz-spectral-hex`.
4. Ningún warning ni degradación en los modos `POINTS`, `RIBBONS`, `ANALYSIS` o `COMPARE`.
