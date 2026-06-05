"""Build a drawable map of the network: node coordinates + branch loadings.

Coordinates come from the static bus_coordinates.csv; loadings come from the
solved snapshot. One call gives the frontend everything it needs to draw.
"""
from __future__ import annotations

import json
from functools import lru_cache

import pandas as pd

from .. import config
from . import loader


@lru_cache(maxsize=1)
def _coordinates() -> dict[str, tuple[float, float]]:
    df = pd.read_csv(config.STATIC_DIR / "bus_coordinates.csv")
    return {str(r.bus_name): (float(r.x_coordinate), float(r.y_coordinate)) for r in df.itertuples()}


def build_map(value: str, write: bool = False) -> dict:
    net = loader.load_snapshot(value)
    coords = _coordinates()

    load_by_bus: dict[int, float] = {}
    for i in net.load.index:
        b = int(net.load.at[i, "bus"])
        load_by_bus[b] = load_by_bus.get(b, 0.0) + float(net.res_load.at[i, "p_mw"])
    gen_by_bus: dict[int, float] = {}
    for i in net.gen.index:
        b = int(net.gen.at[i, "bus"])
        gen_by_bus[b] = gen_by_bus.get(b, 0.0) + float(net.res_gen.at[i, "p_mw"])

    nodes = []
    for i in net.bus.index:
        name = str(net.bus.at[i, "name"])
        x, y = coords.get(name, (0.0, 0.0))
        vm = float(net.res_bus.at[i, "vm_pu"]) if i in net.res_bus.index else 0.0
        nodes.append(
            {
                "bus_name": name,
                "region": str(net.bus.at[i, "zone"]),
                "x": x,
                "y": y,
                "vm_pu": round(vm, 4),
                "in_band": config.V_PU_MIN <= vm <= config.V_PU_MAX,
                "p_load_mw": round(load_by_bus.get(i, 0.0), 2),
                "p_gen_mw": round(gen_by_bus.get(i, 0.0), 2),
            }
        )

    def edge(name: str, a: int, b: int, loading: float, kind: str) -> dict:
        ca, cb = coords.get(str(net.bus.at[a, "name"]), (0, 0)), coords.get(str(net.bus.at[b, "name"]), (0, 0))
        return {
            "branch_name": name,
            "kind": kind,
            "x1": ca[0],
            "y1": ca[1],
            "x2": cb[0],
            "y2": cb[1],
            "loading_percent": round(float(loading) if loading == loading else 0.0, 2),
        }

    edges = [
        edge(str(net.line.at[i, "name"]), int(net.line.at[i, "from_bus"]), int(net.line.at[i, "to_bus"]),
             net.res_line.at[i, "loading_percent"], "line")
        for i in net.line.index
    ]
    edges += [
        edge(str(net.trafo.at[i, "name"]), int(net.trafo.at[i, "hv_bus"]), int(net.trafo.at[i, "lv_bus"]),
             net.res_trafo.at[i, "loading_percent"], "trafo")
        for i in net.trafo.index
    ]

    payload = {"datetime": loader.normalise_datetime(value), "nodes": nodes, "edges": edges}
    if write:
        config.ensure_output_dir().joinpath("map.json").write_text(
            json.dumps(payload, indent=2), encoding="utf-8"
        )
    return payload
