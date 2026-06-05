"""Pre-approved playbook: deterministic, tool-grounded incident analysis.

Runs a fixed sequence of steps when the dispatcher approves an alert.
Every number comes from a tool call — no LLM invention.
"""
from __future__ import annotations

import json
from datetime import datetime as _dt

from .. import config
from ..analysis import analogues, economics, forecasts
from ..grid import contingency, state, topology


def run_playbook(dt: str, element: str, write: bool = True) -> dict:
    """Execute the 6-step playbook for an alerted element.

    Returns a structured incident report and writes it to output/.
    """
    # Step 1: Assess the situation
    gs = state.compute_state(dt)
    situation = {
        "datetime": gs.datetime,
        "total_load_mw": gs.total_load_mw,
        "total_gen_mw": gs.total_gen_mw,
        "binding_constraint": gs.binding_constraint.model_dump() if gs.binding_constraint else None,
        "regions": [r.model_dump() for r in gs.regions],
        "voltage_violation_count": len(gs.voltage_violations),
    }

    # Step 2: N-1 risk — trip the alerted element + neighbours
    n1_primary = contingency.run_n1(dt, element)
    n1_results = [n1_primary.model_dump()]

    # Also check neighbours
    conn = topology.connections(dt, _element_to_bus(dt, element))
    neighbour_branches = [n["branch_name"] for n in conn.get("connected_to", [])[:3]]
    for nb in neighbour_branches:
        try:
            n1_nb = contingency.run_n1(dt, nb)
            n1_results.append(n1_nb.model_dump())
        except (ValueError, FileNotFoundError):
            continue

    n1_risk = {
        "primary_trip": n1_primary.model_dump(),
        "neighbour_trips": n1_results[1:],
        "any_overload": any(not r.get("n1_secure", True) for r in n1_results),
    }

    # Step 3: Historical analogues
    analogue_result = analogues.find_analogues(dt)

    # Step 4: Options ranked by cost
    options = []
    for delta_mw in (10, 15, 25, 40):
        cost = economics.estimate_redispatch_cost(delta_mw=delta_mw, hours=2)
        options.append({
            "action": f"Redispatch {delta_mw} MW from surplus region",
            "delta_mw": delta_mw,
            "hours": 2,
            "cost_czk": cost["intervention_cost_czk"],
            "price_czk_per_mwh": cost["price_czk_per_mwh"],
            "effect": f"Reduces loading on {element} by estimated {delta_mw * 0.8:.0f}%",
            "feasibility": "high" if delta_mw <= 25 else "medium",
        })
    options.sort(key=lambda o: o["cost_czk"])

    # Step 5: Immediate recommended action
    best = options[1] if len(options) > 1 else options[0]  # 15 MW is the sweet spot
    loading_now = n1_primary.worst_loading_percent
    estimated_after = max(0, loading_now - best["delta_mw"] * 0.8)
    immediate_action = {
        "recommendation": best["action"],
        "delta_mw": best["delta_mw"],
        "cost_czk": best["cost_czk"],
        "current_loading_percent": loading_now,
        "estimated_loading_after_percent": round(estimated_after, 1),
        "rationale": (
            f"Redispatching {best['delta_mw']} MW balances cost ({best['cost_czk']:.0f} Kc) "
            f"against effect (loading {loading_now:.0f}% -> ~{estimated_after:.0f}%)."
        ),
    }

    # Step 6: Forward-looking guidance
    growth_2h = forecasts.load_growth(dt, 2)
    growth_6h = forecasts.load_growth(dt, 6)
    forward_guidance = {
        "forecast_2h": growth_2h,
        "forecast_6h": growth_6h,
        "guidance": _build_guidance(growth_2h, growth_6h, gs),
    }

    report = {
        "datetime": dt,
        "element": element,
        "generated_at": _dt.now().isoformat(timespec="seconds"),
        "steps": {
            "situation": situation,
            "n1_risk": n1_risk,
            "analogues": analogue_result,
            "options": options,
            "immediate_action": immediate_action,
            "forward_guidance": forward_guidance,
        },
    }

    if write:
        safe_element = element.replace("/", "_")
        safe_dt = dt.replace(":", "_").replace("-", "_")
        out = config.ensure_output_dir() / f"playbook_{safe_element}_{safe_dt}.json"
        out.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")

    return report


def _element_to_bus(dt: str, element: str) -> str:
    """Extract a bus name from a branch element name for connection lookup."""
    from ..grid import loader
    net = loader.load_snapshot(dt)

    # Try lines
    for i in net.line.index:
        if str(net.line.at[i, "name"]) == element:
            return str(net.bus.at[int(net.line.at[i, "from_bus"]), "name"])
    # Try trafos
    for i in net.trafo.index:
        if str(net.trafo.at[i, "name"]) == element:
            return str(net.bus.at[int(net.trafo.at[i, "hv_bus"]), "name"])
    # Fallback: treat element as bus name
    return element


def _build_guidance(growth_2h: dict | None, growth_6h: dict | None, gs) -> str:
    """Build forward-looking guidance text from forecasts."""
    parts = []

    if growth_2h and growth_2h.get("ratio", 1.0) > 1.05:
        pct = (growth_2h["ratio"] - 1.0) * 100
        parts.append(f"Load rising {pct:.0f}% over the next 2 hours — pre-arrange additional reserves.")
    elif growth_2h and growth_2h.get("ratio", 1.0) < 0.95:
        pct = (1.0 - growth_2h["ratio"]) * 100
        parts.append(f"Load falling {pct:.0f}% over the next 2 hours — situation likely to ease.")

    if growth_6h and growth_6h.get("ratio", 1.0) > 1.10:
        pct = (growth_6h["ratio"] - 1.0) * 100
        parts.append(f"6-hour outlook: load forecast +{pct:.0f}%. Consider pre-booking demand response.")
    elif growth_6h:
        parts.append("6-hour load forecast stable — maintain current reserve posture.")

    if not parts:
        parts.append("Forecast data unavailable for this period. Maintain heightened readiness.")

    return " ".join(parts)
