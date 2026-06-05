"""Shared test fixtures and path setup."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app import config  # noqa: E402

# A snapshot that exists in the dataset (used by tests that need real data).
SAMPLE_DATETIME = "2024_01_01_00_00_00"


def dataset_available() -> bool:
    return (config.SNAPSHOTS_DIR / f"{SAMPLE_DATETIME}.json").exists()


needs_dataset = pytest.mark.skipif(
    not dataset_available(),
    reason="ČEPS dataset not present (gitignored); skipping data-backed test",
)


@pytest.fixture
def sample_datetime() -> str:
    return SAMPLE_DATETIME
