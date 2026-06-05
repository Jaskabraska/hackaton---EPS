"""Tests for grid.loader and grid.state. Tests-first."""
from __future__ import annotations

import json

from tests.helpers import needs_dataset

from app import config
from app.grid import loader, state


@needs_dataset
def test_loader_returns_net_and_is_cached(sample_datetime):
    net_a = loader.load_snapshot(sample_datetime)
    net_b = loader.load_snapshot(sample_datetime)
    assert net_a is net_b  # lru_cache hands back the same object
    assert len(net_a.bus) == 118


@needs_dataset
def test_loader_accepts_iso_datetime():
    net = loader.load_snapshot("2024-01-01T00:00:00")
    assert len(net.bus) == 118


@needs_dataset
def test_compute_state_shape(sample_datetime):
    gs = state.compute_state(sample_datetime)
    assert gs.n_buses == 118
    assert gs.n_branches == 186  # 177 lines + 9 trafos
    assert gs.total_load_mw > 0
    assert {r.region for r in gs.regions} == {"r1", "r2", "r3"}


@needs_dataset
def test_binding_constraint_is_global_max(sample_datetime):
    gs = state.compute_state(sample_datetime)
    if gs.binding_constraint is not None:
        # binding constraint loading must be >= every reported overloaded element
        for ov in gs.overloaded:
            assert gs.binding_constraint.loading_percent >= ov.loading_percent - 1e-6


@needs_dataset
def test_overloaded_respects_thresholds(sample_datetime):
    gs = state.compute_state(sample_datetime)
    for ov in gs.overloaded:
        threshold = config.LINE_ALERT_PCT if ov.kind == "line" else config.TRAFO_ALERT_PCT
        assert ov.loading_percent >= threshold


@needs_dataset
def test_state_written_to_output(sample_datetime):
    state.compute_state(sample_datetime, write=True)
    out = config.OUTPUT_DIR / "state.json"
    assert out.exists()
    data = json.loads(out.read_text(encoding="utf-8"))
    assert data["n_buses"] == 118
