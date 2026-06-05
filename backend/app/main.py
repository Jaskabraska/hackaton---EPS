"""Grid Pulse FastAPI app.

Endpoints are added as each module lands. Data is read from files on demand;
computed results are also written to the output/ folder.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config

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
