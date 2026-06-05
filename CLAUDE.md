# Grid Pulse — Project Context for Claude

## How to Start the App

Always kill old processes first, then start backend → frontend in that order.

```bash
# Kill anything on the ports
lsof -ti :8000 | xargs kill -9 2>/dev/null
lsof -ti :3000 | xargs kill -9 2>/dev/null

# Backend (FastAPI)
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000 &

# Frontend (Next.js)
cd ../frontend
npm run dev -- --port 3000 &
```

- Backend health check: `GET http://localhost:8000/health`
- Frontend: `http://localhost:3000`
- `localhost:8000` root returns `{"detail":"Not Found"}` — this is normal, there is no `/` route.
- API docs: `http://localhost:8000/docs`

## LLM Provider

**Groq** is the configured provider (OpenAI-compatible endpoint).

### Known broken model: `llama-3.3-70b-versatile`
When given a long system prompt (8 KB+), this model reverts to Llama's native
`<function=name{...}</function>` call format instead of OpenAI-style JSON tool calls.
Groq's API rejects this with `tool_use_failed`. The shift-summary endpoint works
because it calls the LLM with `tools=None` — only the chat/tool-calling path breaks.

### Working model: `meta-llama/llama-4-scout-17b-16e-instruct`
Set in `backend/.env`:

```
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
LLM_API_KEY=<groq key>
```

The provider always sends `parallel_tool_calls=False` to Groq, which is required for
reliable tool-call formatting on Llama models.

### Debug endpoint
`GET http://localhost:8000/debug/llm` — runs two live calls:
1. Plain text (same path as shift summary) — validates API key and connectivity.
2. Minimal tool call — validates that function calling works end-to-end.

Use this to diagnose LLM issues without touching the chat UI.

## Architecture

```
frontend/          Next.js 15 dashboard (map, KPIs, alerts, chat, shift summary)
backend/
  app/
    main.py        FastAPI routes
    config.py      Env loading, paths, thresholds
    llm/
      provider.py  OpenAI-SDK wrapper (RealProvider + MockProvider)
      orchestrator.py  Tool-calling loop, shift summary, risk sub-agent
      tools.py     Tool schemas + dispatch
    grid/          Load flow, N-1 contingency, topology
    analysis/      Alerts, forecasts, economics
```

## Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server + LLM mode status |
| GET | `/state` | Grid state for a datetime |
| GET | `/alerts` | Threshold alerts |
| GET | `/map` | Topology for the map UI |
| GET | `/n1` | N-1 contingency for a branch |
| GET | `/summary` | 12-hour shift handover (LLM, no tools) |
| GET | `/assess` | Risk verdict for an element (LLM) |
| POST | `/chat` | Tool-calling dispatcher assistant |
| POST | `/apply` | Execute an approved proposed action |
| GET | `/debug/llm` | Diagnose LLM connectivity and tool calling |

## Dataset

Located at `greenhack-2026-ČEPS-dataset/` (gitignored). Must be present for
grid state and alert endpoints to work. The config auto-resolves Unicode path variants.

## Mock Mode

If `LLM_API_KEY` is empty, the app uses `MockProvider` (deterministic, no API calls).
Useful for testing the tool-calling loop without a key.
