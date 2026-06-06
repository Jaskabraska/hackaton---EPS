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
_summary_text_cache: dict[tuple, str] = {}

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


def _decision_for(stem: str, *elements: str | None) -> dict | None:
    """Return the latest logged dispatcher decision for this hour/element."""
    wanted = {e for e in elements if e}
    if not wanted:
        return None

    path = config.OUTPUT_DIR / "decisions.jsonl"
    if not path.exists():
        return None

    latest: dict | None = None
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        if record.get("datetime") == stem and record.get("element") in wanted:
            latest = record
    return latest


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


_SEVERITY_RANK = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}

_SHIFT_SYSTEM = (
    "You write a 12-hour shift handover for a grid dispatcher (TSO ČEPS). British spelling, concise. "
    "Report each incident with its time, element and severity, plus the dispatcher's decision and the "
    "recommended/taken action; then the top constraints and the forward risk for the next shift. "
    "If the data lists incidents you MUST report them — never say 'no incidents' when incidents exist. "
    "Use the exact window_start/window_end values from the JSON; do not correct, extend or infer a "
    "different shift. If a decision is null, say it is not recorded. Describe loadings below 80% as "
    "within limits, not as a risk. Only state figures present in the data; do not invent numbers."
)


def _fmt_dt(stem: str) -> str:
    """Snapshot stem -> 'HH:00 DD/MM/YYYY' for human-readable handover windows."""
    y, m, d, h, _, _ = stem.split("_")
    return f"{h}:00 {d}/{m}/{y}"


def _incident(stem: str, alert: dict) -> dict:
    h = stem.split("_")[3]
    decision = _decision_for(stem, alert.get("element"), alert.get("tripped_element"))
    return {
        "time": f"{h}:00",
        "datetime": stem,
        "severity": alert["severity"],
        "element": alert["element"],
        "title": alert["title"],
        "action": alert.get("action"),
        "category": alert.get("category"),
        "tripped_element": alert.get("tripped_element"),
        "affected_loading_percent": alert.get("affected_loading_percent"),
        "decision": decision.get("decision") if decision else "not recorded",
        "recommended_action": (
            decision.get("recommended_action") if decision and decision.get("recommended_action") else alert.get("action")
        ),
    }


def _shift_label(stem: str) -> str:
    h = int(stem.split("_")[3])
    return "night" if (h >= config.NIGHT_SHIFT_START_H or h < config.DAY_SHIFT_START_H) else "day"


def _shift_window_start(end_stem: str) -> str:
    """Start of the fixed 12-hour shift that ends at / contains ``end_stem``."""
    h = int(end_stem.split("_")[3])
    day_len = config.NIGHT_SHIFT_START_H - config.DAY_SHIFT_START_H  # 12
    if h == config.NIGHT_SHIFT_START_H or h == config.DAY_SHIFT_START_H:
        back = day_len  # exactly on a boundary -> the shift that just ended
    elif config.DAY_SHIFT_START_H < h < config.NIGHT_SHIFT_START_H:
        back = h - config.DAY_SHIFT_START_H  # in the day shift
    else:  # in the night shift (crosses midnight)
        ref = config.NIGHT_SHIFT_START_H if h > config.NIGHT_SHIFT_START_H else config.NIGHT_SHIFT_START_H - 24
        back = h - ref
    return shift_stem(end_stem, -back)


def _constraints_from_hours(hours: list[dict]) -> list[dict]:
    constraints: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for hr in hours:
        state = hr.get("state") or {}
        binding = state.get("binding_constraint") or {}
        element = binding.get("element")
        if not element:
            continue
        key = (hr["datetime"], element)
        if key in seen:
            continue
        seen.add(key)
        constraints.append({
            "time": f"{hr['datetime'].split('_')[3]}:00",
            "datetime": hr["datetime"],
            "element": element,
            "kind": binding.get("kind"),
            "loading_percent": binding.get("loading_percent"),
            "within_limits": binding.get("within_limits"),
        })
    return sorted(
        constraints,
        key=lambda c: float(c.get("loading_percent") or 0.0),
        reverse=True,
    )[:3]


def _grounded_summary(payload: dict) -> str:
    """Deterministic fallback if the LLM output omits required bundle facts."""
    lines = [
        f"Shift handover ({payload['shift']}): {payload['window_start']} to {payload['window_end']}.",
    ]
    incidents = payload["incidents"]
    if incidents:
        lines.append(f"Incidents: {len(incidents)}.")
        for incident in incidents:
            loading = incident.get("affected_loading_percent")
            loading_text = f" to {float(loading):.1f}%" if loading is not None else ""
            tripped = incident.get("tripped_element")
            if tripped:
                description = (
                    f"tripping {tripped} would drive {incident['element']}{loading_text}"
                )
            else:
                description = incident["title"]
            lines.append(
                f"- {incident['time']} {incident['severity']}: {description}. "
                f"Decision: {incident.get('decision') or 'not recorded'}. "
                f"Recommended action: {incident.get('recommended_action') or incident.get('action') or 'not recorded'}"
            )
    else:
        lines.append("Incidents: none recorded in the selected window.")

    constraints = payload.get("top_constraints") or []
    if constraints:
        parts = [
            f"{c['element']} at {float(c['loading_percent']):.1f}% ({'within limits' if c.get('within_limits') else 'above threshold'})"
            for c in constraints
            if c.get("loading_percent") is not None
        ]
        if parts:
            lines.append(f"Top constraints: {'; '.join(parts)}.")

    if incidents:
        lines.append("Forward risk: keep redispatch ready for the N-1 contingency corridor and monitor the next shift.")
    else:
        lines.append("Forward risk: continue routine monitoring; no incident-driven action is recorded.")
    return "\n".join(lines)


def _summary_needs_fallback(text: str, payload: dict) -> bool:
    incidents = payload["incidents"]
    if not text.strip():
        return True
    if incidents and "no incident" in text.lower():
        return True
    for incident in incidents:
        required = [incident.get("element"), incident.get("tripped_element")]
        for value in required:
            if value and value not in text:
                return True
        loading = incident.get("affected_loading_percent")
        if loading is not None and f"{float(loading):.1f}" not in text:
            return True
    return False


def _render_shift_summary(
    incidents: list[dict],
    window_start: str,
    window_end: str,
    label: str,
    constraints: list[dict] | None = None,
) -> str:
    """Deterministic, grounded LLM phrasing of a shift handover (temperature 0 + cache)."""
    ordered = sorted(incidents, key=lambda i: (-_SEVERITY_RANK.get(i["severity"], 0), i["datetime"]))
    top_constraints = constraints or []
    incident_signature = tuple(
        (
            i["time"],
            i["severity"],
            i["element"],
            i.get("tripped_element"),
            i.get("affected_loading_percent"),
            i.get("decision"),
        )
        for i in ordered
    )
    constraint_signature = tuple((c.get("element"), c.get("loading_percent")) for c in top_constraints)
    cache_key = (label, window_start, window_end, incident_signature, constraint_signature)
    if cache_key in _summary_text_cache:
        return _summary_text_cache[cache_key]

    payload = {
        "shift": label,
        "window_start": _fmt_dt(window_start),
        "window_end": _fmt_dt(window_end),
        "incident_count": len(ordered),
        "incidents": ordered,
        "top_constraints": top_constraints,
    }
    provider = get_provider()
    text = _summarise(provider, _SHIFT_SYSTEM, json.dumps(payload, default=str))
    if _summary_needs_fallback(text, payload):
        text = _grounded_summary(payload)
    _summary_text_cache[cache_key] = text
    return text


def summarise_shift(hours: list[dict], shift_label: str = "night", write: bool = True) -> ShiftSummary:
    """Build a handover from already-computed per-hour bundle records (alerts incl. N-1)."""
    incidents: list[dict] = []
    for hr in hours:
        for alert in hr.get("alerts", {}).get("alerts", []):
            incidents.append(_incident(hr["datetime"], alert))

    window_start = hours[0]["datetime"] if hours else DEFAULT_DATETIME
    window_end = hours[-1]["datetime"] if hours else DEFAULT_DATETIME
    summary = _render_shift_summary(
        incidents,
        window_start,
        window_end,
        shift_label,
        constraints=_constraints_from_hours(hours),
    )

    result = ShiftSummary(
        window_start=window_start,
        window_end=window_end,
        alert_count=len(incidents),
        summary=summary,
        events=incidents,
    )
    if write:
        config.ensure_output_dir().joinpath("shift_summary.json").write_text(
            json.dumps(result.model_dump(), indent=2, default=str), encoding="utf-8"
        )
    return result


def _summary_from_bundle(datetime: str, window_h: int, write: bool) -> ShiftSummary | None:
    """Use the precomputed demo bundle when it contains the requested handover."""
    from ..grid.loader import normalise_datetime

    end = normalise_datetime(datetime)
    date = "_".join(end.split("_")[:3])
    path = config.OUTPUT_DIR / f"day_bundle_{date}.json"
    if not path.exists():
        return None

    try:
        bundle = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None

    hours = bundle.get("hours") or []
    known = {hr.get("datetime") for hr in hours}
    if end not in known:
        return None

    window_start = shift_stem(end, -window_h)
    selected = [
        hr for hr in hours
        if window_start <= hr.get("datetime", "") <= end
    ]
    if not selected:
        return None
    return summarise_shift(selected, shift_label="demo", write=write)


def shift_summary(datetime: str | None = None, window_h: int = 12, write: bool = True) -> ShiftSummary:
    """Ad-hoc handover for the /summary endpoint: align to the fixed shift window ending
    at ``datetime`` and summarise the alerts within it. (The demo bundle uses
    ``summarise_shift`` directly so the N-1 incident is included.)
    """
    from ..analysis import alerts as alerts_mod

    end = datetime or DEFAULT_DATETIME
    bundle_summary = _summary_from_bundle(end, window_h, write)
    if bundle_summary is not None:
        return bundle_summary

    window_start = _shift_window_start(end)

    events: list[dict] = []
    incidents: list[dict] = []
    stem = window_start
    for _ in range(window_h + 1):
        try:
            payload = alerts_mod.generate_alerts(stem)
        except FileNotFoundError:
            payload = None
        if payload is not None:
            alist = payload["alerts"]
            events.append(
                {
                    "datetime": stem,
                    "alert_count": len(alist),
                    "top": [a["title"] for a in alist[:3]],
                }
            )
            incidents.extend(_incident(stem, a) for a in alist)
        if stem == end:
            break
        stem = shift_stem(stem, 1)

    summary = _render_shift_summary(incidents, window_start, end, _shift_label(end))

    result = ShiftSummary(
        window_start=window_start,
        window_end=end,
        alert_count=len(incidents),
        summary=summary,
        events=events,
    )
    if write:
        config.ensure_output_dir().joinpath("shift_summary.json").write_text(
            json.dumps(result.model_dump(), indent=2, default=str), encoding="utf-8"
        )
    return result
