"""Tests for grid.topology map building."""
from __future__ import annotations

from tests.helpers import needs_dataset

from app.analysis import playback
from app.grid import topology

PEAK = "2024_01_01_18_00_00"


@needs_dataset
def test_build_map_shape(sample_datetime):
    payload = topology.build_map(sample_datetime)
    assert len(payload["nodes"]) == 118
    assert len(payload["edges"]) == 186
    node = payload["nodes"][0]
    assert {"bus_name", "region", "x", "y", "vm_pu"}.issubset(node)
    edge = payload["edges"][0]
    assert {"branch_name", "x1", "y1", "x2", "y2", "loading_percent"}.issubset(edge)


@needs_dataset
def test_connections_for_bus_003():
    result = topology.connections(PEAK, "bus_003")
    neighbours = {n["bus_name"] for n in result["connected_to"]}
    branches = {n["branch_name"] for n in result["connected_to"]}
    assert neighbours == {"bus_001", "bus_005", "bus_012"}
    assert branches == {"branch_001_003_1", "branch_003_005_1", "branch_003_012_1"}


@needs_dataset
def test_playback_window_is_ordered_and_consecutive():
    window = playback.best_window(24)
    dts = window["datetimes"]
    assert 0 < len(dts) <= 24
    assert dts == sorted(dts)
    assert window["window_start"] == dts[0]
    assert window["window_end"] == dts[-1]
