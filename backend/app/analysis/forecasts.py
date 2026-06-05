"""Read the dataset's day-ahead MW forecasts on demand.

The DA forecasts ARE the forward-looking signal (weather effects are already
baked into the MW values). No external weather/satellite APIs.
"""
from __future__ import annotations

from functools import lru_cache

import pandas as pd

from .. import config
from ..grid import loader


def _key(stem: str) -> str:
    """Map a snapshot stem 'YYYY_MM_DD_HH_MM_SS' to forecast key 'M/D/YY H:00'."""
    y, m, d, h, _, _ = stem.split("_")
    return f"{int(m)}/{int(d)}/{int(y) % 100} {int(h)}:00"


@lru_cache(maxsize=8)
def _load_region_series(region_file: str) -> dict[str, float]:
    path = config.FORECASTS_DIR / "Load" / region_file
    df = pd.read_csv(path)
    return dict(zip(df["DATETIME"].astype(str), df["value"].astype(float)))


def total_load_forecast(value: str) -> float | None:
    """Total day-ahead load forecast (MW) across all regions at the given time."""
    key = _key(loader.normalise_datetime(value))
    total = 0.0
    found = False
    for region_file in ("LoadR1DA.csv", "LoadR2DA.csv", "LoadR3DA.csv"):
        series = _load_region_series(region_file)
        if key in series:
            total += series[key]
            found = True
    return round(total, 2) if found else None


def shift_stem(stem: str, hours: int) -> str:
    """Shift a snapshot stem by whole hours using pandas timestamps."""
    y, m, d, h, mi, s = (int(p) for p in stem.split("_"))
    ts = pd.Timestamp(year=y, month=m, day=d, hour=h, minute=mi, second=s) + pd.Timedelta(hours=hours)
    return f"{ts.year}_{ts.month:02d}_{ts.day:02d}_{ts.hour:02d}_{ts.minute:02d}_{ts.second:02d}"


def load_growth(value: str, horizon_h: int) -> dict | None:
    """Compare forecast load now vs in `horizon_h` hours. Returns MW + ratio."""
    stem = loader.normalise_datetime(value)
    now = total_load_forecast(stem)
    later_stem = shift_stem(stem, horizon_h)
    later = total_load_forecast(later_stem)
    if now is None or later is None or now <= 0:
        return None
    return {
        "load_now_mw": now,
        "load_horizon_mw": later,
        "horizon_h": horizon_h,
        "ratio": round(later / now, 4),
    }
