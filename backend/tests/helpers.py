"""Importable test helpers (markers, sample data)."""
from __future__ import annotations

import pytest

from app import config

SAMPLE_DATETIME = "2024_01_01_00_00_00"


def dataset_available() -> bool:
    return (config.SNAPSHOTS_DIR / f"{SAMPLE_DATETIME}.json").exists()


needs_dataset = pytest.mark.skipif(
    not dataset_available(),
    reason="ČEPS dataset not present (gitignored); skipping data-backed test",
)
