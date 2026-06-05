"""Load pandapower snapshots from disk on demand, cached.

Snapshot files are named like '2024_01_01_18_00_00.json'. We also accept ISO
'2024-01-01T18:00:00' and normalise it to the file stem.
"""
from __future__ import annotations

import re
from functools import lru_cache

import pandapower as pp

from .. import config


def normalise_datetime(value: str) -> str:
    """Return the snapshot file stem 'YYYY_MM_DD_HH_MM_SS' for a given input."""
    digits = re.findall(r"\d+", value)
    if len(digits) < 3:
        raise ValueError(f"Cannot parse datetime: {value!r}")
    year, month, day = digits[0], digits[1], digits[2]
    hour = digits[3] if len(digits) > 3 else "00"
    minute = digits[4] if len(digits) > 4 else "00"
    second = digits[5] if len(digits) > 5 else "00"
    parts = [year, month.zfill(2), day.zfill(2), hour.zfill(2), minute.zfill(2), second.zfill(2)]
    return "_".join(parts)


def snapshot_path(value: str):
    stem = normalise_datetime(value)
    return config.SNAPSHOTS_DIR / f"{stem}.json"


@lru_cache(maxsize=64)
def load_snapshot(value: str):
    """Load a snapshot pandapower net. Cached so pandapower is not re-run repeatedly."""
    path = snapshot_path(value)
    if not path.exists():
        raise FileNotFoundError(f"Snapshot not found: {path}")
    return pp.from_json(str(path))
