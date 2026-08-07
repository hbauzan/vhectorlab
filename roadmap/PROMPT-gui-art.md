# Prompt — agente GUI & Art (VHectorLab 3D)

Copiá y pegá el bloque siguiente en una sesión nueva.

---

```text
Usando dev-protocol, trabajá el epic GUI & Art de VHectorLab 3D.

## Contexto
Repo: `vhectorlab` (Python/uv + Vite/Three.js + FastAPI).
Base: `main` actualizado (`git pull` primero).
Producto en HF: `hbauzan/llm-semantic-visualizer` (sdk docker, cpu-basic).
Versión actual de referencia: ver `manifest.json` / Navbar `version-tag`.

Leé ANTES de codear:
1. `.agents/skills/dev-protocol/SKILL.md` + `lessons-learned.md` (sobre todo §1 WebGL, §3 nav, §4 UI, §4.1/4.1b mobile, §4.7 EN, §4.13 tips, §7 SemVer)
2. `roadmap/gui-art.md` (norte + inventario + decisiones abiertas A1–A6)
3. `CONTEXT.md` (glosario)
4. `src/style.css` `:root` tokens + glass + mobile MQ
5. `src/ui/appViewDefaults.js` (startup ARITHMETIC|ANALYSIS|POINTS)

## Norte (no negociar sin preguntar)
- El canvas 3D es el héroe; chrome = cristal fino, no dashboard genérico.
- Portrait-first en phone; landscape corto sigue mobile chrome (`MOBILE_MQ`).
- Copy EN only. Tips “i” cortos. Sin landscape-gate.
- No romper scroll Top-10 / cosine ni docks colapsables.

## Primero: preguntame A1–A6 de roadmap/gui-art.md
No asumas tipografía, emoji, rampa de color, ni scope del primer slice.
Cerrá las respuestas en `roadmap/gui-art.md` y recién ahí codeá.

## Estilo de trabajo
- Branch `feat/gui-art-<slice>` desde `main`.
- Vertical slices + TDD en helpers puros.
- Auto-verificar: desktop + phone portrait + phone landscape (DevTools o real).
- Sync docs condicional (CHANGELOG / lessons / CONTEXT si cambia lenguaje de dominio).
- SemVer: PATCH para polish; MINOR si aparece superficie nueva de producto.
- Hand off en approval gate. Con OK explícito: commit → push → merge main → push main → publicar HF Space (`git push --force` a `https://huggingface.co/spaces/hbauzan/llm-semantic-visualizer` HEAD:main, HF_SPACE_FORCE_PUSH=1).

## Fuera de alcance
Backend/SAE math, MESH, landscape-gate, i18n framework, refactors masivos sin slice visual demoable.

## Definition of done (slice)
- Se ve claramente mejor en al menos una superficie (chrome 2D o look 3D).
- Tests verdes; mobile no regresa a “lista cortada” / sin joystick en landscape.
- Lecciones actualizadas si descubrís una invariante visual nueva.
```
