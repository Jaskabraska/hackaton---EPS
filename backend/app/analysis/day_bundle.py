"""Precompute a full-day bundle: per-hour state + alerts + worst N-1 + summary.

The bundle is written to output/ as JSON and served by the GET /day endpoint.
During the demo, playback runs from this file with no live compute.

Usage (CLI):
    cd backend
    python -m app.analysis.day_bundle 2024_02_17
"""
from __future__ import annotations

import json
import sys
from datetime import datetime as _dt

from .. import config
from ..analysis import alerts as alerts_mod
from ..analysis.forecasts import shift_stem
from ..grid import contingency, loader, state


def _find_worst_branch(stem: str, tripped_element: str) -> tuple[str | None, float]:
    """After tripping an element, find the highest-loaded remaining branch."""
    import copy
    import pandapower as pp

    net = loader.load_snapshot(stem)
    net2 = copy.deepcopy(net)

    # Trip the element
    line_match = net2.line.index[net2.line["name"] == tripped_element]
    if len(line_match):
        net2.line.at[line_match[0], "in_service"] = False
    else:
        trafo_match = net2.trafo.index[net2.trafo["name"] == tripped_element]
        if len(trafo_match):
            net2.trafo.at[trafo_match[0], "in_service"] = False
        else:
            return None, 0.0

    try:
        pp.runpp(net2)
    except Exception:
        return None, 0.0

    max_loading = 0.0
    max_name = None
    for i in net2.res_line.index:
        pct = float(net2.res_line.at[i, "loading_percent"])
        if pct == pct and pct > max_loading:  # skip NaN
            max_loading = pct
            max_name = str(net2.line.at[i, "name"])
    for i in net2.res_trafo.index:
        pct = float(net2.res_trafo.at[i, "loading_percent"])
        if pct == pct and pct > max_loading:
            max_loading = pct
            max_name = str(net2.trafo.at[i, "name"])

    return max_name, round(max_loading, 2)


def _worst_n1_for_hour(stem: str) -> dict:
    """Run N-1 on every branch and return the worst contingency for this hour."""
    net = loader.load_snapshot(stem)

    branch_names: list[str] = []
    for i in net.line.index:
        branch_names.append(str(net.line.at[i, "name"]))
    for i in net.trafo.index:
        branch_names.append(str(net.trafo.at[i, "name"]))

    # Track separately by N-1 outcome: worst converged loading, worst islanding (real
    # loss of supply), and any non-convergence (numerical instability, NOT an outage).
    worst_converged: dict | None = None
    worst_converged_loading = 0.0
    worst_islanding: dict | None = None
    worst_nonconverge: dict | None = None

    for branch in branch_names:
        try:
            result = contingency.run_n1(stem, branch)
        except Exception:
            continue

        # For converged cases, identify the affected element (highest-loaded branch)
        affected_name = None
        affected_pct = None
        if result.converged and result.new_overloads:
            affected_name = result.new_overloads[0].branch_name
            affected_pct = result.new_overloads[0].loading_percent

        entry = {
            "tripped_element": branch,
            "status": result.status,
            "converged": result.converged,
            "n1_secure": result.n1_secure,
            "worst_loading_percent": result.worst_loading_percent,
            "isolated_bus_count": result.isolated_bus_count,
            "affected_element": affected_name,
            "affected_loading_percent": affected_pct,
            "new_overloads": [ol.model_dump() for ol in result.new_overloads],
        }

        if result.status == "islanding":
            if worst_islanding is None or result.isolated_bus_count > worst_islanding["isolated_bus_count"]:
                worst_islanding = entry
        elif result.status == "nonconvergence":
            if worst_nonconverge is None:
                worst_nonconverge = entry
        elif result.worst_loading_percent > worst_converged_loading:
            # secure or overload: both converge; track the highest post-trip loading.
            worst_converged_loading = result.worst_loading_percent
            worst_converged = entry

    # Pick the primary worst for reporting: prefer the converged overload, then islanding.
    # Non-convergence is recorded as a study note, never the headline N-1 result.
    worst = worst_converged or worst_islanding or worst_nonconverge
    if worst is None:
        worst = {
            "tripped_element": None,
            "status": "secure",
            "converged": True,
            "n1_secure": True,
            "worst_loading_percent": 0.0,
            "isolated_bus_count": 0,
            "affected_element": None,
            "affected_loading_percent": None,
            "new_overloads": [],
        }

    # Flag non-convergence for study without raising an alert (possible instability, not an outage).
    worst["nonconvergence_note"] = (
        f"Tripping {worst_nonconverge['tripped_element']} did not converge after DC/Gauss-Seidel "
        "retries — possible instability, flagged for study."
        if worst_nonconverge
        else None
    )

    # Generate N-1 alerts
    n1_alerts: list[dict] = []

    # Alert for converged overload exceeding LINE_ALERT_PCT (80%)
    if worst_converged and worst_converged["worst_loading_percent"] > config.LINE_ALERT_PCT:
        loading = worst_converged["worst_loading_percent"]
        severity = "CRITICAL" if loading > 100 else "HIGH"
        tripped = worst_converged["tripped_element"]
        affected = worst_converged["affected_element"]
        # If affected_element is unknown (no branch >100%), find the highest-loaded branch
        if not affected and tripped:
            affected, _ = _find_worst_branch(stem, tripped)
            worst_converged["affected_element"] = affected
        affected = affected or "an element"
        n1_alerts.append({
            "id": "ALR-N1-OL",
            "severity": severity,
            "element": affected,
            "category": "n1_contingency",
            "title": f"N-1 risk: if {tripped} trips, {affected} reaches {loading:.0f}%",
            "what": (
                f"At this hour the grid is N-1 at risk: if {tripped} trips, "
                f"{affected} would rise to {loading:.1f}% (over its {config.LINE_ALERT_PCT:.0f}% limit)."
            ),
            "action": "Pre-arrange redispatch to relieve the contingency corridor.",
            "impact_risk": "A single trip could cause cascading overload.",
            "financial": None,
            "predictive_basis": None,
        })

    # Alert for real islanding only (loss of supply to N>0 buses). Numerical
    # non-convergence is NOT an outage and never raises an alert.
    if worst_islanding and worst_islanding["isolated_bus_count"] > 0:
        tripped = worst_islanding["tripped_element"]
        n_isolated = worst_islanding["isolated_bus_count"]
        n1_alerts.append({
            "id": "ALR-N1-DIV",
            "severity": "CRITICAL",
            "element": tripped,
            "category": "n1_contingency",
            "title": f"N-1 critical: tripping {tripped} causes loss of supply to {n_isolated} buses",
            "what": (
                f"If {tripped} trips, {n_isolated} buses lose supply (islanding)."
            ),
            "action": "Immediate redispatch or topology change to restore N-1 security.",
            "impact_risk": "Islanding risk with potential blackout.",
            "financial": None,
            "predictive_basis": None,
        })

    # Use the highest-severity alert as the primary n1_alert
    worst["n1_alert"] = n1_alerts[0] if n1_alerts else None
    worst["n1_alerts"] = n1_alerts
    return worst


def compute_hour(stem: str) -> dict:
    """Compute state, alerts, and worst N-1 for a single hour."""
    gs = state.compute_state(stem)
    alert_payload = alerts_mod.generate_alerts(stem)

    print(f"  Computing N-1 for {stem} ...", flush=True)
    worst_n1 = _worst_n1_for_hour(stem)

    # Inject N-1 alerts into the alerts list
    hour_alerts = alert_payload.copy()
    n1_alerts_list = worst_n1.get("n1_alerts", [])
    if n1_alerts_list:
        hour_alerts["alerts"] = list(alert_payload["alerts"]) + n1_alerts_list

    return {
        "datetime": stem,
        "state": gs.model_dump(),
        "alerts": hour_alerts,
        "worst_n1": worst_n1,
    }


def _alert_signature(alert: dict) -> tuple[str, str]:
    """Stable identity for an alert episode (independent of changing loading numbers)."""
    if str(alert.get("id", "")).startswith("ALR-N1"):
        return (alert["id"], alert.get("element", ""))
    return (alert.get("category", ""), alert.get("element", ""))


def _dedupe_across_hours(hours: list[dict]) -> None:
    """Suppress repeated alerts so a persistent episode is raised once, not every hour.

    An alert is kept only on the first hour of a contiguous run of hours where its
    signature is present; on subsequent consecutive hours it is dropped. A signature
    that disappears for an hour can be re-raised, so a genuinely new episode still fires.
    Mutates each hour's ``alerts.alerts`` list in place.
    """
    prev_sigs: set[tuple[str, str]] = set()
    for hour in hours:
        raw_alerts = hour["alerts"].get("alerts", [])
        raw_sigs = {_alert_signature(a) for a in raw_alerts}
        hour["alerts"]["alerts"] = [
            a for a in raw_alerts if _alert_signature(a) not in prev_sigs
        ]
        prev_sigs = raw_sigs


def compute_day_bundle(date: str, write: bool = True) -> dict:
    """Precompute 24 hours of state + alerts + N-1, plus a shift summary."""
    from ..llm.orchestrator import summarise_shift

    # Normalise date to midnight stem
    parts = date.replace("-", "_").split("_")
    if len(parts) == 3:
        year, month, day = parts
        base_stem = f"{year}_{month.zfill(2)}_{day.zfill(2)}_00_00_00"
    else:
        base_stem = loader.normalise_datetime(date)

    hours: list[dict] = []
    for h in range(24):
        stem = shift_stem(base_stem, h)
        try:
            hour_data = compute_hour(stem)
            hours.append(hour_data)
            print(f"  Hour {h:02d} done: {stem}", flush=True)
        except FileNotFoundError:
            print(f"  Hour {h:02d} skipped: {stem} (no snapshot)", flush=True)
            continue

    # Dedupe persistent alert episodes so the announcement/auto-pause fires once.
    _dedupe_across_hours(hours)

    # Night-shift handover (18:00 -> end of the loaded day) — captures the 19:00 incident.
    night_hours = [
        hr for hr in hours
        if int(hr["datetime"].split("_")[3]) >= config.NIGHT_SHIFT_START_H
    ]
    try:
        summary = summarise_shift(night_hours, shift_label="night", write=False)
        summary_text = summary.summary
    except Exception as exc:
        print(f"  Summary generation failed: {exc}")
        summary_text = "Shift summary unavailable."

    bundle = {
        "date": date,
        "computed_at": _dt.now().isoformat(timespec="seconds"),
        "hours": hours,
        "summary": summary_text,
    }

    if write:
        out = config.ensure_output_dir() / f"day_bundle_{date.replace('-', '_')}.json"
        out.write_text(json.dumps(bundle, indent=2, default=str), encoding="utf-8")
        print(f"Bundle written to {out}")

    return bundle


if __name__ == "__main__":
    target_date = sys.argv[1] if len(sys.argv) > 1 else "2024_02_17"
    print(f"Computing day bundle for {target_date} ...")
    compute_day_bundle(target_date)
