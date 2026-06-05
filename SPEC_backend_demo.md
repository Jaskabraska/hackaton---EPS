# Grid Pulse — backend + demo spec

Scope: fix the backend correctness and grounding, add a playback demo, and tighten the map/alerts/summary/forecast behaviour. No new features beyond the notes below. Work happens in the `hackathon` repo (FastAPI backend + Next.js frontend, IEEE-118 ČEPS dataset).

## 1. Goals

- Make the assistant answer **from our data**, not from model priors: every fact comes from a tool call over the dataset, and the relevant state/alerts are passed in as context.
- Make the **shift summary deterministic**: identical output for identical input, driven primarily by the alerts.
- Ship a **live demo**: the backend can play a fixed window of 24 or 48 consecutive hours chosen to be visually interesting.
- Improve the **map** (background, zoom, source-type icons, regions/borders) and **alerts** (clear notifications + on-map severity markers).
- Let a user **drill into an alert** (reasons + immediate fix).
- Use the **day-ahead forecast** to warn about what may happen in the next 6 hours.

## 2. Requirements

### R1 — Data grounding (assistant uses our data)
- The chat/summary prompts must include the current grid state and active alerts for the selected datetime as context, plus the existing `glossary.json`.
- The system prompt must keep the hard rule: every number comes from a tool call; the model must not invent values. When data is missing, the model calls the relevant tool rather than refusing.

### R2 — Deterministic shift summary
- The summary must be reproducible: same `datetime` + `window_h` ⇒ byte-identical `summary` text across repeated calls.
- Set LLM `temperature = 0` (and a fixed seed if the provider supports it) for the summary path.
- The summary content is derived primarily from the alerts in the window (counts, severities, top alerts), not from free narration. Non-deterministic prose (e.g. varying "forecast risk" sentences) must be removed or templated.

### R3 — Voltage limits use the dataset's own per-bus limits
- Replace the global `config.V_PU_MIN` / `config.V_PU_MAX` voltage check with each bus's `min_v_pu` / `max_v_pu` from `buses.csv`.
- A bus is "out of band" only when its `vm_pu` is outside its own limits (this dataset uses 0.8–1.2).
- One single function computes voltage violations and is reused by state, alerts, KPI counts and the chat tool, so all counts match.

### R4 — Loading risk labelling
- A branch/transformer is only flagged as a risk/overload when `loading_percent` exceeds its threshold (line 80%, trafo 90%).
- The binding (most-loaded) element below threshold must be described as "most loaded, within limits", never as an overload or risk.

### R5 — Topology tool exposed to the assistant
- Expose the existing `grid/topology.py` as an LLM tool `get_connections(bus)` returning the neighbouring buses and branch names.
- "What is bus_003 connected to?" must be answerable.

### R6 — Demo playback (24h / 48h)
- Add a backend endpoint that returns an ordered list of consecutive snapshot datetimes for a curated window (length 24 or 48 h).
- Pick "good" windows programmatically: rank candidate windows by activity (max line loading, number of alerts) and expose 1–2 presets.
- The frontend can step/play through these datetimes; each step refreshes state, alerts and map.

### R7 — Map presentation
- Render a background map behind the grid so it is easier to read; the view must be zoomable/pannable.
- Node icons follow the existing `grid_pulse_city_demo.html` visual language: shape/icon differs by energy-source type (solar, wind, hydro, gas, biomass, storage, import, load), size scales with power output, so type and magnitude are readable at a glance.
- Show regions (r1/r2/r3) and their borders/inter-region tie-lines (neighbours). Use dataset fields currently unused (e.g. generator type, region, branch capacity) to drive the visuals.

### R8 — Alerts presentation
- Alerts appear as clear notifications and as on-map markers; marker colour/intensity reflects severity (red = highest), sorted worst-first (largest limit exceedance).

### R9 — Alert drill-down
- Selecting an alert returns: the cause/signal that triggered it, plausible reasons, and the recommended immediate fix (reuse the risk sub-agent: `run_n1` + `find_analogues` + `estimate_cost`).

### R10 — 6-hour forecast warning
- Using the day-ahead MW forecast (extend `analysis/forecasts.load_growth`), produce forecast-driven alerts for the next 6 hours (e.g. rising load / falling renewable output pushing an element toward its limit). Historical "similar past hours" may inform it via the existing analogue logic; no external weather API.

## 3. Acceptance criteria

- AC1: At `2024_01_01_18_00_00`, voltage violations = **0** under per-bus limits (today it wrongly reports 118 / 25). KPI tile, alerts panel and chat all report the same count.
- AC2: `GET /summary?datetime=2024_01_01_18_00_00` returns the **same `summary` string** on 3 consecutive calls.
- AC3: The assistant answers "what is bus_003 connected to" with **bus_001, bus_005, bus_012** (branches `001_003_1`, `003_005_1`, `003_012_1`).
- AC4: A 52.72% binding constraint is reported as "within limits", not as a risk/overload.
- AC5: A playback endpoint returns an ordered 24h (and 48h) datetime list; stepping through updates state/alerts/map.
- AC6: Map shows a background, zooms, renders source-type icons sized by output, and draws region borders/tie-lines.
- AC7: On-map alert markers are colour-coded by severity and the list is sorted worst-first.
- AC8: Selecting an alert returns cause + reasons + immediate fix.
- AC9: At a chosen demo hour, at least one forecast alert describes a plausible next-6h risk derived from the DA forecast.
- AC10: `pytest` passes, including updated voltage-limit and topology-tool tests; the mock-provider test still runs with no API key.

## 4. Implementation steps

1. Add a `voltage_violations(net, buses)` helper using per-bus `min_v_pu`/`max_v_pu`; replace global-threshold checks in `grid/state.py` and `analysis/alerts.py`. Update KPI/count paths to call it. (R3, AC1)
2. Update loading risk labelling in `analysis/alerts.py` / `grid/state.py`: only flag above 80%/90%; label sub-threshold binding constraint as "within limits". (R4, AC4)
3. Expose `get_connections(bus)` in `llm/tools.py` wired to `grid/topology.py`; add to the tool registry and tests. (R5, AC3)
4. Make `shift_summary` deterministic: set `temperature=0` in `llm/provider.py`, template the summary around alert facts in `llm/orchestrator.py`, remove free-form sentences. (R2, AC2)
5. Inject current state + alerts + glossary into the chat/summary system prompt in `llm/orchestrator.py`. (R1)
6. Add forecast alerts for the next 6h in `analysis/forecasts.py` + `analysis/alerts.py` using `load_growth`. (R10, AC9)
7. Add a playback endpoint in `main.py` (e.g. `/playback?hours=24|48`) backed by a window-ranking helper (max loading / alert count). (R6, AC5)
8. Frontend `GridMap.tsx`: add background layer, zoom/pan, source-type icons sized by output, region borders/tie-lines, severity-coloured alert markers. (R7, R8, AC6, AC7)
9. Frontend `AlertsPanel.tsx`: worst-first sort, click-to-detail calling the alert drill-down. (R8, R9, AC7, AC8)
10. Frontend `AiSummary.tsx`: render the deterministic summary; playback controls wired to the new endpoint.
11. Update/extend `backend/tests/` for R3, R5, R2; keep the mock-provider test. (AC10)

## 5. Files to inspect / modify

- `backend/app/config.py` — voltage limit constants (move to per-bus; keep loading thresholds).
- `backend/app/grid/state.py` — `in_band` logic (line ~91), `worst_voltage` (line ~117).
- `backend/app/grid/topology.py` — already exists; wrap as a tool.
- `backend/app/analysis/alerts.py` — voltage out-of-band alert (line ~42), loading-risk labelling, add 6h forecast alerts.
- `backend/app/analysis/forecasts.py` — `load_growth`; extend for 6h forecast alerts.
- `backend/app/llm/tools.py` — add `get_connections`; ensure state/alerts tools return structured data.
- `backend/app/llm/orchestrator.py` — `shift_summary` (line ~136), `_summarise` (line ~159); add context injection + determinism.
- `backend/app/llm/provider.py` — set `temperature=0`; mock path stays.
- `backend/app/main.py` — `/summary` (line ~105); add `/playback`.
- `frontend/components/GridMap.tsx`, `AlertsPanel.tsx`, `AiSummary.tsx`, `NodeInspector.tsx`; `frontend/lib/api.ts`, `frontend/lib/types.ts`.
- Reference for icons/visual language: `grid_pulse_city_demo.html` (repo root).
- `backend/tests/test_grid_state.py`, `test_alerts.py`, `test_llm.py`, `test_map.py`.

## 6. Open questions / assumptions

- Assumption: voltage band = each bus's `min_v_pu`/`max_v_pu` (0.8–1.2). If a tighter operational band is wanted for the demo, it must be a config option, defaulting to the dataset limits.
- Assumption: loading thresholds are line 80% / transformer 90% (from existing config); confirm before changing alert volume.
- Assumption: "based on history in recent years" maps to the existing analogue/`find_analogues` logic over this single year of data; no extra years are available in the dataset.
- Open: which one or two 24h/48h windows are the canonical demo presets (auto-rank, then a human picks the final one).
- Open: map background source (static image vs schematic). Coordinates are schematic layout, not geographic, so a stylised background is assumed, consistent with `grid_pulse_city_demo.html`.
- Constraint: no external weather/satellite API and no database; forecasts come only from the dataset's DA files, results served from JSON/in-memory.
