"""Tests for the LLM module. The mock provider runs the whole loop with no key."""
from __future__ import annotations

import json

from tests.helpers import needs_dataset

from app import config
from app.llm import orchestrator, provider, tools


def test_mock_provider_selected_without_key(monkeypatch):
    monkeypatch.setattr(config, "LLM_API_KEY", "")
    assert config.use_mock_llm() is True
    assert isinstance(provider.get_provider(), provider.MockProvider)


def test_system_prompt_contains_glossary_and_hard_rule():
    prompt = orchestrator.build_system_prompt()
    assert "every number" in prompt.lower()
    assert "TSO" in prompt  # glossary content injected


def test_mock_provider_loop_terminates():
    """Mock asks for one tool, then a final answer - no infinite loop."""
    p = provider.MockProvider()
    first = p.chat([{"role": "user", "content": "hi"}], tools.TOOL_SCHEMAS)
    assert first.tool_calls and first.tool_calls[0].name == "get_state"
    after = [{"role": "user", "content": "hi"}, {"role": "tool", "tool_call_id": "x", "content": "{}"}]
    second = p.chat(after, tools.TOOL_SCHEMAS)
    assert not second.tool_calls and second.content


def test_dispatch_unknown_tool():
    assert "error" in tools.dispatch("nope", {}, "2024_01_01_18_00_00")


def test_propose_action_dispatch_builds_action():
    action = tools.dispatch(
        tools.PROPOSE_ACTION,
        {"kind": "assess_risk", "element": "branch_001_002_1", "description": "check risk"},
        "2024_01_01_18_00_00",
    )
    assert action["element"] == "branch_001_002_1"
    assert action["datetime"] == "2024_01_01_18_00_00"


@needs_dataset
def test_run_chat_with_mock_returns_answer(monkeypatch):
    monkeypatch.setattr(config, "LLM_API_KEY", "")
    res = orchestrator.run_chat("What is the grid state?", datetime="2024_01_01_18_00_00")
    assert res.status == "answered"
    assert res.reply
    assert any(t["tool"] == "get_state" for t in res.tool_trace)


@needs_dataset
def test_assess_risk_structured_verdict(monkeypatch):
    monkeypatch.setattr(config, "LLM_API_KEY", "")
    rv = orchestrator.assess_risk("2024_01_01_18_00_00", "branch_001_002_1")
    assert rv.verdict in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
    assert rv.element == "branch_001_002_1"
    out = config.OUTPUT_DIR / "risk.json"
    assert out.exists()
    assert json.loads(out.read_text(encoding="utf-8"))["element"] == "branch_001_002_1"


@needs_dataset
def test_shift_summary_deterministic_gather(monkeypatch):
    monkeypatch.setattr(config, "LLM_API_KEY", "")
    summary = orchestrator.shift_summary("2024_01_01_18_00_00", window_h=12)
    assert summary.window_end == "2024_01_01_18_00_00"
    assert summary.events
    assert (config.OUTPUT_DIR / "shift_summary.json").exists()
