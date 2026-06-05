"""Tests for analysis.forecasts, economics and alerts. Tests-first."""
from __future__ import annotations

import json

from tests.helpers import needs_dataset

from app import config
from app.analysis import alerts, economics, forecasts

PEAK = "2024_01_01_18_00_00"


def test_economics_cost_scales_with_energy():
    a = economics.estimate_redispatch_cost(10, 2)
    b = economics.estimate_redispatch_cost(20, 2)
    assert a["intervention_cost_czk"] > 0
    assert b["intervention_cost_czk"] == a["intervention_cost_czk"] * 2


def test_shift_stem_crosses_day_boundary():
    assert forecasts.shift_stem("2024_01_01_23_00_00", 2) == "2024_01_02_01_00_00"


@needs_dataset
def test_total_load_forecast_positive():
    assert forecasts.total_load_forecast(PEAK) > 0


@needs_dataset
def test_generate_alerts_shape():
    payload = alerts.generate_alerts(PEAK)
    assert "alerts" in payload and isinstance(payload["alerts"], list)
    assert "recommendation_engine" in payload
    for alert in payload["alerts"]:
        for key in ("id", "severity", "element", "category", "title"):
            assert key in alert
        assert alert["severity"] in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}


@needs_dataset
def test_alerts_written_to_output():
    alerts.generate_alerts(PEAK, write=True)
    out = config.OUTPUT_DIR / "alerts.json"
    assert out.exists()
    data = json.loads(out.read_text(encoding="utf-8"))
    assert data["datetime"] == PEAK
