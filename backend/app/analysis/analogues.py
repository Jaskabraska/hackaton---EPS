"""Simple historical analogue finder.

Finds hours with similar grid conditions by normalised Euclidean distance over
[total_load_mw, binding_loading_pct, hour_of_day, month]. No FAISS needed —
~1,460 sample vectors searched in milliseconds.
"""
from __future__ import annotations

import math
from functools import lru_cache

from ..grid import loader, state
from ..analysis.forecasts import shift_stem


@lru_cache(maxsize=1)
def _sample_vectors() -> list[dict]:
    """Lazily compute feature vectors for sampled hours across the year (~52 samples)."""
    from .. import config

    stems = sorted(p.stem for p in config.SNAPSHOTS_DIR.glob("*.json"))
    samples: list[dict] = []
    for i, stem in enumerate(stems):
        if i % 168 != 0:  # weekly samples for fast startup
            continue
        try:
            gs = state.compute_state(stem)
        except Exception:
            continue
        binding_pct = gs.binding_constraint.loading_percent if gs.binding_constraint else 0.0
        parts = stem.split("_")
        month = int(parts[1])
        hour = int(parts[3])
        samples.append({
            "stem": stem,
            "total_load_mw": gs.total_load_mw,
            "binding_loading_pct": binding_pct,
            "hour_of_day": hour,
            "month": month,
        })
    return samples


def _normalise_and_distance(a: dict, b: dict, ranges: dict) -> float:
    """Normalised Euclidean distance over feature vectors."""
    total = 0.0
    for key in ("total_load_mw", "binding_loading_pct", "hour_of_day", "month"):
        r = ranges.get(key, 1.0)
        if r == 0:
            continue
        diff = (a[key] - b[key]) / r
        total += diff * diff
    return math.sqrt(total)


def find_analogues(value: str, top_k: int = 3) -> dict:
    """Find the top_k most similar historical hours and report what happened next."""
    stem = loader.normalise_datetime(value)
    samples = _sample_vectors()

    if not samples:
        return {"available": False, "reason": "No sample vectors computed (dataset missing)."}

    # Build query vector
    try:
        gs = state.compute_state(stem)
    except FileNotFoundError:
        return {"available": False, "reason": f"Snapshot {stem} not found."}

    binding_pct = gs.binding_constraint.loading_percent if gs.binding_constraint else 0.0
    parts = stem.split("_")
    query = {
        "stem": stem,
        "total_load_mw": gs.total_load_mw,
        "binding_loading_pct": binding_pct,
        "hour_of_day": int(parts[3]),
        "month": int(parts[1]),
    }

    # Compute ranges for normalisation
    ranges = {}
    for key in ("total_load_mw", "binding_loading_pct", "hour_of_day", "month"):
        vals = [s[key] for s in samples]
        ranges[key] = max(vals) - min(vals) if vals else 1.0

    # Score all samples (exclude the query itself)
    scored = []
    for s in samples:
        if s["stem"] == stem:
            continue
        dist = _normalise_and_distance(query, s, ranges)
        scored.append((dist, s))

    scored.sort(key=lambda x: x[0])
    top = scored[:top_k]

    # For each analogue, check what happened 2-6 hours later
    analogues = []
    for dist, s in top:
        follow_up = []
        for delta_h in (2, 4, 6):
            future_stem = shift_stem(s["stem"], delta_h)
            try:
                future_gs = state.compute_state(future_stem)
                future_binding = (
                    future_gs.binding_constraint.loading_percent
                    if future_gs.binding_constraint
                    else 0.0
                )
                follow_up.append({
                    "hours_ahead": delta_h,
                    "total_load_mw": future_gs.total_load_mw,
                    "binding_loading_pct": round(future_binding, 2),
                })
            except FileNotFoundError:
                continue

        analogues.append({
            "datetime": s["stem"],
            "similarity_distance": round(dist, 4),
            "total_load_mw": s["total_load_mw"],
            "binding_loading_pct": s["binding_loading_pct"],
            "follow_up": follow_up,
        })

    return {
        "available": True,
        "query_datetime": stem,
        "analogues": analogues,
    }
