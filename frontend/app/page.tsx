"use client"

import { useEffect, useState } from "react"

import AiSummary from "@/components/AiSummary"
import AlertsPanel from "@/components/AlertsPanel"
import ChatBox from "@/components/ChatBox"
import GridMap from "@/components/GridMap"
import KpiTiles from "@/components/KpiTiles"
import NodeInspector from "@/components/NodeInspector"
import { fetchAlerts, fetchMap, fetchState } from "@/lib/api"
import type { AlertsPayload, GridMapData, GridState, MapNode } from "@/lib/types"

const DEFAULT_DATETIME = "2024_01_01_18_00_00"

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg bg-grid-panel/60 border border-grid-edge p-3">
      <h2 className="text-sm font-semibold text-slate-300 mb-2">{title}</h2>
      {children}
    </section>
  )
}

export default function Page() {
  const [datetime, setDatetime] = useState(DEFAULT_DATETIME)
  const [state, setState] = useState<GridState | null>(null)
  const [map, setMap] = useState<GridMapData | null>(null)
  const [alerts, setAlerts] = useState<AlertsPayload | null>(null)
  const [selected, setSelected] = useState<MapNode | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setError(null)
    Promise.all([fetchState(datetime), fetchMap(datetime), fetchAlerts(datetime)])
      .then(([s, m, a]) => {
        if (!active) return
        setState(s)
        setMap(m)
        setAlerts(a)
      })
      .catch((e) => active && setError(String(e)))
    return () => {
      active = false
    }
  }, [datetime])

  return (
    <main className="min-h-screen p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Grid Pulse</h1>
          <p className="text-xs text-slate-400">IEEE-118 ČEPS grid · dispatcher view</p>
        </div>
        <input
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
          className="rounded bg-grid-panel border border-grid-edge px-2 py-1 text-sm"
        />
      </header>

      {error && <div className="text-sm text-red-400">Cannot reach the backend ({error}). Is it running on :8000?</div>}

      <KpiTiles state={state} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-[520px]">
          <GridMap data={map} selected={selected?.bus_name ?? null} onSelect={setSelected} />
        </div>
        <div className="space-y-4">
          <Panel title="AI summary">
            <AiSummary datetime={datetime} />
          </Panel>
          <Panel title="Node inspector">
            <NodeInspector node={selected} />
          </Panel>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Alerts">
          <AlertsPanel alerts={alerts?.alerts ?? []} />
        </Panel>
        <Panel title="Assistant">
          <ChatBox datetime={datetime} />
        </Panel>
      </div>
    </main>
  )
}
