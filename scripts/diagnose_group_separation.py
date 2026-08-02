#!/usr/bin/env python3
"""Diagnose GROUP_1 vs GROUP_2 separation in RAW embeddings vs saved SAE.

Hit local API: /compare + /api/sae/encode. Print metrics for paint-vs-model triage.
"""

from __future__ import annotations

import json
import math
import sys
import urllib.request

BASE = "http://127.0.0.1:8000"

GROUP_1 = (
    "car, vehicle, automobile, truck, van, engine, piston, cylinder, crankshaft, camshaft, "
    "turbo, exhaust, muffler, radiator, transmission, gearbox, clutch, differential, driveshaft, "
    "steering, suspension, chassis, brake, brakes, rotor, wheel, wheels, tire, tires, rim, axle, "
    "bearing, pedal, accelerator, throttle, injector, manifold, intake, coolant, antifreeze, oil, "
    "filter, battery, alternator, starter, coil, fuse, relay, sensor, wiring, shock, spring, hood, "
    "trunk, windshield, headlight, bumper, fender, seatbelt, airbag, dashboard, speedometer, fuel, "
    "gasoline, diesel"
)
GROUP_2 = (
    "sophia, isabella, victoria, florence, beatrice, eleanor, charlotte, gloria, clara, penelope, "
    "serenity, compassion, tenderness, nostalgia, melancholy, empathy, affection, gratitude, "
    "forgiveness, solitude, devotion, harmony, poetry, symphony, melody, lullaby, romance, intimacy, "
    "solace, grace, bliss, euphoria, sweetness, delight, softness, warmth, kindness, hope, peace, "
    "innocence, purity, elegance, beauty, passion, desire, yearning, whisper, caress, embrace, soul, "
    "spirit, intuition, wisdom, reverie, fantasy, butterfly, blossom, rose, orchid, petal, jasmine, "
    "violet, peony, dahlia, magnolia"
)


def split_tokens(s: str) -> list[str]:
    return [t.strip() for t in s.replace("\n", " ").split(",") if t.strip()]


def post_json(path: str, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_json(path: str) -> dict:
    with urllib.request.urlopen(f"{BASE}{path}", timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def as_matrix(rows: list[list[float]]) -> list[list[float]]:
    return [[float(x) for x in row] for row in rows]


def densify_topk(encoded: dict) -> list[list[float]]:
    if encoded.get("format") != "topk_sparse" and "activations" in encoded:
        return as_matrix(encoded["activations"])
    indices = encoded["indices"]
    values = encoded["values"]
    dim = int(encoded["dimension"])
    out: list[list[float]] = []
    for idx_row, val_row in zip(indices, values):
        row = [0.0] * dim
        for i, v in zip(idx_row, val_row):
            d = int(i)
            if 0 <= d < dim:
                row[d] = float(v)
        out.append(row)
    return out


def l2(a: list[float]) -> float:
    return math.sqrt(sum(x * x for x in a)) or 1e-12


def cosine(a: list[float], b: list[float]) -> float:
    n = min(len(a), len(b))
    dot = sum(a[i] * b[i] for i in range(n))
    return dot / (l2(a) * l2(b))


def mean_vec(rows: list[list[float]]) -> list[float]:
    d = len(rows[0])
    out = [0.0] * d
    for r in rows:
        for i, v in enumerate(r):
            out[i] += v
    n = float(len(rows))
    return [v / n for v in out]


def mean_pairwise(rows: list[list[float]], max_pairs: int = 2000) -> float:
    n = len(rows)
    if n < 2:
        return float("nan")
    total = 0.0
    count = 0
    # Deterministic subsample if huge
    step = max(1, (n * (n - 1) // 2) // max_pairs)
    seen = 0
    for i in range(n):
        for j in range(i + 1, n):
            seen += 1
            if seen % step != 0:
                continue
            total += cosine(rows[i], rows[j])
            count += 1
            if count >= max_pairs:
                break
        if count >= max_pairs:
            break
    return total / max(count, 1)


def between_mean(a: list[list[float]], b: list[list[float]], max_pairs: int = 2000) -> float:
    total = 0.0
    count = 0
    step = max(1, (len(a) * len(b)) // max_pairs)
    seen = 0
    for i, ra in enumerate(a):
        for j, rb in enumerate(b):
            seen += 1
            if seen % step != 0:
                continue
            total += cosine(ra, rb)
            count += 1
            if count >= max_pairs:
                break
        if count >= max_pairs:
            break
    return total / max(count, 1)


def zscore_tanh_matrix(rows: list[list[float]], scale: float = 1.2) -> list[list[float]]:
    flat = [v for r in rows for v in r]
    n = len(flat)
    mean = sum(flat) / n
    var = sum((v - mean) ** 2 for v in flat) / n
    std = math.sqrt(var) or 1.0
    out = []
    for r in rows:
        out.append([math.tanh(scale * ((v - mean) / std)) for v in r])
    return out


def dim_contrast(g1: list[list[float]], g2: list[list[float]]) -> list[tuple[int, float, float, float]]:
    """Per-dim (idx, mean_g1, mean_g2, abs_diff)."""
    d = len(g1[0])
    m1 = mean_vec(g1)
    m2 = mean_vec(g2)
    return [(i, m1[i], m2[i], abs(m1[i] - m2[i])) for i in range(d)]


def active_feature_sets(rows: list[list[float]], eps: float = 1e-8) -> tuple[set[int], set[int]]:
    """Features that fire at least once in first half vs — caller passes group matrices."""
    fire = set()
    for r in rows:
        for i, v in enumerate(r):
            if abs(v) > eps:
                fire.add(i)
    return fire


def summarize(name: str, g1: list[list[float]], g2: list[list[float]]) -> dict:
    all_rows = g1 + g2
    contrast = dim_contrast(g1, g2)
    contrast_sorted = sorted(contrast, key=lambda t: t[3], reverse=True)
    diffs = [t[3] for t in contrast]
    diffs_sorted = sorted(diffs, reverse=True)
    d = len(diffs)
    top10 = contrast_sorted[:10]
    # How concentrated is between-group signal?
    total_diff = sum(diffs) or 1e-12
    top32_share = sum(diffs_sorted[:32]) / total_diff
    top64_share = sum(diffs_sorted[:64]) / total_diff
    # Dims where one group mean >> other (relative)
    strong = sum(1 for x in diffs if x > (sum(diffs) / d) * 3)
    # After viz normalization
    norm = zscore_tanh_matrix(all_rows)
    n1, n2 = norm[: len(g1)], norm[len(g1) :]
    n_contrast = dim_contrast(n1, n2)
    n_diffs = sorted((t[3] for t in n_contrast), reverse=True)
    # Visible under +Only (|t|>=0.01): fraction of cells
    visible = sum(1 for r in norm for v in r if abs(v) >= 0.01)
    total_cells = len(norm) * len(norm[0])
    # Nonzero raw cells
    nonzero = sum(1 for r in all_rows for v in r if abs(v) > 1e-8)

    f1 = active_feature_sets(g1)
    f2 = active_feature_sets(g2)
    inter = f1 & f2
    union = f1 | f2

    return {
        "space": name,
        "shape": [len(all_rows), d],
        "centroid_cosine_g1_g2": cosine(mean_vec(g1), mean_vec(g2)),
        "mean_cosine_within_g1": mean_pairwise(g1),
        "mean_cosine_within_g2": mean_pairwise(g2),
        "mean_cosine_between": between_mean(g1, g2),
        "separation_gap": (
            (mean_pairwise(g1) + mean_pairwise(g2)) / 2.0 - between_mean(g1, g2)
        ),
        "dim_contrast_mean": sum(diffs) / d,
        "dim_contrast_max": diffs_sorted[0],
        "dim_contrast_p95": diffs_sorted[max(0, int(0.05 * d) - 1)],
        "top32_contrast_share": top32_share,
        "top64_contrast_share": top64_share,
        "dims_3x_mean_contrast": strong,
        "nonzero_cell_frac": nonzero / total_cells,
        "viz_norm_visible_frac_|t|>=0.01": visible / total_cells,
        "features_fire_g1": len(f1),
        "features_fire_g2": len(f2),
        "features_jaccard": (len(inter) / len(union)) if union else 0.0,
        "top10_contrast_dims": [
            {"dim": i, "mean_g1": a, "mean_g2": b, "abs_diff": diff}
            for i, a, b, diff in top10
        ],
        "norm_dim_contrast_max": n_diffs[0],
        "norm_top32_share": sum(n_diffs[:32]) / (sum(n_diffs) or 1e-12),
    }


def main() -> int:
    g1_tok = split_tokens(GROUP_1)
    g2_tok = split_tokens(GROUP_2)
    texts = g1_tok + g2_tok
    print(f"tokens: G1={len(g1_tok)} G2={len(g2_tok)} total={len(texts)}")

    status = get_json("/api/sae/status")
    cfg = status.get("config") or {}
    print(
        "SAE status:",
        f"trained={status.get('is_trained')}",
        f"hidden={cfg.get('hidden_dim')}",
        f"k={cfg.get('k')}",
        f"n_train={((status.get('metrics') or {}).get('total_vectors'))}",
    )

    compare = post_json("/compare", {"texts": texts})
    items = compare["items"]
    assert len(items) == len(texts)
    raw = as_matrix([it["embedding"] for it in items])
    g1_raw, g2_raw = raw[: len(g1_tok)], raw[len(g1_tok) :]

    enc = post_json("/api/sae/encode", {"embeddings": raw})
    sae = densify_topk(enc)
    assert len(sae) == len(raw)
    g1_sae, g2_sae = sae[: len(g1_tok)], sae[len(g1_tok) :]

    raw_s = summarize("RAW_768", g1_raw, g2_raw)
    sae_s = summarize("SAE_sparse_dense", g1_sae, g2_sae)

    # Paint proxy: with Amplitude=1.0, peak Y displacement = max|val|
    def peak_abs(rows: list[list[float]]) -> float:
        return max(abs(v) for r in rows for v in r)

    raw_s["peak_abs_activation"] = peak_abs(raw)
    sae_s["peak_abs_activation"] = peak_abs(sae)
    raw_s["peak_Y_at_amp_1"] = raw_s["peak_abs_activation"] * 1.0
    sae_s["peak_Y_at_amp_1"] = sae_s["peak_abs_activation"] * 1.0
    raw_s["peak_Y_at_amp_40"] = raw_s["peak_abs_activation"] * 40.0
    sae_s["peak_Y_at_amp_40"] = sae_s["peak_abs_activation"] * 40.0

    report = {"raw": raw_s, "sae": sae_s}
    print(json.dumps(report, indent=2))

    # Verdict block
    print("\n=== VERDICT HINTS ===")
    gap_raw = raw_s["separation_gap"]
    gap_sae = sae_s["separation_gap"]
    print(f"RAW separation_gap (within - between cosine): {gap_raw:.4f}")
    print(f"SAE separation_gap (within - between cosine): {gap_sae:.4f}")
    print(f"RAW centroid cosine G1↔G2: {raw_s['centroid_cosine_g1_g2']:.4f} (lower = more opposite)")
    print(f"SAE centroid cosine G1↔G2: {sae_s['centroid_cosine_g1_g2']:.4f}")
    print(
        f"SAE feature Jaccard (shared firing dims): {sae_s['features_jaccard']:.4f} "
        f"(1.0 = same features light up)"
    )
    print(
        f"Contrast concentrated in top-32 dims — RAW: {raw_s['top32_contrast_share']:.2%}, "
        f"SAE: {sae_s['top32_contrast_share']:.2%}"
    )
    print(
        f"Peak |activation| → Y@amp1: RAW={raw_s['peak_Y_at_amp_1']:.4f}, "
        f"SAE={sae_s['peak_Y_at_amp_1']:.4f} | Y@amp40: RAW={raw_s['peak_Y_at_amp_40']:.2f}, "
        f"SAE={sae_s['peak_Y_at_amp_40']:.2f}"
    )
    if gap_raw > 0.15 and sae_s["features_jaccard"] > 0.5:
        print(
            "→ Signal exists in RAW; SAE features heavily overlap groups → "
            "prefer Lane 1 (UX) + Lane 2 (dim sort on RAW or contrast), Lane 3 secondary."
        )
    elif gap_raw > 0.15 and gap_sae < gap_raw * 0.5:
        print(
            "→ RAW separates well but SAE loses gap → Lane 3 (retrain/wider vocab) "
            "or visualize RAW; Lane 2 on RAW still helps."
        )
    elif gap_raw < 0.08:
        print(
            "→ Weak RAW group separation for this lexicon — surprising for domains; "
            "check tokenization/duplicates. Lane 2 may still band dims."
        )
    else:
        print("→ Mixed: Lane 4 done; combine Lane 1 (readable) + Lane 2 (band dims).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
