# Phase 2 prompt — Grid Pulse (audit & complete, do NOT recreate)

You are continuing the **Grid Pulse** project in the `hackathon` repo. **A large part of Phase 2
is already implemented and committed** — including the 24-hour playback, the big-screen
alert announcement (Investigate / Acknowledge), auto-pause on alert, the incident-report view with
the numbered playbook steps, the approve/disapprove flow, the alerts panel, and the AI shift
summary. **Do NOT rebuild or rewrite working code.**

## Ground rules (read first)

1. **Audit before you touch anything.** Run the app and `pytest`, then for each task below state
   whether it is already satisfied, partially done, or missing. Only change what is broken or
   missing.
2. **Do not recreate** components/endpoints that already exist and work — extend them in place.
3. The tasks below are a **checklist to verify and complete**, not a from-scratch build.
4. **Known-broken (highest priority):** Task 8 (N-1 classification — produces bogus "loss of supply
   to 0 buses" alerts) and Task 7 (shift summary uses wrong windows + generic content). These are
   the main things to fix.
5. **Likely already done** (confirm, don't redo): playback + Apply, big-screen announcement +
   auto-pause + resume, incident report + playbook steps, approve/disapprove. Only fix gaps.
6. **Most likely still missing/partial:** the map overhaul (Task 2 — source-type icons, regions,
   background, zoom) and panel width (Task 6). Verify against the current UI before building.
7. Do **functional** work and **data-driven visuals**; leave final theme/colours/polish to the
   later Lovable design pass.

First read `SPEC_backend_demo.md`, `Grid_Pulse_MVP_plan.md`, and `grid_pulse_city_demo.html` in
the repo root, and inspect the existing `backend/app/**` and `frontend/**` to see what is built.

## Full context — what this is

Grid Pulse is a decision-support dashboard for an electricity transmission-grid dispatcher,
built on the IEEE-118 ČEPS hackathon dataset: 118 buses, 3 regions (r1/r2/r3), 186 branches,
321 generators, 8760 hourly **solved load-flow snapshots** (pandapower), day-ahead MW forecasts
(load per region, solar/wind per generator) and monthly fuel prices. Stack: backend = Python +
FastAPI + pandapower; frontend = Next.js + TypeScript + Tailwind.

Coding rules: TypeScript with **no semicolons**, use **fetch** (not axios), **date-fns** for
dates, **British spelling**, **sentence case** in UI text.

## What is already done (Phase 1 — keep intact, do not redo)

- Per-bus voltage limits read from `buses.csv` (`min_vm_pu`/`max_vm_pu`); correct violation
  counts (0 at peak hour, previously a false 118). One shared violation function is reused by
  state, alerts, KPI counts and the chat tool, so all counts agree.
- Honest loading labels: a branch/trafo is only a risk when loading > 80% (line) / 90% (trafo);
  the most-loaded element below threshold is described as "within limits".
- `get_connections(bus)` LLM tool wired to `grid/topology.py`.
- Deterministic shift summary (`temperature=0`, `seed=7`, plus a per-(datetime, window_h) cache
  giving byte-identical output) grounded in the alerts; chat is grounded with a state + alerts
  context block plus `glossary.json`.
- 6-hour forecast "watch" alert based on **day-ahead load growth** (`FORECAST_WATCH_RATIO=1.10`),
  because branch loadings never exceed ~62% in this dataset so an 80%-loading forecast could
  never fire.
- Endpoints: `GET /state`, `/alerts`, `/n1`, `/assess` (alert cause + reasons + fix via
  `run_n1` + `find_analogues` + `estimate_cost`), `/summary`, `/playback?hours=24|48&start=`,
  `POST /chat`, `/apply`. Tests: 35 passing; the mock LLM provider runs with no API key.

## Known issue to fix first (Phase 1 cleanup)

The forecast alert and shift summary currently **dramatize ~50% loading as a risk** (e.g.
"forecast to reach 53% within 6 hours … mitigation recommended"). 50% loading is healthy and this
contradicts the honest-labelling fix. **Fix the wording** so it states the real signal it actually
computed (e.g. "total load forecast +15% over 6 h") and never describes sub-80% loading as a risk
needing mitigation. Files: `analysis/alerts.py`, `llm/orchestrator.py` (summary templating).

## Tasks

### 1. Live day playback (headline demo feature)
- Default demo day = **2024-02-17**, 24 hours (peak loadings; contains the forecast alert).
- Header gets an **"Apply" button** that starts the 24-hour day view on the map.
- Backend: add a precompute that builds the **whole day as a single JSON bundle** — per-hour
  state + alerts + **per-hour N-1 result** (worst contingency and any element it pushes over a
  limit), plus the end-of-shift AI summary — written to `output/`. Expose it
  (e.g. `GET /day?date=2024_02_17`) and cache it. Goal: during the demo, playback runs from the
  precomputed bundle with **no live pandapower or LLM calls** (instant, reliable, offline-safe).
  The N-1 computation must **handle divergence/islanding**: when a trip disconnects buses, report
  it as "loss of supply to N buses", not "inf% loading".
- Frontend: Apply → fetch the bundle → play/step through the 24 hours on a timer; each hour
  updates the map, alerts panel and KPI tiles. Show the AI shift summary at the end of the day.
  Include play/pause and an hour scrubber. **Playback auto-pauses when a HIGH/CRITICAL alert fires
  (see Task 5) and resumes after the dispatcher acts.** (`main.py`, new `analysis/day_bundle.py`,
  `frontend/app/page.tsx`, `frontend/lib/api.ts`, `AiSummary.tsx`.)

### 2. Map overhaul (data-driven; final theme applied later)
- Add a stylised background behind the grid (coordinates are schematic, not geographic — use a
  stylised backdrop consistent with `grid_pulse_city_demo.html`); make the view zoomable/pannable.
- Node icons differ by **energy-source type** (solar, wind, hydro, gas, biomass, storage, import,
  load) using the shapes from `grid_pulse_city_demo.html`; **size scales with power output**.
  Distinguish consumers (consume only) from producers/prosumers by shape/state, not size alone.
- Draw the 3 **regions** with borders and the **inter-region tie-lines** (neighbours).
- Use dataset fields currently unused (generator type, region, branch capacity/loading).
  (`frontend/components/GridMap.tsx`, `frontend/lib/types.ts`.)

### 3. Alerts on map + panel
- On-map alert **markers colour-coded by severity** (red = highest); alert list **sorted
  worst-first** (largest limit exceedance).
- Selecting an alert opens a **detail view**: cause/trigger, plausible reasons, recommended
  immediate fix — wired to `/assess`. (`GridMap.tsx`, `AlertsPanel.tsx`, a detail component.)

### 4. N-1 contingency (drives the automatic alert in Task 5)
- N-1 runs automatically per hour as part of the day bundle (Task 1). It must handle
  divergence/islanding gracefully (report "loss of supply to N buses", not garbage loading).
- A manual `/n1` trigger may also remain for ad-hoc checks, but the demo's headline moment is the
  **automatic** N-1 alert at 2024-02-17 19:00 (see Task 5), not a manual click.

### 5. Alert approval workflow with a pre-approved playbook (human-in-the-loop) — high priority
This is the headline interaction. When an alert fires the dispatcher is prompted to approve, and
on approval the AI runs a **fixed, pre-defined sequence of steps** (a "playbook"). Every number
must come from a tool call; the AI orchestrates and explains, it does not invent figures.

- **Severity tiers (already in the backend):** CRITICAL (element over limit, e.g. an N-1
  overload), HIGH (loading forecast/at >80%), MEDIUM (voltage out of band, forecast "watch" when
  day-ahead load grows >=10%). Note: on this dataset natural loadings stay <=~62% and voltage is
  in band, so HIGH/CRITICAL almost never occur spontaneously — they appear mainly from a triggered
  N-1.
- **Announcement (high-impact only):** when a **HIGH or CRITICAL** alert appears, show a prominent
  **big-screen announcement / blocking banner** stating there is an alert (element, severity,
  location). It stays until the dispatcher acts. **MEDIUM alerts do NOT take over the screen** —
  they go to the alert list only.
- **Automatic N-1 monitoring (no manual query):** at every playback hour the app checks N-1 from
  the precomputed day bundle. If losing a single element would push another element over its limit,
  an alert is **raised automatically** — the dispatcher must NOT have to ask the AI. Alert wording:
  "At HH:00 the grid is N-1 at risk: if <tripped element> trips, <affected element> would rise to
  X% (over its limit)."
- **Scripted demo scenario (verified real, do not fake):** day = **2024-02-17**. At **19:00** the
  N-1 check finds that tripping **`branch_025_027_1`** pushes a neighbouring line to **~83%**
  (over the 80% line limit) → a **HIGH** alert. (Verified: this is the strongest real N-1 alert in
  the whole year; even the annual peak-load hour only reaches ~76% under N-1, so 2024-02-17 is the
  correct demo day.) The alert names the actually-affected element from the computation.
- **Playback auto-pauses** the moment this HIGH/CRITICAL alert fires, and the big-screen
  announcement appears.
- **Decision:** the dispatcher clicks **Approve** or **Disapprove**.
  - **Disapprove** → dismiss the announcement and log it as "acknowledged, no action". Nothing runs.
  - **Approve** → this is the human-in-the-loop signal; the AI proceeds with the playbook.
- **Pre-approved playbook (run in order, each step grounded in a tool):**
  1. **Assess the situation** — the triggering element, its loading/voltage vs its own limit, the
     region, and current total load / generation / regional balance. (`/state`)
  2. **Risk to the rest of the grid (N-1)** — trip the alerted element and key neighbours,
     recompute, and report anything pushed over a limit and which other lines/regions are
     affected. (`/n1`)
  3. **What is likely next** — historical analogues: similar past hours and what happened in the
     following hours. (`find_analogues`)
  4. **Options / remedies (ranked, with reasoning)** — redispatch (ramp a generator in the surplus
     region), reroute via an alternative corridor / tie-line, demand response, BESS discharge, or
     curtailment; ranked by feasibility and cost. (`estimate_cost`)
  5. **Immediate recommended action** — the single best next step, its expected effect (e.g.
     element loading X% → Y%), and cost in Kč.
  6. **Forward-looking guidance** — what to do over the next few hours given the day-ahead
     forecast (pre-arrange reserves, watch the evening peak, etc.).
  7. **Log the decision** — who approved, when, and what was recommended (incident record written
     to `output/`).
- **Resume:** after the playbook output / AI guidance is shown, **playback resumes** (manually via
  a "continue" button, or automatically after the summary is displayed).
- **Backend:** expose the playbook as one orchestrated call (e.g. `POST /playbook` reusing
  `assess_risk` = `run_n1` + `find_analogues` + `estimate_cost`, gated behind the approve signal
  via the existing `/apply` / `awaiting_approval` pattern). Return a **structured incident report**
  (the six steps above as JSON), written to `output/`.
- **Frontend:** the approval announcement, and after approval an **incident-report view** that
  renders the six steps clearly (not cramped). (`AlertsPanel.tsx`, a new announcement/overlay
  component, `frontend/lib/api.ts`.)

### 6. Alerts + analysis panel sizing
- The current alerts/analysis area is **too narrow to read**. Give the alert detail and the
  incident-report/analysis view **enough width** (a wide side panel or a modal), so the step-by-step
  analysis is comfortably readable. This is a structural layout change (final colours/theme still
  come from the later design pass).

### 7. Shift handover summary — correct windows + real content
- Shifts are **fixed 12-hour windows**: day shift **06:00–18:00** and night shift **18:00–06:00**
  (the night shift crosses midnight). The handover summary must use these boundaries, not an
  arbitrary 12 h ending at the current hour.
- For the demo (2024-02-17), the meaningful handover is the **night shift (18:00 onward)** because
  the headline N-1 incident is at 19:00 and must appear in that shift's summary. The day shift
  (06:00–18:00) will legitimately be quiet. For the single-day bundle, summarising 18:00 → end of
  the loaded day is enough to capture the 19:00 event (full cross-midnight handling optional).
- Build the summary from the **actual alerts and approved playbook decisions** in the window: list
  incidents (time, element, severity), the dispatcher's approve/disapprove decision and the
  recommended/taken action, top constraints, and the forward risk for the next shift. Never emit
  "no incidents" when incidents exist.
- Keep it deterministic (temperature 0 + cache) and grounded (numbers from tools/alerts).
- Files: `llm/orchestrator.py` (shift-window logic + templating), `main.py` (`/summary` window
  params), `config.py` (shift boundaries).

### 8. N-1 classification fix (correctness — do this early)
Currently the N-1 mislabels numerical non-convergence as "loss of supply to 0 buses" and marks it
CRITICAL, so nearly every hour shows the same bogus alert at 0% loading. Verified ground truth at
2024_02_17_19_00_00: tripping `branch_002_012_1` DIVERGES with 0 isolated buses (not a real
outage); tripping `branch_025_027_1` CONVERGES at 82.5% (the real alert).

For each single-element trip, classify into exactly one outcome:
1. **Islanding** — only when `pandapower.topology.unsupplied_buses(net)` returns >0 buses → "loss
   of supply to N buses" (N>0). Never report "0 buses".
2. **Overload** — `runpp` converges and max loading > limit → report the real loading % + element.
3. **Secure** — converges and within limits.
4. **Non-convergence** — does not converge AND 0 isolated buses → first RETRY `runpp` with
   `init="dc"` (and a Gauss–Seidel fallback); if it still fails, label it "load flow did not
   converge — possible instability, flagged for study". Do NOT call it loss of supply, do NOT make
   it the automatic alert, and do NOT default it to CRITICAL.

The automatic per-hour N-1 alert is driven by the worst **converged overload** (and islanding if
present), never by non-convergence. With this fix the 2024-02-17 19:00 alert is
`branch_025_027_1` at ~82.5% (HIGH), not `branch_002_012_1`. Dedupe persistent contingencies so
the same one is not re-raised every hour as if new.

### 9. Alert frequency — avoid fatigue (the demo should be mostly calm)
An alert firing almost every hour is wrong: this grid is calm (loadings <=~62%, voltage in band),
so most hours should have **no alert**. The day should read as quiet with the **19:00 N-1 event as
the one stand-out moment**.
- After the Task 8 N-1 fix, HIGH/CRITICAL alerts should be rare (essentially just the 19:00 one on
  the demo day).
- **Tune the forecast "watch" (MEDIUM) alert so it does not repeat every hour:** dedupe it so a
  rising-load episode raises **one** alert when it first crosses the threshold, not a new alert each
  hour while load keeps rising. Optionally raise `FORECAST_WATCH_RATIO` and/or require a meaningful
  projected level. Severity stays MEDIUM (never a big-screen takeover).
- Result for 2024-02-17: most hours show no alert; at most a small number of MEDIUM forecast notes
  (e.g. one for the morning ramp, one for the evening ramp); the 19:00 N-1 HIGH alert is the
  headline.

## Acceptance criteria

- "Apply" starts the 2024-02-17 24-hour playback; stepping/playing updates map + alerts + KPIs;
  the AI summary shows at the end of the day; playback runs from the precomputed bundle with no
  live compute.
- Map shows a background, zooms/pans, renders source-type icons sized by output, and draws region
  borders + tie-lines.
- On-map alert markers are severity-coloured; the alert list is worst-first; selecting an alert
  shows cause + reasons + immediate fix from `/assess`.
- The forecast alert and summary never call sub-80% loading a risk; they state the real
  load-growth signal.
- During playback of 2024-02-17, at 19:00 an N-1 alert is raised **automatically** (no user query)
  because tripping `branch_025_027_1` would push a line to ~83%; playback **auto-pauses** and a
  blocking big-screen announcement appears with Approve / Disapprove.
- Approve runs the playbook (situation → N-1 risk to rest of grid → analogues → ranked options →
  immediate action with effect + Kč → forward-looking guidance) and shows a structured incident
  report; the decision is logged to `output/`. Disapprove dismisses and logs acknowledgement with
  no action. After the dispatcher acts, **playback resumes**.
- N-1 handles islanding (reports "loss of supply to N buses", never "inf%"); numerical
  non-convergence is retried (init="dc") and, if still failing, labelled "possible instability",
  never "loss of supply to 0 buses". No alert ever says "0 buses"; worst-loading is the real value,
  never 0%.
- The shift handover summary uses 06:00–18:00 / 18:00–06:00 windows; for 2024-02-17 the night-shift
  summary includes the 19:00 N-1 incident, the approval decision and the recommended action, and
  does not say "no incidents".
- Alerts are NOT raised almost every hour: most hours of 2024-02-17 have no alert; the forecast
  "watch" alert is deduped (one per rising episode, not hourly); the 19:00 N-1 HIGH alert stands
  out as the headline.
- The alert detail / incident-report view is wide enough to read comfortably (not the cramped
  current panel).
- Backend `pytest` still passes; the mock provider still works with no API key.

## Constraints

No external weather/satellite API; no database (file/JSON + in-memory only); reuse
`grid_pulse_city_demo.html` for the icon set; **leave final theme/colours/polish to the later
design pass** — implement structure, data-driven visuals and interactions, not styling polish.
