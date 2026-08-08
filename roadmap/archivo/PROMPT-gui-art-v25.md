# Prompt — agente VHectorLab-3D `/v25/` (una fase por sesión)

Copiá el bloque siguiente en una sesión **nueva**. Completá `FASE_N` y el nombre de fase.

**Fuente de verdad:** [`gui-art-v25.md`](./gui-art-v25.md)  
**Protocolo:** `.agents/skills/dev-protocol/SKILL.md` + módulos bajo demanda + `lessons-learned.md` **siempre**.

---

```text
Usando dev-protocol, ejecutá SOLO la Fase FASE_N del roadmap `roadmap/gui-art-v25.md` (VHectorLab-3D /v25/).

## Reglas duras
- Marca siempre: **VHectorLab-3D** (nunca “Quantum Vector Lab”).
- Trabajo nuevo SOLO bajo `/v25/` (`v25/index.html`, `src/v25/**`). No romper ni “arreglar” el legado en `/` salvo smoke check.
- Una fase por sesión. No adelantar la siguiente.
- Stack: vanilla JS + Vite MPA. No React/TS/Tailwind.
- Backend/API: no cambiar contratos `/api`.
- HF Space: NO publicar.
- Approval gate: al terminar, reportá + esperá OK humano antes de push/merge.
- Al cerrar: actualizar tabla §10 + hand-off (plantilla §5) en `roadmap/gui-art-v25.md` y lessons si hay invariante nueva (`v25:`).

## Antes de codear
1. `git pull` en `main`; branch `feat/v25-<slug>` según la fase.
2. Leé: `roadmap/gui-art-v25.md` (tu fase + §1–§3 + hand-off de la fase anterior).
3. Leé lessons-learned (WebGL/nav/UI/mobile/EN/tips/SemVer según aplique).
4. Si el hand-off anterior marca riesgos abiertos, resolvé o preguntá — no asumas.

## Norte visual (fases chrome)
- Dark/fluo lab, no neón chillón; botones 3D pressable; chapa (menos glass).
- Sin portal de fondo.
- Copy EN técnico corto; reducir emoji.
- Canvas es héroe solo cuando la fase lo incluya.

## DoD
El DoD de tu fase en `gui-art-v25.md` §6–§7. Auto-verificá: tests + `/v25/` + smoke `/`.
Hand-off explícito para el próximo agente.
```

---

## Cómo usar (operador humano)

1. Abrí sesión nueva.
2. Pegá el prompt con p.ej. `FASE_N = 1` y slug mental `scaffold`.
3. Probá el DoD.
4. OK explícito → el agente entrega git (sin HF).
5. Sesión nueva para Fase 2, etc.

## Mapa rápido fase → slug sugerido

| Fase | Slug branch |
| :---: | :--- |
| 1 | `feat/v25-scaffold` |
| 2 | `feat/v25-tokens` |
| 3 | `feat/v25-shell` |
| 4 | `feat/v25-header` |
| 5 | `feat/v25-arithmetic-chrome` |
| 6 | `feat/v25-right-hud-chrome` |
| 7 | `feat/v25-arithmetic-wire` |
| 8 | `feat/v25-canvas-wire` |
| 9 | `feat/v25-spatial-wire` |
| 10 | `feat/v25-compare` |
| 11 | `feat/v25-sae-viz` |
| 12 | `feat/v25-mobile` |
| 13 | `feat/v25-polish` |
