"""LLM orchestration: tool-calling chat, human-in-the-loop approval, a focused
risk sub-agent, and a deterministic shift summary.
"""
from __future__ import annotations

import json
from datetime import datetime as _dt
from functools import lru_cache

from .. import config
from ..analysis import economics
from ..analysis.forecasts import shift_stem
from ..grid import contingency
from ..schemas import ChatResponse, ProposedAction, RiskVerdict, ShiftSummary
from . import tools
from .provider import Provider, get_provider

DEFAULT_DATETIME = "2024_01_01_18_00_00"
SUMMARY_SEED = 7

# Cache the LLM-phrased summary text per (window_end, window_h) so repeated identical
# requests are byte-identical even if the provider drifts. Keyed by the deterministic
# inputs; the gathered events/counts are already deterministic.
_summary_text_cache: dict[tuple[str, int], str] = {}

HARD_RULES = (
    "You are Grid Pulse, an assistant for a transmission grid dispatcher (TSO ČEPS).\n"
    "ABSOLUTE RULE: every number you state MUST come from a tool call. Never invent or "
    "estimate numbers yourself. If you lack a number, call a tool. Use the glossary only to "
    "interpret terminology, never as a source of figures.\n"
    "Prefer British spelling. Be concise and concrete. When you recommend an operational "
    "action that should be executed, call propose_action so the dispatcher can approve it."
)


@lru_cache(maxsize=1)
def _glossary_text() -> str:
    return config.GLOSSARY_PATH.read_text(encoding="utf-8")


def build_system_prompt() -> str:
    return f"{HARD_RULES}\n\nGLOSSARY (terminology only):\n{_glossary_text()}"


def _tool_message(call_id: str, result: dict) -> dict:
    return {"role": "tool", "tool_call_id": call_id, "content": json.dumps(result, default=str)}


def _context_block(dt: str) -> str | None:
    """Compact, tool-derived snapshot of the current grid + active alerts for grounding.

    Returns None if the dataset for this datetime is unavailable (keeps chat working
    in mock/key-less runs without the dataset).
    """
    from ..analysis import alerts as alerts_mod
    from ..grid import state as state_mod

    try:
        gs = state_mod.compute_state(dt)
        payload = alerts_mod.generate_alerts(dt)
    except FileNotFoundError:
        return None

    context = {
        "datetime": gs.datetime,
        "total_load_mw": gs.total_load_mw,
        "total_gen_mw": gs.total_gen_mw,
        "binding_constraint": gs.binding_constraint.model_dump() if gs.binding_constraint else None,
        "voltage_violation_count": len(gs.voltage_violations),
        "regions": [r.model_dump() for r in gs.regions],
        "active_alerts": [
            {"id": a["id"], "severity": a["severity"], "element": a["element"], "title": a["title"]}
            for a in payload["alerts"]
        ],
    }
    return json.dumps(context, default=str)


def run_chat(message: str, datetime: str | None = None, history: list[dict] | None = None) -> ChatResponse:
    dt = datetime or DEFAULT_DATETIME
    provider = get_provider()
    messages: list[dict] = [{"role": "system", "content": build_system_prompt()}]

    context = _context_block(dt)
    if context is not None:
        messages.append(
            {
                "role": "system",
                "content": (
                    f"CURRENT GRID CONTEXT (tool-derived, datetime={dt}). These figures come "
                    "from our solved snapshot and alert engine; use them to ground your answer, "
                    f"and call a tool for anything not present here:\n{context}"
                ),
            }
        )

    messages += history or []
    messages.append({"role": "user", "content": message})

    trace: list[dict] = []

    for _ in range(config.LLM_MAX_TOOL_ITERATIONS):
        resp = provider.chat(messages, tools.TOOL_SCHEMAS)

        if not resp.tool_calls:
            return ChatResponse(status="answered", reply=resp.content or "", tool_trace=trace)

        messages.append(resp.raw_assistant_message or {"role": "assistant", "content": resp.content})

        for call in resp.tool_calls:
            if call.name == tools.PROPOSE_ACTION:
                action = tools.dispatch(call.name, call.arguments, dt)
                return ChatResponse(
                    status="awaiting_approval",
                    reply=action.get("description", "Action proposed for approval."),
                    proposed_action=ProposedAction(**action),
                    tool_trace=trace,
                )
            result = tools.dispatch(call.name, call.arguments, dt)
            trace.append({"tool": call.name, "arguments": call.arguments})
            messages.append(_tool_message(call.id, result))

    return ChatResponse(status="answered", reply="Reached tool iteration cap.", tool_trace=trace)


def apply_action(action: ProposedAction) -> dict:
    """Run the deeper what-if once the dispatcher approves."""
    dt = action.datetime or DEFAULT_DATETIME
    result: dict = {"applied": action.model_dump(), "ran_at": _dt.now().isoformat(timespec="seconds")}
    if action.element:
        result["n1"] = contingency.run_n1(dt, action.element).model_dump()
        result["risk"] = assess_risk(dt, action.element).model_dump()
    result["cost"] = economics.estimate_redispatch_cost(delta_mw=15, hours=2)
    config.ensure_output_dir().joinpath("apply.json").write_text(
        json.dumps(result, indent=2, default=str), encoding="utf-8"
    )
    return result


def _summarise(provider: Provider, system: str, user: str) -> str:
    """Deterministic LLM phrasing: temperature 0 + fixed seed."""
    resp = provider.chat(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        tools=None,
        temperature=0,
        seed=SUMMARY_SEED,
    )
    return resp.content or ""


def _verdict_from(n1) -> str:
    if not n1.converged:
        return "CRITICAL"
    if not n1.n1_secure:
        return "CRITICAL" if n1.worst_loading_percent > 120 else "HIGH"
    if n1.worst_loading_percent > 90:
        return "MEDIUM"
    return "LOW"


def assess_risk(datetime: str, element: str, write: bool = True) -> RiskVerdict:
    """Focused risk sub-agent: deterministic verdict from run_n1 + cost, LLM phrasing only."""
    dt = datetime or DEFAULT_DATETIME
    n1 = contingency.run_n1(dt, element)
    cost = economics.estimate_redispatch_cost(delta_mw=15, hours=2)
    verdict = _verdict_from(n1)

    provider = get_provider()
    rationale = _summarise(
        provider,
        "You assess single-element risk for a grid dispatcher. One short paragraph, British spelling. "
        "Use only the figures provided; do not invent numbers.",
        json.dumps({"element": element, "n1": n1.model_dump(), "cost": cost}, default=str),
    )

    rv = RiskVerdict(
        datetime=n1.datetime,
        element=element,
        verdict=verdict,
        n1_secure=n1.n1_secure,
        rationale=rationale,
        estimated_cost_czk=cost["intervention_cost_czk"],
        evidence={"n1": n1.model_dump(), "cost": cost},
    )
    if write:
        config.ensure_output_dir().joinpath("risk.json").write_text(
            json.dumps(rv.model_dump(), indent=2, default=str), encoding="utf-8"
        )
    return rv


def shift_summary(datetime: str | None = None, window_h: int = 12, write: bool = True) -> ShiftSummary:
    """Deterministic: gather alerts across the window, then a single LLM summarise call."""
    from ..analysis import alerts as alerts_mod

    end = datetime or DEFAULT_DATETIME
    sample_offsets = sorted({window_h, window_h * 3 // 4, window_h // 2, window_h // 4, 0}, reverse=True)
    events: list[dict] = []
    for offset in sample_offsets:
        stem = shift_stem(end, -offset)
        try:
            payload = alerts_mod.generate_alerts(stem)
        except FileNotFoundError:
            continue
        events.append(
            {
                "datetime": stem,
                "alert_count": len(payload["alerts"]),
                "top": [a["title"] for a in payload["alerts"][:3]],
            }
        )

    total_alerts = sum(e["alert_count"] for e in events)
    cache_key = (end, window_h)
    if cache_key in _summary_text_cache:
        summary = _summary_text_cache[cache_key]
    else:
        provider = get_provider()
        summary = _summarise(
            provider,
            "You write a 12-hour shift handover for a grid dispatcher. British spelling, concise, "
            "highlight the binding constraints and any forecast risk. Use only the figures provided.",
            json.dumps({"window_h": window_h, "events": events}, default=str),
        )
        _summary_text_cache[cache_key] = summary

    result = ShiftSummary(
        window_start=events[-1]["datetime"] if events else end,
        window_end=end,
        alert_count=total_alerts,
        summary=summary,
        events=events,
    )
    if write:
        config.ensure_output_dir().joinpath("shift_summary.json").write_text(
            json.dumps(result.model_dump(), indent=2, default=str), encoding="utf-8"
        )
    return result
