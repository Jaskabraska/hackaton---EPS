"""Central configuration. Paths, thresholds and LLM env loading.

Data is read directly from files on demand. No database.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = Path(__file__).resolve().parents[1]

load_dotenv(BACKEND_ROOT / ".env")

# --- Dataset layout (the folder is gitignored) ---
DATASET_ROOT = REPO_ROOT / "greenhack-2026-ČEPS-dataset" / "greenhack-2026-ČEPS-dataset"
DATA_ROOT = DATASET_ROOT / "data"
SNAPSHOTS_DIR = DATA_ROOT / "snapshots"
STATIC_DIR = DATA_ROOT / "static"
FORECASTS_DIR = DATA_ROOT / "forecasts" / "DA"
OTHER_DIR = DATA_ROOT / "other"

# --- Existing demo JSON shapes in the repo root (kept exactly as-is) ---
GRID_STATE_JSON = REPO_ROOT / "grid_state.json"
ALERTS_JSON = REPO_ROOT / "alerts.json"

# --- Generated results ---
OUTPUT_DIR = REPO_ROOT / "output"

# --- Glossary (single source of truth, injected into the LLM prompt) ---
GLOSSARY_PATH = Path(__file__).resolve().parent / "llm" / "glossary.json"

# --- Thresholds ---
LINE_ALERT_PCT = float(os.getenv("LINE_ALERT_PCT", "80"))
TRAFO_ALERT_PCT = float(os.getenv("TRAFO_ALERT_PCT", "90"))
V_PU_MIN = float(os.getenv("V_PU_MIN", "0.95"))
V_PU_MAX = float(os.getenv("V_PU_MAX", "1.05"))

# --- LLM ---
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")
LLM_MODEL = os.getenv("LLM_MODEL", "gemini-3-flash")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MAX_TOOL_ITERATIONS = int(os.getenv("LLM_MAX_TOOL_ITERATIONS", "6"))


def use_mock_llm() -> bool:
    """Mock provider is used whenever no API key is configured."""
    return not LLM_API_KEY.strip()


def ensure_output_dir() -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    return OUTPUT_DIR


def require_llm_ready() -> None:
    """Fail with a clear message if a real call is attempted without a key."""
    if use_mock_llm():
        raise RuntimeError(
            "No LLM_API_KEY configured and mock mode not selected. "
            "Copy backend/.env.example to backend/.env and paste the shared key, "
            "or run with the mock provider for tests."
        )
