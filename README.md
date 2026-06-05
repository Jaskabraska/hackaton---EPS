# Hackathon — EPS (Grid Pulse Challenge 2026)

A hackathon project built on the ČEPS / IEEE-118 power grid dataset for the **Grid Pulse Challenge 2026**.

## Goal

Build an application with a chatbot on top of hourly power grid data that lets users discover:
- the current state of the grid
- overloads and branch loading
- inter-regional flows
- N-1 contingency impacts
- forecast-based outlook (day-ahead loads, renewable generation, planned outages)

## Repository contents

| Path | Description |
|------|-------------|
| `greenhack-2026-ČEPS-dataset/` | The full dataset provided by ČEPS for the hackathon |
| `Grid Pulse Challenge(1).pdf` | Official challenge brief |

## Dataset overview

Hourly data from the IEEE-118 bus system for a full year (8 760 snapshots).  
Each snapshot is a solved load flow in [pandapower](https://www.pandapower.org/).

Sub-folders inside the dataset:

- `static/` — fixed network description (buses, lines, transformers, generators, regions, coordinates)
- `snapshots/` — pandapower JSON files, one per hour (`YYYY_MM_DD_HH_MM_SS.json`)
- `realtime/` — flat CSV time series (hourly load and generation)
- `forecasts/` — day-ahead forecasts: load per region, renewable generation, planned outages
- `other/` — fuel prices by type and region (monthly resolution)

See `greenhack-2026-ČEPS-dataset/greenhack-2026-ČEPS-dataset/convention.md` for full column descriptions.

## Quick start

```python
import pandapower as pp

net = pp.from_json("greenhack-2026-ČEPS-dataset/greenhack-2026-ČEPS-dataset/snapshots/2024_07_01_18_00_00.json")
net.res_line.loading_percent   # branch loading (already computed)
net.res_bus.vm_pu              # bus voltages
pp.runpp(net)                  # recompute after modifying the network
```

## Licence

The dataset is derived from [evgenytsydenov/ieee118_power_flow_data](https://github.com/evgenytsydenov/ieee118_power_flow_data)
and is licensed under **[CC-BY-NC-SA 4.0](http://creativecommons.org/licenses/by-nc-sa/4.0/)** — non-commercial use, derivative works under the same licence.
