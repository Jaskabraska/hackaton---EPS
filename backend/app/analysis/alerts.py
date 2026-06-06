"""Generate alerts from the real grid state plus the day-ahead forecast.

Output shape mirrors the existing demo alerts.json (alerts[] + recommendation_engine).
Every number comes from the solved snapshot, the DA forecast or the fuel-price table.
"""
from __future__ import annotations

import json
from datetime import datetime as _dt

from .. import config
from ..grid import loader, state
from . import economics, forecasts


def _branch_alert(branch, idx: int) -> dict:
    over_limit = branch.loading_percent > 100.0
    severity = "CRITICAL" if over_limit else "HIGH"
    cost = economics.estimate_redispatch_cost(delta_mw=15, hours=2)
    return {
        "id": f"ALR-{idx:03d}",
        "severity": severity,
        "element": branch.branch_name,
        "category": "transformer" if branch.kind == "trafo" else "line",
        "title": f"{branch.kind.title()} {branch.branch_name} at {branch.loading_percent:.0f}% loading",
        "what": f"{branch.branch_name} ({branch.from_bus}->{branch.to_bus}) is loaded to {branch.loading_percent:.1f}% of its limit.",
        "action": "Relieve via redispatch from a surplus region and reroute over a less-loaded corridor.",
        "impact_risk": "If a further element trips (N-1) this branch could exceed 100% and force load shedding."
        if not over_limit
        else "Element already over its thermal limit; act now to avoid damage and cascading trips.",
        "financial": cost,
        "predictive_basis": None,
    }


def _voltage_alert(violation, idx: int) -> dict:
    return {
        "id": f"ALR-{idx:03d}",
        "severity": "MEDIUM",
        "element": violation.bus_name,
        "category": "voltage",
        "title": f"Voltage out of band at {violation.bus_name} ({violation.vm_pu:.3f} p.u.)",
        "what": f"Bus {violation.bus_name} in {violation.region} sits at {violation.vm_pu:.3f} p.u., outside {violation.min_v_pu}-{violation.max_v_pu}.",
        "action": "Adjust reactive power / tap settings near the bus or switch a nearby source.",
        "impact_risk": "Sustained out-of-band voltage risks equipment and, if low, voltage collapse.",
        "financial": None,
        "predictive_basis": None,
    }


def _forecast_alert(gs, idx: int, horizon_h: int) -> dict | None:
    growth = forecasts.load_growth(gs.datetime, horizon_h)
    if growth is None or gs.binding_constraint is None:
        return None
    projected = gs.binding_constraint.loading_percent * growth["ratio"]

    # Escalation: the binding element is forecast to cross its loading-alert threshold.
    if projected > config.LINE_ALERT_PCT:
        severity = "CRITICAL" if projected > 100.0 else "HIGH"
    # Watch: loadings stay within limits, but day-ahead load is rising materially.
    elif growth["ratio"] >= config.FORECAST_WATCH_RATIO:
        severity = "MEDIUM"
    else:
        return None

    cost = economics.estimate_redispatch_cost(delta_mw=10, hours=horizon_h)
    growth_pct = (growth["ratio"] - 1.0) * 100.0

    if projected > config.LINE_ALERT_PCT:
        # Escalation: binding element forecast to exceed its alert threshold.
        title = f"Forecast: {gs.binding_constraint.element} projected to {projected:.0f}% within {horizon_h} h"
        what = (
            f"Day-ahead load rises {growth_pct:+.0f}% from {growth['load_now_mw']} to "
            f"{growth['load_horizon_mw']} MW over {horizon_h} h; "
            f"{gs.binding_constraint.element} would reach ~{projected:.0f}%, exceeding the {config.LINE_ALERT_PCT}% threshold."
        )
        action = "Pre-arrange reserves: charge storage, pre-book redispatch and demand response before the peak."
        impact_risk = (
            "Reactive handling would force emergency shedding; proactive reserves hold N-1 for a fraction of the cost."
        )
    else:
        # Watch: load growing materially but binding element stays within limits.
        title = f"Load forecast: +{growth_pct:.0f}% over {horizon_h} h"
        what = (
            f"Day-ahead total load rises {growth_pct:+.0f}% ({growth['load_now_mw']} to "
            f"{growth['load_horizon_mw']} MW over {horizon_h} h). "
            f"Binding element {gs.binding_constraint.element} remains within limits at ~{projected:.0f}%."
        )
        action = "Monitor load trend; pre-position reserves if growth accelerates beyond forecast."
        impact_risk = "No immediate risk; monitor if load growth accelerates beyond forecast."

    return {
        "id": f"ALR-{idx:03d}",
        "severity": severity,
        "element": gs.binding_constraint.element,
        "category": "line_forecast",
        "title": title,
        "what": what,
        "action": action,
        "impact_risk": impact_risk,
        "financial": cost,
        "predictive_basis": growth,
    }


def generate_alerts(value: str, horizon_h: int = 2, write: bool = False) -> dict:
    gs = state.compute_state(value)
    alerts: list[dict] = []
    idx = 1

    for branch in gs.overloaded:
        alerts.append(_branch_alert(branch, idx))
        idx += 1

    for violation in gs.voltage_violations[:5]:
        alerts.append(_voltage_alert(violation, idx))
        idx += 1

    # Forecast-driven look-ahead: the requested horizon plus a 6-hour warning.
    seen_forecasts: set[tuple[str, str]] = set()
    for horizon in dict.fromkeys([horizon_h, 6]):
        forecast_alert = _forecast_alert(gs, idx, horizon)
        if forecast_alert is None:
            continue
        signature = (forecast_alert["element"], forecast_alert["severity"])
        if signature in seen_forecasts:
            continue
        seen_forecasts.add(signature)
        alerts.append(forecast_alert)
        idx += 1

    binding = gs.binding_constraint
    if binding is None:
        headline = "System within limits; hold reserves for the forecast peak"
    elif binding.within_limits:
        headline = (
            f"Most loaded element {binding.element} at {binding.loading_percent:.0f}%, within limits; "
            "hold reserves for the forecast peak"
        )
    else:
        headline = f"Relieve {binding.element} (currently {binding.loading_percent:.0f}%) before the forecast peak"
    recommendation = {
        "headline": headline,
        "actions_ranked": [
            {
                "action": "Redispatch: raise cheap regulating generation near the deficit",
                "effect": "lowers flow on the binding element",
                **economics.estimate_redispatch_cost(delta_mw=15, hours=2),
                "type": "redispatch",
            }
        ],
    }

    payload = {
        "generated_at": _dt.now().isoformat(timespec="seconds"),
        "datetime": gs.datetime,
        "source": "Grid Pulse - alerts from solved snapshot + day-ahead forecast",
        "alerts": alerts,
        "recommendation_engine": recommendation,
    }

    if write:
        out = config.ensure_output_dir() / "alerts.json"
        out.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    return payload
