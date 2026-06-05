"""Grid Pulse FastAPI app.

Endpoints are added as each module lands. Data is read from files on demand;
computed results are also written to the output/ folder.
"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .analysis import alerts, playback
from .grid import contingency, state, topology
from .llm import orchestrator
from .llm.provider import LLMProviderError
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
    try:
        return orchestrator.run_chat(req.message, datetime=req.datetime, history=req.history)
    except LLMProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/apply")
def post_apply(action: ProposedAction) -> dict:
    try:
        return orchestrator.apply_action(action)
    except LLMProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/assess", response_model=RiskVerdict)
def get_assess(element: str, datetime: str = "2024_01_01_18_00_00") -> RiskVerdict:
    try:
        return orchestrator.assess_risk(datetime, element)
    except LLMProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/summary", response_model=ShiftSummary)
def get_summary(datetime: str = "2024_01_01_18_00_00", window_h: int = 12) -> ShiftSummary:
    try:
        return orchestrator.shift_summary(datetime, window_h=window_h)
    except LLMProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/playback")
def get_playback(hours: int = 24, start: str | None = None) -> dict:
    if hours not in (24, 48):
        raise HTTPException(status_code=400, detail="hours must be 24 or 48")
    try:
        if start:
            datetimes = playback.enumerate_window(start, hours)
            return {
                "window_start": datetimes[0] if datetimes else start,
                "window_end": datetimes[-1] if datetimes else start,
                "hours": hours,
                "datetimes": datetimes,
            }
        return playback.best_window(hours)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/debug/llm")
def debug_llm() -> dict:
    """Diagnose the LLM provider: plain text call, then a minimal tool-calling call."""
    import traceback
    from .llm.provider import RealProvider, MockProvider
    from . import config as cfg

    result: dict = {
        "mock_mode": cfg.use_mock_llm(),
        "model": cfg.LLM_MODEL,
        "base_url": cfg.LLM_BASE_URL,
        "api_key_set": bool(cfg.LLM_API_KEY),
        "api_key_prefix": cfg.LLM_API_KEY[:8] + "..." if cfg.LLM_API_KEY else None,
        "plain_text": None,
        "tool_call": None,
        "errors": [],
    }

    if cfg.use_mock_llm():
        result["plain_text"] = "skipped (mock mode)"
        result["tool_call"] = "skipped (mock mode)"
        return result

    try:
        provider = RealProvider()
    except Exception as exc:
        result["errors"].append(f"provider init: {exc}")
        return result

    # 1. Plain text — same path as shift summary
    try:
        resp = provider.chat(
            [{"role": "user", "content": "Reply with exactly: PLAIN_OK"}],
            tools=None,
        )
        result["plain_text"] = resp.content
    except Exception as exc:
        result["plain_text"] = f"ERROR: {exc}"
        result["errors"].append(traceback.format_exc())

    # 2. Minimal tool call — same path as /chat
    minimal_tool = [
        {
            "type": "function",
            "function": {
                "name": "ping",
                "description": "Return a ping confirmation.",
                "parameters": {"type": "object", "properties": {}},
            },
        }
    ]
    try:
        resp = provider.chat(
            [{"role": "user", "content": "Call the ping tool now."}],
            tools=minimal_tool,
        )
        result["tool_call"] = {
            "content": resp.content,
            "tool_calls": [{"name": tc.name, "arguments": tc.arguments} for tc in resp.tool_calls],
        }
    except Exception as exc:
        result["tool_call"] = f"ERROR: {exc}"
        result["errors"].append(traceback.format_exc())

    return result
