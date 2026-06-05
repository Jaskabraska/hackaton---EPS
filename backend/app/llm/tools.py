"""OpenAI-style function/tool definitions and dispatch.

Each tool returns structured JSON (never prose). This is the only path through
which the model may obtain numbers.
"""
from __future__ import annotations

from typing import Any

from ..analysis import alerts as alerts_mod
from ..analysis import economics, forecasts
from ..grid import contingency, state, topology

PROPOSE_ACTION = "propose_action"

TOOL_SCHEMAS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "get_state",
            "description": "Solved grid state for a datetime: loadings, voltages, region balances, binding constraint.",
            "parameters": {
                "type": "object",
                "properties": {"datetime": {"type": "string", "description": "Snapshot time, e.g. 2024_01_01_18_00_00"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_n1",
            "description": "Trip a single branch and recompute the load flow to test N-1 security.",
            "parameters": {
                "type": "object",
                "properties": {
                    "datetime": {"type": "string"},
                    "element": {"type": "string", "description": "Branch name, e.g. branch_001_002_1"},
                },
                "required": ["element"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_alerts",
            "description": "Threshold and forecast-driven alerts for a datetime.",
            "parameters": {
                "type": "object",
                "properties": {"datetime": {"type": "string"}, "horizon_h": {"type": "integer"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_connections",
            "description": "List the buses directly connected to a given bus and the branches linking them.",
            "parameters": {
                "type": "object",
                "properties": {
                    "bus": {"type": "string", "description": "Bus name, e.g. bus_003"},
                    "datetime": {"type": "string"},
                },
                "required": ["bus"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_forecast",
            "description": "Day-ahead load growth between now and now+horizon_h (MW and ratio).",
            "parameters": {
                "type": "object",
                "properties": {"datetime": {"type": "string"}, "horizon_h": {"type": "integer"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "estimate_cost",
            "description": "Estimate the Kč cost of a redispatch of delta_mw over a number of hours.",
            "parameters": {
                "type": "object",
                "properties": {
                    "delta_mw": {"type": "number"},
                    "hours": {"type": "number"},
                    "fuel": {"type": "string"},
                },
                "required": ["delta_mw", "hours"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_analogues",
            "description": "Find historical hours similar to this one and what happened next (optional FAISS feature).",
            "parameters": {"type": "object", "properties": {"datetime": {"type": "string"}}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": PROPOSE_ACTION,
            "description": "Propose an operational action that needs dispatcher approval before deeper analysis runs.",
            "parameters": {
                "type": "object",
                "properties": {
                    "kind": {"type": "string", "description": "e.g. run_n1, redispatch, assess_risk"},
                    "element": {"type": "string"},
                    "datetime": {"type": "string"},
                    "description": {"type": "string"},
                },
                "required": ["kind", "description"],
            },
        },
    },
]

# Tool subset for the focused risk sub-agent.
RISK_TOOL_NAMES = {"run_n1", "find_analogues", "estimate_cost"}
RISK_TOOL_SCHEMAS = [t for t in TOOL_SCHEMAS if t["function"]["name"] in RISK_TOOL_NAMES]


def dispatch(name: str, args: dict[str, Any], default_datetime: str) -> dict:
    dt = args.get("datetime") or default_datetime
    if name == "get_state":
        return state.compute_state(dt, write=True).model_dump()
    if name == "run_n1":
        return contingency.run_n1(dt, args["element"], write=True).model_dump()
    if name == "get_connections":
        bus = args.get("bus")
        if not bus:
            return {"error": "get_connections requires a 'bus' argument, e.g. bus_003"}
        return topology.connections(dt, bus)
    if name == "get_alerts":
        return alerts_mod.generate_alerts(dt, horizon_h=int(args.get("horizon_h", 2)), write=True)
    if name == "get_forecast":
        result = forecasts.load_growth(dt, int(args.get("horizon_h", 2)))
        return result or {"available": False, "reason": "no forecast at this time"}
    if name == "estimate_cost":
        return economics.estimate_redispatch_cost(
            float(args["delta_mw"]), float(args["hours"]), args.get("fuel", economics.DEFAULT_FUEL)
        )
    if name == "find_analogues":
        return {"available": False, "reason": "FAISS analogues not enabled in this build"}
    if name == PROPOSE_ACTION:
        return {
            "kind": args.get("kind", "assess_risk"),
            "element": args.get("element"),
            "datetime": dt,
            "description": args.get("description", ""),
        }
    return {"error": f"unknown tool: {name}"}
