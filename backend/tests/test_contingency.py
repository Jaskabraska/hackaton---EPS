"""Tests for grid.contingency (N-1). Tests-first."""
from __future__ import annotations

import json

from tests.helpers import needs_dataset

from app import config
from app.grid import contingency, loader


@needs_dataset
def test_n1_runs_and_reports(sample_datetime):
    res = contingency.run_n1(sample_datetime, "branch_001_002_1")
    assert res.tripped_element == "branch_001_002_1"
    assert isinstance(res.n1_secure, bool)
    assert res.worst_loading_percent >= 0


@needs_dataset
def test_n1_does_not_mutate_cached_net(sample_datetime):
    net_before = loader.load_snapshot(sample_datetime)
    in_service_before = bool(net_before.line["in_service"].all())
    contingency.run_n1(sample_datetime, "branch_001_002_1")
    net_after = loader.load_snapshot(sample_datetime)
    # the cached net must be untouched
    assert bool(net_after.line["in_service"].all()) == in_service_before


@needs_dataset
def test_n1_unknown_element_raises(sample_datetime):
    import pytest

    with pytest.raises(ValueError):
        contingency.run_n1(sample_datetime, "branch_does_not_exist")


@needs_dataset
def test_n1_written_to_output(sample_datetime):
    contingency.run_n1(sample_datetime, "branch_001_002_1", write=True)
    out = config.OUTPUT_DIR / "n1.json"
    assert out.exists()
    data = json.loads(out.read_text(encoding="utf-8"))
    assert data["tripped_element"] == "branch_001_002_1"
