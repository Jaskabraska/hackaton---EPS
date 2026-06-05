# Grid Pulse — Hackathon EPS 2026

An AI-powered power grid monitoring and dispatch assistant built for the **Grid Pulse Challenge 2026** (ČEPS / IEEE-118 dataset).

The core idea: **the LLM does not compute physics — it picks the right tool and explains the result. Every number comes from a tool call (pandapower / the dataset), never from the model.**

## Architecture

| Layer | Tool | Purpose |
|-------|------|---------|
| Physics | **pandapower** | Solved load flow + N-1 contingency on the real IEEE-118 snapshots |
| Data | **files, read on demand** | Dataset CSV/JSON + the snapshot JSONs; results cached in memory (no database) |
| Brain | **Gemini via the OpenAI-compatible API** + tool calling | Dispatcher query → tool → explanation; mock provider when no key |
| UI | **Next.js + TypeScript + Tailwind** | Dispatcher dashboard: real-coordinate map, KPIs, alerts, chat |

The backend is **FastAPI + Python**. The domain glossary (`backend/app/llm/glossary.json`) is injected into the LLM system prompt so it reads column names, units and TSO jargon correctly. Computed results are also written as JSON into `output/`.

## Project layout

```
backend/                 FastAPI + pandapower
  app/
    config.py            paths, thresholds, env loading (python-dotenv)
    main.py              routes: /health /state /map /n1 /alerts /chat /apply /assess /summary
    grid/                loader (lru_cache), state, contingency (N-1), topology (map)
    analysis/            alerts (forecast MW vs limits), economics (fuel-price Kč), forecasts
    llm/                 provider (Gemini + mock), tools, orchestrator, glossary.json
    schemas.py           pydantic models (mirrored by the frontend types)
  tests/                 pytest, tests-first (incl. mock-provider loop, no key needed)
  .env.example           LLM_BASE_URL / LLM_MODEL / LLM_API_KEY template
frontend/                Next.js dashboard (GridMap, KpiTiles, AlertsPanel, NodeInspector, AiSummary, ChatBox)
output/                  generated JSON results (gitignored)
```

## Running it

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
copy .env.example .env        # paste the shared Gemini key (shared privately, never via the repo)
.venv\Scripts\python -m uvicorn app.main:app --port 8000
```

Without a key the backend runs in **mock LLM mode** — every endpoint still works, the chat loop still calls tools. Tests run with no key.

```bash
cd backend
.venv\Scripts\python -m pytest
```

### Frontend

```bash
cd frontend
npm install
copy .env.example .env        # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

## LLM provider (Gemini, free tier)

Configured purely through env vars in `backend/.env`:

```
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
LLM_MODEL=gemini-3-flash
LLM_API_KEY=<shared key, never committed>
```

- Default `gemini-3-flash` (good free limits, supports function calling). Verify the exact model id in Google AI Studio.
- For final demo runs only you may set `LLM_MODEL=gemini-2.5-pro` (strict **50 requests/day** free limit).
- Drop-in fallbacks (same OpenAI-compatible interface, only env vars change):
  - Groq: `LLM_BASE_URL=https://api.groq.com/openai/v1`, `LLM_MODEL=llama-3.3-70b-versatile`
  - Ollama: `LLM_BASE_URL=http://localhost:11434/v1`, `LLM_MODEL=llama3.1`, `LLM_API_KEY=ollama`
- No `LLM_API_KEY` → the deterministic **mock provider** is used so nothing breaks.

The single shared key lives only in the gitignored `.env`; share it out-of-band, never through the repo.

## Agentic features

- **Tool-calling orchestrator** with a capped iteration loop and glossary-aware system prompt.
- **Human-in-the-loop**: `/chat` can return `awaiting_approval` with a `proposed_action`; the frontend Approve button calls `/apply`, which runs the deeper what-if (N-1 + risk + cost).
- **Risk sub-agent** (`/assess`): a focused step using only `run_n1` + `find_analogues` + `estimate_cost`, returning a structured JSON risk verdict (`output/risk.json`).
- **Deterministic shift summary** (`/summary`): gathers 12 h of alerts from the files, then a single LLM summarise call (`output/shift_summary.json`).

## API endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /state` | Loadings, voltages, region balances, binding constraint |
| `GET /map` | Node coordinates + branch loadings for the dashboard map |
| `GET /n1?element=` | Trip one branch, recompute, report overloads |
| `GET /alerts` | Threshold + day-ahead-forecast alerts |
| `POST /chat` | Dispatcher assistant (tool calling, may await approval) |
| `POST /apply` | Run the approved action's deeper analysis |
| `GET /assess?element=` | Structured single-element risk verdict |
| `GET /summary` | Deterministic 12 h shift handover |

## Dataset

The real **IEEE-118 ČEPS dataset** (118 buses across regions `r1`/`r2`/`r3`, 186 branches, 321 generators, 91 loads) with **8 760 hourly pandapower snapshots**, day-ahead forecasts (load per region, solar/wind per generator) and monthly fuel prices. The `greenhack-2026-ČEPS-dataset/` folder is gitignored (too large for GitHub).

Derived from [evgenytsydenov/ieee118_power_flow_data](https://github.com/evgenytsydenov/ieee118_power_flow_data), licensed **[CC-BY-NC-SA 4.0](http://creativecommons.org/licenses/by-nc-sa/4.0/)** — non-commercial, share-alike.

## Reference material

| File | Description |
|------|-------------|
| `Grid Pulse Challenge(1).pdf` | Official challenge brief |
| `Grid_Pulse_MVP_plan.md` | MVP plan — maximum value, minimum time |
| `Grid_Pulse_koncept.md` | Full application concept (physics explanation, demo scenario) |
| `grid_pulse_build_plan_12c911db.plan.md` | Detailed phased build plan |
| `grid_pulse_city_demo.html`, `grid_pulse_map.html` | Original visual mockups |
| `grid_state.json`, `alerts.json` | Example JSON shapes the alert engine mirrors |
