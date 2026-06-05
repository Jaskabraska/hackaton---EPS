# Grid Pulse — Hackathon EPS 2026

An AI-powered power grid monitoring and dispatch assistant built for the **Grid Pulse Challenge 2026** (ČEPS / IEEE-118 dataset).

The core idea: **the LLM does not compute physics — it picks the right tool and explains the result. Numbers come from pandapower.**

## Architecture (MVP stack)

| Layer | Tool | Purpose |
|-------|------|---------|
| Physics | **pandapower** | Load flow, N-1 contingency analysis |
| History | **DuckDB over Parquet** | Fast queries across a full year of snapshots |
| Analogy | **FAISS** (feature vectors) | "Last time a similar hour occurred → this happened" |
| Brain | **LLM via API** (Claude/GPT) + tool-calling | Dispatcher query → tool → explanation |
| UI | **HTML map** + alerts | Visual for the jury |

Backend = single **FastAPI** file. No model training. Domain glossary injected as JSON into the prompt.

## Repository contents

| File / folder | Description |
|---------------|-------------|
| `Grid Pulse Challenge(1).pdf` | Official challenge brief |
| `Grid_Pulse_MVP_plan.md` | MVP plan — maximum value, minimum time |
| `Grid_Pulse_koncept.md` | Full application concept (physics explanation, demo scenario) |
| `grid_pulse_city_demo.html` | Interactive dispatch mockup (city map + alerts + AI summary) |
| `grid_pulse_map.html` | Grid map view |
| `grid_state.json` | Example network state snapshot |
| `alerts.json` | Example alerts with AI recommendations |
| `.gitignore` | Excludes the local ČEPS dataset folder (too large for GitHub) |

> The `greenhack-2026-ČEPS-dataset/` folder is intentionally excluded from this repository (8 760 hourly pandapower JSON snapshots).

## Demo scenario (for the jury)

Winter peak → alert "transformer at 91 %, N-1 risk" → dispatcher triggers analysis → agent uses pandapower to compute N-1 + finds analogous historical hours via FAISS → AI recommends a specific redispatch action backed by data and priced in CZK → end-of-shift summary for the next dispatcher.

## Getting started (once backend is wired)

```python
import pandapower as pp

net = pp.from_json("path/to/snapshots/2024_07_01_18_00_00.json")
net.res_line.loading_percent   # branch loading (already computed)
net.res_bus.vm_pu              # bus voltages
pp.runpp(net)                  # recompute after modifying the network
```

## Dataset licence

The ČEPS dataset is derived from [evgenytsydenov/ieee118_power_flow_data](https://github.com/evgenytsydenov/ieee118_power_flow_data)
and licensed under **[CC-BY-NC-SA 4.0](http://creativecommons.org/licenses/by-nc-sa/4.0/)** — non-commercial use, derivative works under the same licence.
