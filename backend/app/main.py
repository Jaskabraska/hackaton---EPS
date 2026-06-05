"""Grid Pulse FastAPI app.

Endpoints are added as each module lands. Data is read from files on demand;
computed results are also written to the output/ folder.
"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .analysis import alerts
from .grid import contingency, state, topology
from .llm import orchestrator
from .schemas import (
    ChatRequest,
    ChatResponse,
    ContingencyResult,
    GridState,
    ProposedAction,
    RiskVerdict,
    ShiftSummary,
)

app = FastAPI(title="Grid Pulse API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "llm_mode": "mock" if config.use_mock_llm() else "live",
        "dataset_present": config.SNAPSHOTS_DIR.exists(),
    }


@app.get("/state", response_model=GridState)
def get_state(datetime: str = "2024_01_01_18_00_00") -> GridState:
    try:
        return state.compute_state(datetime, write=True)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/map")
def get_map(datetime: str = "2024_01_01_18_00_00") -> dict:
    try:
        return topology.build_map(datetime, write=True)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/n1", response_model=ContingencyResult)
def get_n1(element: str, datetime: str = "2024_01_01_18_00_00") -> ContingencyResult:
    try:
        return contingency.run_n1(datetime, element, write=True)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/alerts")
def get_alerts(datetime: str = "2024_01_01_18_00_00", horizon_h: int = 2) -> dict:
    try:
        return alerts.generate_alerts(datetime, horizon_h=horizon_h, write=True)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/chat", response_model=ChatResponse)
def post_chat(req: ChatRequest) -> ChatResponse:
    return orchestrator.run_chat(req.message, datetime=req.datetime, history=req.history)


@app.post("/apply")
def post_apply(action: ProposedAction) -> dict:
    return orchestrator.apply_action(action)


@app.get("/assess", response_model=RiskVerdict)
def get_assess(element: str, datetime: str = "2024_01_01_18_00_00") -> RiskVerdict:
    try:
        return orchestrator.assess_risk(datetime, element)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/summary", response_model=ShiftSummary)
def get_summary(datetime: str = "2024_01_01_18_00_00", window_h: int = 12) -> ShiftSummary:
    return orchestrator.shift_summary(datetime, window_h=window_h)
