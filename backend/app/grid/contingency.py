"""N-1 contingency analysis.

Take a solved snapshot, trip a single element, recompute the load flow, and
report whether anything goes over its limit. The cached snapshot is never
mutated - we work on a deep copy.
"""
from __future__ import annotations

import copy
import json

import pandapower as pp

from .. import config
from ..schemas import BranchLoading, ContingencyResult
from . import loader

OVERLOAD_PCT = 100.0


def _find_element(net, element: str) -> tuple[str, int]:
    line_match = net.line.index[net.line["name"] == element]
    if len(line_match):
        return "line", int(line_match[0])
    trafo_match = net.trafo.index[net.trafo["name"] == element]
    if len(trafo_match):
        return "trafo", int(trafo_match[0])
    raise ValueError(f"Unknown branch element: {element!r}")


def _overloads(net) -> list[BranchLoading]:
    def bus_name(idx: int) -> str:
        return str(net.bus.at[idx, "name"])

    overs: list[BranchLoading] = []
    for i in net.line.index:
        pct = float(net.res_line.at[i, "loading_percent"]) if i in net.res_line.index else 0.0
        if pct > OVERLOAD_PCT:
            overs.append(
                BranchLoading(
                    branch_name=str(net.line.at[i, "name"]),
                    from_bus=bus_name(int(net.line.at[i, "from_bus"])),
                    to_bus=bus_name(int(net.line.at[i, "to_bus"])),
                    loading_percent=round(pct, 2),
                    kind="line",
                )
            )
    for i in net.trafo.index:
        pct = float(net.res_trafo.at[i, "loading_percent"]) if i in net.res_trafo.index else 0.0
        if pct > OVERLOAD_PCT:
            overs.append(
                BranchLoading(
                    branch_name=str(net.trafo.at[i, "name"]),
                    from_bus=bus_name(int(net.trafo.at[i, "hv_bus"])),
                    to_bus=bus_name(int(net.trafo.at[i, "lv_bus"])),
                    loading_percent=round(pct, 2),
                    kind="trafo",
                )
            )
    overs.sort(key=lambda b: b.loading_percent, reverse=True)
    return overs


def _worst_loading(net) -> float:
    values = []
    if len(net.res_line):
        values.append(float(net.res_line["loading_percent"].max(skipna=True)))
    if len(net.res_trafo):
        values.append(float(net.res_trafo["loading_percent"].max(skipna=True)))
    values = [v for v in values if v == v]  # drop NaN
    return round(max(values), 2) if values else 0.0


def _unsupplied_count(net) -> int:
    """Number of buses left without supply after a trip (true islanding signal)."""
    try:
        return len(pp.topology.unsupplied_buses(net))
    except Exception:
        return 0


def run_n1(value: str, element: str, write: bool = False) -> ContingencyResult:
    base = loader.load_snapshot(value)
    kind, idx = _find_element(base, element)

    net = copy.deepcopy(base)
    table = net.line if kind == "line" else net.trafo
    table.at[idx, "in_service"] = False

    # Classify the trip into exactly one outcome: islanding (real loss of supply),
    # nonconvergence (numerical instability, not an outage), overload or secure.
    converged = True
    isolated_bus_count = 0
    try:
        pp.runpp(net)
    except pp.LoadflowNotConverged:
        # Real islanding leaves buses unsupplied; report only when N > 0.
        isolated_bus_count = _unsupplied_count(net)
        if isolated_bus_count > 0:
            converged = False
        else:
            # No islanding: treat as numerical non-convergence and retry with a flat
            # DC start, then a Gauss-Seidel fallback, before declaring instability.
            converged = False
            for kwargs in ({"init": "dc"}, {"algorithm": "gs"}):
                try:
                    pp.runpp(net, **kwargs)
                    converged = True
                    break
                except Exception:
                    continue

    overloads = _overloads(net) if converged else []
    worst = _worst_loading(net) if converged else 0.0

    if isolated_bus_count > 0:
        status = "islanding"
    elif not converged:
        status = "nonconvergence"
    elif overloads:
        status = "overload"
    else:
        status = "secure"

    result = ContingencyResult(
        datetime=loader.normalise_datetime(value),
        tripped_element=element,
        converged=converged,
        n1_secure=converged and len(overloads) == 0,
        new_overloads=overloads,
        worst_loading_percent=worst,
        isolated_bus_count=isolated_bus_count,
        status=status,
    )

    if write:
        out = config.ensure_output_dir() / "n1.json"
        out.write_text(json.dumps(result.model_dump(), indent=2), encoding="utf-8")

    return result
