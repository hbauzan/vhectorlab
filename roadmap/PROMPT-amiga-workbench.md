# Prompt — Amiga Workbench `/amiga` (MagicWB)

**Modo:** **serial** — una sesión / un slice. No agentes en paralelo.  
Empezá por el slice que indique el humano (default: **Slice 1** tras Slice 0 docs). No re-litigar Q1–Q10.

---

```text
Usando dev-protocol, implementá el roadmap Amiga Workbench `/amiga`.

## Contexto
Repo: VHectorLab 3D / vhectorlab (Python/uv + Vite/Three.js + FastAPI).
Base: `main` actualizado (`git pull`).
SemVer: línea **2.4.x** (Slice 1 cierra con MINOR **2.4.0**).

Roadmap canónico (leelo COMPLETO antes de código):
  `roadmap/amiga-workbench.md`
Lecciones: `.agents/skills/dev-protocol/lessons-learned.md` — **§6.0e obligatorio**
  (+ §6.0d v25; §6.0 MPA).

## AISLAMIENTO (NO negociable)
1. **PROHIBIDO** tocar `src/v25/**`, `v25/**`, o “sync” a v25.
2. Trabajo nuevo SOLO en `amiga/` + `src/amiga/**`.
3. Legado `/` intacto salvo cambios MPA compartidos mínimos (`vite.mpa.js`, `vite.config.js`, tests MPA).
4. Antes de approval: `git diff -- src/v25 v25` vacío.
5. Este epic **NO** es gui-art / gui-art-v25. Cero dependencia de ese norte visual.

## Decisiones CERRADAS (no re-preguntar)
- Bandera blanca `/amiga/`; Magic Workbench palette; Topaz self-host; CSS estático.
- Q2-A only (tipo+paleta+chrome mínimo). Cosplay Q2-C = otro roadmap.
- Canvas 3D look no se artea (Q3-A).
- Desktop + mobile; si mobile se complica → preguntar con diseño, no improvisar.
- HF Space = Slice 7 / final solamente.

## Estilo
No-fluff; TDD donde haya helpers puros (tokens, MPA inputs); módulos profundos.
Seguí `.agents/skills/dev-protocol/SKILL.md`
(clarify → branch `feat/amiga-<slice>` → implement → verify → docs → approval gate → git delivery con OK).

## Slice 1 — DoD (sesión típica de arranque)
1. `amiga/index.html` + `src/amiga/main.js` + `tokens.css` / `style.css`.
2. Topaz self-hosted bajo `src/amiga/assets/fonts/` (+ nota LICENSE en carpeta o README amiga).
3. Clase raíz / `:root` con serrucho (no AA) + font-size 16px (múltiplos de 8) + paleta MagicWB (§3.2 roadmap).
4. Vite MPA: entry `amiga` + redirect `/amiga` → `/amiga/`.
5. Tests MPA actualizados (amiga en `getViteInputs` / redirect).
6. Bump producto a **2.4.0** (manifest / package / CHANGELOG; Navbar legado solo si el DoD de SemVer del repo lo exige — **no** tocar version.js de v25).
7. Smoke: `/` y `/v25/` sin cambios visuales; `/amiga/` se ve MagicWB+Topaz.
8. APPROVAL GATE; ESPERÁ OK antes de push/merge.

## Slices siguientes
Ver tabla §6 de `roadmap/amiga-workbench.md`. Un slice por sesión.
```

---

## Prompt — Slice 2+

```text
Usando dev-protocol, continuá Amiga `/amiga` — SOLO Slice N.

Roadmap: `roadmap/amiga-workbench.md` §6 Slice N.
PROHIBIDO: `src/v25/**`, `v25/**`.
Legado `/` solo MPA shared si hace falta.
SemVer: PATCH 2.4.x salvo que el humano diga otro bump.

DoD: el de la fila Slice N del roadmap.
APPROVAL GATE; no push/merge sin OK.
```

---

## Prompt — Slice 7 (HF Space)

```text
Usando dev-protocol, cerrá Amiga `/amiga` — Slice 7 polish + HF Space.

Roadmap: `roadmap/amiga-workbench.md` §7–§9.
Confirmá con el humano si Space default queda en `/`, `/amiga/`, o link.
PROHIBIDO: tocar v25.
APPROVAL GATE → OK → git delivery + publish Space según proceso del repo.
```
