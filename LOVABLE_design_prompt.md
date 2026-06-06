# Lovable design prompt — Grid Pulse dispatcher dashboard

Build a high-fidelity **UI design (static mockup, placeholder data — no backend)** for **Grid
Pulse**, a control-room decision-support dashboard for an electricity **transmission-grid
dispatcher**. We will use your output as a visual reference to style an existing app, so make it
polished and screenshot-ready, and keep the layout close to the structure below.

## The story we are telling

This is the screen a grid dispatcher watches during a **12-hour shift**. In real life the
department: monitors grid health in real time, reacts to **alerts** when something needs
attention, asks questions to make decisions, and at the **end of each shift hands over to the next
dispatcher** (shifts change twice a day) using a summary of what happened. The design must make it
obvious which features **make the dispatcher's job easier**:

- seeing overall grid health **at a glance**,
- spotting and **prioritising alerts** fast (what is urgent, where, why),
- understanding **why** an alert happened and **what to do right now**,
- a **one-click shift-handover summary** for the next dispatcher,
- an **AI assistant** to ask about the grid in plain language.

Treat the shift-handover summary and the alert workflow as the heroes of the screen — those are
the moments that save the dispatcher time and stress.

## Aesthetic

Professional **dark control-room** theme: deep navy / near-black background, high-contrast text,
calm accent colours, **red reserved for high-severity alerts**. Dense but readable, like a real
operations console. Use **tabular/monospaced numerals** for metrics. Subtle panels/cards with thin
borders. No playful or consumer styling — this is a serious operations tool.

## Layout (keep close to this — it maps onto our build)

- **Top header:** app name "Grid Pulse", subtitle "IEEE-118 ČEPS grid · dispatcher view", a
  date/time selector, and an **"Apply" button** that starts a 24-hour day view.
- **KPI tile row:** total load, total generation, binding constraint (%), N-1 headroom, voltage
  issues. Green = healthy, amber/red = needs attention.
- **Centre — large interactive grid map:** nodes = substations / generators / loads, lines =
  connections. Include a **legend of energy-source types** (solar, wind, hydro, gas, storage,
  import, load) with **distinct icons**, sized by output; consumers vs producers visually
  distinct. Show the **3 regions with borders** and inter-region tie-lines. Alert nodes marked in
  **red by severity**. Include **playback controls** (play/pause + an hour scrubber) for stepping
  through the 24-hour day.
- **Right column:** an **"AI shift summary"** panel (the handover document) with a Generate button;
  below it a **"Node inspector"** that shows details of a selected bus.
- **Bottom-left — "Alerts" panel:** a **prioritised list (worst first)**; each card shows
  severity, location, and is clickable to reveal detail (cause, reasons, recommended fix).
- **Bottom-right — "Assistant":** a chat box, "Ask the dispatcher assistant", with example
  prompts.

## Deliverable

A polished static mockup (realistic placeholder values, no real backend) that we can screenshot
and hand to engineering as the visual reference. Emphasise the "makes their job easier" moments:
the shift-summary panel, the at-a-glance KPI health row, the prioritised alert cards, and the
assistant. Show one example alert in its expanded (cause + fix) state so that workflow is visible.
