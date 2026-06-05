"""Curated playback windows for the live demo.

Returns an ordered list of consecutive snapshot datetimes for a 24h or 48h window.
Windows are ranked programmatically by activity (max binding loading sampled across the
window) so the most visually interesting periods surface as presets.
"""
from __future__ import annotations

from functools import lru_cache

from .. import config
from ..grid import loader, state
from . import forecasts


@lru_cache(maxsize=1)
def _available_stems() -> tuple[str, ...]:
    files = sorted(p.stem for p in config.SNAPSHOTS_DIR.glob("*.json"))
    return tuple(files)


def enumerate_window(start: str, hours: int) -> list[str]:
    """Consecutive snapshot stems from `start` for `hours` steps (skips any missing)."""
    available = set(_available_stems())
    stem = loader.normalise_datetime(start)
    stems: list[str] = []
    for h in range(hours):
        candidate = forecasts.shift_stem(stem, h)
        if candidate in available:
            stems.append(candidate)
    return stems


def _window_score(start: str, hours: int) -> float:
    """Cheap activity score: max binding loading sampled every 6h across the window."""
    stem = loader.normalise_datetime(start)
    available = set(_available_stems())
    score = 0.0
    for h in range(0, hours, 6):
        candidate = forecasts.shift_stem(stem, h)
        if candidate not in available:
            continue
        gs = state.compute_state(candidate)
        if gs.binding_constraint is not None:
            score = max(score, gs.binding_constraint.loading_percent)
    return score


@lru_cache(maxsize=4)
def rank_windows(hours: int, stride_days: int = 15) -> tuple[dict, ...]:
    """Rank candidate windows (one per `stride_days`, anchored at 00:00) by activity."""
    stems = _available_stems()
    if not stems:
        return ()
    midnights = [s for s in stems if s.endswith("_00_00_00")]
    candidates = midnights[:: stride_days] or [stems[0]]
    scored = [
        {"start": start, "hours": hours, "score": round(_window_score(start, hours), 2)}
        for start in candidates
    ]
    scored.sort(key=lambda w: w["score"], reverse=True)
    return tuple(scored)


def best_window(hours: int) -> dict:
    """The most active window of the requested length, as an ordered datetime list."""
    ranked = rank_windows(hours)
    start = ranked[0]["start"] if ranked else loader.normalise_datetime("2024_01_01_00_00_00")
    datetimes = enumerate_window(start, hours)
    return {
        "window_start": datetimes[0] if datetimes else start,
        "window_end": datetimes[-1] if datetimes else start,
        "hours": hours,
        "datetimes": datetimes,
        "score": ranked[0]["score"] if ranked else 0.0,
    }
