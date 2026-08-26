# Roadmap — Shared noise: hide the pack, keep the distinct point

**Status:** Draft / talking — **do not implement** until the human says so.  
**Date:** 2026-08-26  
**Product:** VHectorLab 3D (`/`)  
**Predecessor:** [`archivo/shared-noise-coverage-knobs.md`](./archivo/shared-noise-coverage-knobs.md) (2.4.3 paint + min/max column) · parking [`open-shared-noise-knob.md`](./open-shared-noise-knob.md)

> **Goal (one sentence):** On each dimension, Shared noise **gradually hides tokens that look like others** (shared ruido), so what stays in view is the token(s) that **differ** on that dim — at the model’s native float precision.

---

## 0. Hypothesis (human)

Inside a model, some dims fire similarly for most tokens. ON/OFF + knob, **menos → más**, **gradual and visual**: first hide the closest matches (number + sign); then more of the pack. If 229 tokens agree and **one** does not, **that one is the signal**. The pack must be hideable. Precision = as many fraction digits as the live model’s float offers (typically float32).

**Vocabulary:** **ruido** = lo **compartido** (el pack). Not the leftover distinct point.

---

## 1. Locked

| ID | Decision |
| :--- | :--- |
| L1 | Per **token × dim** (a point on a thread), not “nuke the whole column”. `groupId` does not decide hide. |
| L2 | **229 iguales + 1 distinto:** el 1 **queda**. El pack se puede ir con el knob. (Cierra la pregunta “mayoría vs unanimidad” en este sentido: no es unanimidad de columna ni omitir al outlier.) |
| L3 | Hide = **out of vision** for the packed points (geometry, not paint-only). X **not** compacted. The distinct point **keeps** Y + color. |
| L4 | Gradual: knob raises how far still counts as “parecido”. Compare on the **native visualized float** (float32 / lo que emita el modelo), not colormap ε `0.01` and not a coarse percent that throws away digits. |
| L5 | Label **Shared noise** / **Similarity**. OFF = nobody hidden. |
| L6 | Zero coverage = colormap only. Separate. |
| L7 | Sign conflict / Group hue = reading, not this hide. |
| L8 | SAE (this lab, Top‑K reconstruct): **suspect wrong layer** for this hypothesis — see §3. Do not “fix Shared noise by training SAE harder” as the first move. Prefer judging the effect on **RAW** embeddings. |

**Correction:** a prior draft locked “omit the entire column for all tokens”. That would **delete the one token of interest**. Voided.

**Near relative:** `feat/shared-noise-per-word` (never on `main`) was closer than 2.4.3 column min/max. Not a merge-as-is: that branch used normalized `t` stick gaps and hard holes; here the human asked native floats + gradual pack hide.

---

## 2. Tension left in the air (not a blocker for §3)

**Case C — two packs, no single outlier:** 50 tokens at `+0.8`, 50 at `−0.7`. Each has buddies. If “hide whoever looks like someone else”, **both packs go** and the dim empties — you do **not** see a group concept as two blocks. If the human still wants C visible, that needs Keep / “only hide the global common wall”. **Not closed.** The 229+1 case **is** closed (L2).

---

## 3. SAE — for this goal, the suspicion is correct

Lab SAE = dictionary trained on the batch + **Top‑K largest latents per token** to **reconstruct** the vector.

It optimizes “explain this token with K shared parts”. Common, **large** activations survive. A millimetric unique residual is often **small** → Top‑K **drops** it. The yellow walls are successful shared codes, not a wiring bug.

So: SAE ON is a **different picture** (sparse dictionary). It is a weak place to hunt “the one float32 that differs on dim *k*”. RAW (Arctic 256-d, etc.) keeps those digits. Treating SAE as denoise-toward-distinctiveness is the wrong expectation.

A future SAE that **penalizes** high-frequency latents (IDF / common-mode) would be another epic. Not a prerequisite to Shared noise on RAW.

---

## 4. Out of scope (this draft)

- Compact X
- Revert to G1↔G2 column cancel
- Chrome-only A/mA as the fix
- Implementing before explicit OK

---

## 5. Next (talking)

1. Optionally close §2 (two packs / group blocks).  
2. Confirm first demo surface = COMPARE + RAW, SAE OFF.  
3. No code until explicit OK.
