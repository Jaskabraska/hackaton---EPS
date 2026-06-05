"""Grid Pulse FastAPI app.

Endpoints are added as each module lands. Data is read from files on demand;
computed results are also written to the output/ folder.
"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .grid import state
from .schemas import GridState

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
