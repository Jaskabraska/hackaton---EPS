"""Tests for grid.topology map building."""
from __future__ import annotations

from tests.helpers import needs_dataset

from app.grid import topology


@needs_dataset
def test_build_map_shape(sample_datetime):
    payload = topology.build_map(sample_datetime)
    assert len(payload["nodes"]) == 118
    assert len(payload["edges"]) == 186
    node = payload["nodes"][0]
    assert {"bus_name", "region", "x", "y", "vm_pu"}.issubset(node)
    edge = payload["edges"][0]
    assert {"branch_name", "x1", "y1", "x2", "y2", "loading_percent"}.issubset(edge)
