"""Tests for cross-hour alert dedup and the shift-handover summary (no dataset/LLM needed)."""
from __future__ import annotations

from app import config
from app.analysis.day_bundle import _dedupe_across_hours
from app.llm import orchestrator


def _hour(stem: str, alerts: list[dict]) -> dict:
    return {"datetime": stem, "alerts": {"alerts": alerts}}


def _n1_ol(element: str = "branch_023_032_1") -> dict:
    return {
        "id": "ALR-N1-OL",
        "severity": "HIGH",
        "element": element,
        "category": "n1_contingency",
        "title": f"N-1 risk: {element}",
        "action": "Pre-arrange redispatch.",
    }


def test_dedupe_keeps_only_first_hour_of_episode():
    hours = [
        _hour("2024_02_17_19_00_00", [_n1_ol()]),
        _hour("2024_02_17_20_00_00", [_n1_ol()]),
        _hour("2024_02_17_21_00_00", [_n1_ol()]),
    ]
    _dedupe_across_hours(hours)
    assert len(hours[0]["alerts"]["alerts"]) == 1  # raised once
    assert hours[1]["alerts"]["alerts"] == []  # continuation suppressed
    assert hours[2]["alerts"]["alerts"] == []


def test_dedupe_reraises_after_a_gap():
    hours = [
        _hour("2024_02_17_19_00_00", [_n1_ol()]),
        _hour("2024_02_17_20_00_00", []),  # episode clears
        _hour("2024_02_17_21_00_00", [_n1_ol()]),  # a new episode
    ]
    _dedupe_across_hours(hours)
    assert len(hours[0]["alerts"]["alerts"]) == 1
    assert len(hours[2]["alerts"]["alerts"]) == 1


def test_summarise_shift_lists_incidents(monkeypatch):
    monkeypatch.setattr(config, "LLM_API_KEY", "")  # mock provider
    hours = [
        _hour("2024_02_17_18_00_00", []),
        _hour("2024_02_17_19_00_00", [_n1_ol()]),
        _hour("2024_02_17_20_00_00", []),
    ]
    summary = orchestrator.summarise_shift(hours, shift_label="night", write=False)
    assert summary.window_start == "2024_02_17_18_00_00"
    assert summary.window_end == "2024_02_17_20_00_00"
    assert summary.alert_count == 1
    assert any(
        e["element"] == "branch_023_032_1" and e["severity"] == "HIGH" for e in summary.events
    )
    assert summary.summary  # non-empty handover text


def test_shift_window_start_aligns_to_boundaries():
    # 18:00 handover -> day shift just ended (06:00 same day)
    assert orchestrator._shift_window_start("2024_02_17_18_00_00") == "2024_02_17_06_00_00"
    # 23:00 -> night shift in progress, started 18:00 same day
    assert orchestrator._shift_window_start("2024_02_17_23_00_00") == "2024_02_17_18_00_00"
    # 06:00 handover -> night shift just ended (18:00 previous day)
    assert orchestrator._shift_window_start("2024_02_17_06_00_00") == "2024_02_16_18_00_00"
