# Dual-Engine Deep Dimensional Inspection Ledger (5 Almas × 2 Embedding Engines)

- **Date**: 2026-09-19 21:18:59 UTC
- **Methodology**: Non-cosine, interval-bounded semantic firewall (`[lo_d, hi_d]`, `gap > 0`), zero heuristic rounding.
- **Corpora**: 5 canonical almas (`python`, `legal`, `receta`, `medicina`, `astronomia`), 110 clauses each ($N=110$), cross-domain pairwise Jaccard $< 0.05$.
- **Precision**: Full IEEE 754 float32 mantissa preserved via `f'{float(val):.17g}'` and exact `decimal.Decimal` arithmetic.
- **Sequential Isolation**: Strictly sequential process execution with garbage collection and cache clearance between engines.

---

## 1. Engine Performance & Geometry Ledger (10 Canonical Pairs)

| Pair | BGE-M3 (1024-D) Published | BGE-M3 Disjoint Count | Qwen2 1.5B (1536-D) Published | Qwen2 1.5B Disjoint Count |
| :--- | :---: | :---: | :---: | :---: |
| `python_receta` | `unpublished` | 0 | `unpublished` | 0 |
| `python_legal` | `unpublished` | 0 | `unpublished` | 0 |
| `legal_receta` | `unpublished` | 0 | `unpublished` | 0 |
| `python_medicina` | `unpublished` | 0 | `unpublished` | 0 |
| `python_astronomia` | `unpublished` | 0 | `unpublished` | 0 |
| `legal_medicina` | `unpublished` | 0 | `unpublished` | 0 |
| `legal_astronomia` | `unpublished` | 0 | `unpublished` | 0 |
| `receta_medicina` | `unpublished` | 0 | `unpublished` | 0 |
| `receta_astronomia` | `unpublished` | 0 | `unpublished` | 0 |
| `medicina_astronomia` | `unpublished` | 0 | `unpublished` | 0 |

> [!NOTE]
> En mazos crudos extendidos de 110 cláusulas completas sin poda (`--no-prune`), ningún candado fabrica brechas artificiales con $\epsilon$-relaxations. La publicación es estrictamente condicional a $\text{disjoint\_count} > 0$. Si $\text{disjoint\_count} == 0$, el candado permanece `unpublished` (`ok_unpublished`), satisfaciendo la invariante de fail-closed.

---

## 2. Computational Footprint

| Engine | Latency per Clause ($\mu\text{s}$) | Memory Footprint (RSS MB) | Output Tensor Hash (SHA-256) |
| :--- | :---: | :---: | :---: |
| `BAAI/bge-m3` | 31879.4 | 907.0 | `3db31bf76726f1c9b7c6018cf8d8a09d68a4bee724d575364e76aa6b513a4d38` |
| `Alibaba-NLP/gte-Qwen2-1.5B-instruct` | 65546.4 | 4206.3 | `6cc6e29286cd85d907108404125d3a284520a99443657032eefaa0828ca757a4` |

---

## 3. Coordinate Extrema Table (Full IEEE 754 float32)

Valores exactos de cota inferior mínima y cota superior máxima a lo largo de todas las dimensiones ($1024$ o $1536$), exportados sin ningún redondeo o truncamiento decimal:

| Alma | BGE-M3 Min | BGE-M3 Max | Qwen2 1.5B Min | Qwen2 1.5B Max |
| :--- | :--- | :--- | :--- | :--- |
| `python` | `-0.18358135223388672` | `0.25501355528831482` | `-0.445556640625` | `0.431396484375` |
| `legal` | `-0.19271396100521088` | `0.26203617453575134` | `-0.436279296875` | `0.427978515625` |
| `receta` | `-0.1839396208524704` | `0.26873290538787842` | `-0.4189453125` | `0.41455078125` |
| `medicina` | `-0.18371355533599854` | `0.26609382033348083` | `-0.421142578125` | `0.41552734375` |
| `astronomia` | `-0.17926396429538727` | `0.27362921833992004` | `-0.443359375` | `0.427734375` |

---

## 4. Audit Artefacts Index

- **BGE-M3 (1024-D)**:
  - Raw Tensors: `ddi_fw/out/extended_bge/rows.npz`
  - Geometric Audit: `ddi_fw/out/extended_bge/measure_audit.json`
  - Census & Votes: `ddi_fw/out/extended_bge/press.json`
  - Coordinates ($5 \times$ CSV): `ddi_fw/out/extended_bge/{alma}_extendido_1024d.csv`
  - Top 500 ($5 \times$ CSV): `ddi_fw/out/extended_bge/{alma}_top500_dimensiones_excitadas.csv`
- **Qwen2 1.5B (1536-D)**:
  - Raw Tensors: `ddi_fw/out/extended_qwen2/rows.npz`
  - Geometric Audit: `ddi_fw/out/extended_qwen2/measure_audit.json`
  - Census & Votes: `ddi_fw/out/extended_qwen2/press.json`
  - Coordinates ($5 \times$ CSV): `ddi_fw/out/extended_qwen2/{alma}_extendido_1536d.csv`
  - Top 500 ($5 \times$ CSV): `ddi_fw/out/extended_qwen2/{alma}_top500_dimensiones_excitadas.csv`
- **Historical Baseline**: `ddi_fw/out/rows.npz` (UNTOUCHED & PRESERVED).
