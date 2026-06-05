"""Compute a human/LLM-friendly grid state from a solved pandapower snapshot.

All numbers come straight from the solved load flow already inside the snapshot.
"""
from __future__ import annotations

import json
import math

from .. import config
from ..schemas import (
    BindingConstraint,
    BranchLoading,
    BusVoltage,
    GridState,
    RegionBalance,
)
from . import loader


def _bus_name(net, idx: int) -> str:
    return str(net.bus.at[idx, "name"])


def _bus_region(net, idx: int) -> str:
    return str(net.bus.at[idx, "zone"])


def _safe(value: float) -> float:
    return 0.0 if value is None or (isinstance(value, float) and math.isnan(value)) else float(value)


def _branch_loadings(net) -> list[BranchLoading]:
    lines = [
        BranchLoading(
            branch_name=str(net.line.at[i, "name"]),
            from_bus=_bus_name(net, int(net.line.at[i, "from_bus"])),
            to_bus=_bus_name(net, int(net.line.at[i, "to_bus"])),
            loading_percent=round(_safe(net.res_line.at[i, "loading_percent"]), 2),
            kind="line",
        )
        for i in net.line.index
    ]
    trafos = [
        BranchLoading(
            branch_name=str(net.trafo.at[i, "name"]),
            from_bus=_bus_name(net, int(net.trafo.at[i, "hv_bus"])),
            to_bus=_bus_name(net, int(net.trafo.at[i, "lv_bus"])),
            loading_percent=round(_safe(net.res_trafo.at[i, "loading_percent"]), 2),
            kind="trafo",
        )
        for i in net.trafo.index
    ]
    return lines + trafos


def _region_balances(net) -> list[RegionBalance]:
    load_by_region: dict[str, float] = {}
    gen_by_region: dict[str, float] = {}

    for i in net.load.index:
        region = _bus_region(net, int(net.load.at[i, "bus"]))
        load_by_region[region] = load_by_region.get(region, 0.0) + _safe(net.res_load.at[i, "p_mw"])

    for i in net.gen.index:
        region = _bus_region(net, int(net.gen.at[i, "bus"]))
        gen_by_region[region] = gen_by_region.get(region, 0.0) + _safe(net.res_gen.at[i, "p_mw"])

    for i in net.ext_grid.index:
        region = _bus_region(net, int(net.ext_grid.at[i, "bus"]))
        gen_by_region[region] = gen_by_region.get(region, 0.0) + _safe(net.res_ext_grid.at[i, "p_mw"])

    regions = sorted(set(load_by_region) | set(gen_by_region))
    return [
        RegionBalance(
            region=r,
            load_mw=round(load_by_region.get(r, 0.0), 2),
            gen_mw=round(gen_by_region.get(r, 0.0), 2),
            balance_mw=round(gen_by_region.get(r, 0.0) - load_by_region.get(r, 0.0), 2),
        )
        for r in regions
    ]


def _bus_voltages(net) -> list[BusVoltage]:
    return [
        BusVoltage(
            bus_name=_bus_name(net, i),
            region=_bus_region(net, i),
            vm_pu=round(_safe(net.res_bus.at[i, "vm_pu"]), 4),
            in_band=config.V_PU_MIN <= _safe(net.res_bus.at[i, "vm_pu"]) <= config.V_PU_MAX,
        )
        for i in net.bus.index
    ]


def compute_state(value: str, write: bool = False) -> GridState:
    net = loader.load_snapshot(value)
    branches = _branch_loadings(net)
    voltages = _bus_voltages(net)

    binding = max(branches, key=lambda b: b.loading_percent, default=None)
    binding_constraint = (
        BindingConstraint(element=binding.branch_name, kind=binding.kind, loading_percent=binding.loading_percent)
        if binding is not None
        else None
    )

    overloaded = [
        b
        for b in branches
        if b.loading_percent >= (config.LINE_ALERT_PCT if b.kind == "line" else config.TRAFO_ALERT_PCT)
    ]
    overloaded.sort(key=lambda b: b.loading_percent, reverse=True)

    violations = [v for v in voltages if not v.in_band]
    worst_voltage = max(voltages, key=lambda v: abs(v.vm_pu - 1.0), default=None)

    total_load = round(float(net.res_load["p_mw"].sum()), 2)
    total_gen = round(
        float(net.res_gen["p_mw"].sum())
        + float(net.res_ext_grid["p_mw"].sum())
        + (float(net.res_sgen["p_mw"].sum()) if len(net.res_sgen) else 0.0),
        2,
    )

    gs = GridState(
        datetime=loader.normalise_datetime(value),
        total_load_mw=total_load,
        total_gen_mw=total_gen,
        n_buses=len(net.bus),
        n_branches=len(net.line) + len(net.trafo),
        binding_constraint=binding_constraint,
        worst_voltage=worst_voltage,
        regions=_region_balances(net),
        overloaded=overloaded,
        voltage_violations=violations,
    )

    if write:
        out = config.ensure_output_dir() / "state.json"
        out.write_text(json.dumps(gs.model_dump(), indent=2), encoding="utf-8")

    return gs
