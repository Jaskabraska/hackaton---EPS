"""Shared test fixtures and path setup."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from tests.helpers import SAMPLE_DATETIME  # noqa: E402


@pytest.fixture
def sample_datetime() -> str:
    return SAMPLE_DATETIME
