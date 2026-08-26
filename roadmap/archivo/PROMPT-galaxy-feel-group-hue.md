# Prompt — agente Galaxy feel + Group hue

Copiá y pegá el bloque siguiente en una sesión **nueva**.  
Roadmap: [`galaxy-feel-group-hue.md`](./galaxy-feel-group-hue.md) (2026-08-08).

**Modo de trabajo:** **serial** — una sesión / un slice. No lanzar agentes en paralelo.  
Empezá por **Slice 1** salvo que el humano diga otro.

---

```text
Usando dev-protocol, ejecutá el roadmap Galaxy feel + Group hue.

## Contexto
Repo: VHectorLab 3D / vhectorlab (Python/uv + Vite/Three.js).
Base: `main` actualizado (git pull first si aplica).
Roadmap canónico — leelo COMPLETO antes de cualquier código:
  `roadmap/galaxy-feel-group-hue.md`
Lecciones: `.agents/skills/dev-protocol/lessons-learned.md`
  — §3 WASD lerp; §4.11b group paint; §6.0d PROHIBIDO `src/v25/**`.
UI legacy only: `src/main.js`, `src/ui/*`, `src/visualizer/*`, `src/engine/*`
PROHIBIDO: tocar cualquier archivo bajo `src/v25/`.

## Decisiones YA CERRADAS (no re-preguntar)
- Galaxy: agrandar mundo UMAP + bajar WASD/QE + bajar mouse look — solo en GALAXY; al salir restaurar.
- Calibración elegante a juicio del agente (constantes documentadas); sin knobs nuevos de speed en v1.
- “Poca definición” = muy juntos + cuadrados → más escala + soft stars (disco circular con glow), no InstancedMesh spheres.
- Stars solo Galaxy POINTS; ANALYSIS/NAVIGATION intactos salvo helper compartido opt-in.
- Group hue bajo Group contrast, default OFF, ≥2 GROUP_*.
- Ramp: black (−1) → color picker del grupo (+1); transversal COMPARE (ANALYSIS/NAV/GALAXY; POINTS+RIBBONS donde ya pinta viz).
- Color picker+hex por GROUP_* (dinámico); persist `groupHueEnabled` + `groupHueColors`.
- Convive: hue reemplaza base divergent; Shared noise / Sign conflict siguen encima.
- t = activation normalizada existente; Galaxy sigue con cosine_vs_first como activation.
- Tips EN estilo fieldInfo; tip Group hue puede ser un poco más largo para ser explícito.
- SemVer: PATCH en línea 2.3.x salvo que humano diga otro.

## Slice a ejecutar en ESTA sesión
Slice 1 — Galaxy world scale + flight profile.

Si el humano indica otro slice del roadmap §6, hacé SOLO ese.
No adelantar slices siguientes “por si acá”.

### Definition of Done — Slice 1
1. Mundo Galaxy más grande (retocar `GALAXY_DEFAULT_SCALE` y/o mapping `threadSpacing` en `renderGalaxyData`) en sintonía con vuelo más lento.
2. Flight profile Galaxy-only en `Navigation` (o helper): moveSpeed + mouse look más bajos; leave Galaxy restaura defaults actuales.
3. Camera framing IT-core / bbox sigue OK tras el scale.
4. Tests unitarios del apply/restore de profile (y scale helper si aplica).
5. `npm test` verde en lo tocado; `git diff -- src/v25` vacío.
6. Branch `feat/galaxy-feel-group-hue` (o stage `feat/galaxy-flight-scale`).
7. APPROVAL GATE: cómo probar WASD/QE/mouse en Galaxy vs ANALYSIS; ESPERÁ OK antes de push/merge.

### Slices siguientes (NO implementar ahora; solo contexto)
2 Soft star POINTS (Galaxy)
3 Group hue UI + paint transversal
4 Polish/docs/CHANGELOG/lessons/smoke

## Estilo
No-fluff; TDD; módulos profundos; no expandir scope.
Ante duda de contrato: preguntá — no adivines.
Seguí `.agents/skills/dev-protocol/SKILL.md`
(clarify → branch → implement → verify → docs → approval gate → git delivery con OK).
```

---

## Prompt — Slice 2 (pegar cuando Slice 1 esté OK/mergeado)

```text
Usando dev-protocol, continuá Galaxy feel + Group hue — SOLO Slice 2.

Roadmap: `roadmap/galaxy-feel-group-hue.md` §3.3 + §6 Slice 2.
PROHIBIDO: `src/v25/**`.

DoD:
- Galaxy POINTS: soft circular “stars” con glow hacia el color final (fragment mask radial; no squares).
- Tamaño / clamp `gl_PointSize` en sintonía con el scale de Slice 1.
- Non-Galaxy POINTS sin regresión visual.
- Tests o flag/helper verificable; APPROVAL GATE; no push/merge sin OK.
```

---

## Prompt — Slice 3

```text
Usando dev-protocol, continuá Galaxy feel + Group hue — SOLO Slice 3.

Roadmap: `roadmap/galaxy-feel-group-hue.md` §3.4–§3.5 + §4–§5 + §6 Slice 3.
PROHIBIDO: `src/v25/**`.

DoD:
- Toggle Group hue (default OFF) bajo Group contrast + “i” explícita EN.
- Color picker+hex dinámico por GROUP_*; persistencia; gate ≥2 grupos.
- Paint: black (−1) → group color (+1); base reemplaza divergent cuando ON; Shared noise / Sign conflict siguen.
- Transversal COMPARE (ANALYSIS/NAV/GALAXY; POINTS+RIBBONS donde aplica viz paint).
- Tests paint + persist + gate; APPROVAL GATE.
```

---

## Prompt — Slice 4 (cierre)

```text
Usando dev-protocol, cerrá Galaxy feel + Group hue — SOLO Slice 4 (polish/docs).

Roadmap: `roadmap/galaxy-feel-group-hue.md` §7–§10.
PROHIBIDO: `src/v25/**` (verificar `git diff -- src/v25` vacío).

DoD:
- CHANGELOG EN; CONTEXT si hace falta; lessons-learned (flight profile constants, star disc, group hue layering + zero-coverage choice).
- Smoke §7 en el reporte.
- SemVer PATCH confirmado con humano si hace falta.
- APPROVAL GATE → OK → git delivery según protocol.
```

---

## Notas para el humano

1. Un prompt de slice por sesión. Empezá por Slice 1.
2. Después de cada APPROVAL GATE, dale OK explícito antes de push/merge.
3. Si el agente propone constantes de scale/speed, pedile el valor final en el reporte y probá 30s en Galaxy antes de OK.
4. Group hue es transversal: validá también ANALYSIS, no solo Galaxy.
