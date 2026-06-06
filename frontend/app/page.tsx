"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useState } from "react"

import AiSummary from "@/components/AiSummary"
import AlertAnnouncement from "@/components/AlertAnnouncement"
import AlertDetail from "@/components/AlertDetail"
import AlertsPanel from "@/components/AlertsPanel"
import ChatBox from "@/components/ChatBox"
import IncidentReport from "@/components/IncidentReport"
import KpiTiles from "@/components/KpiTiles"
import Modal from "@/components/Modal"
import NodeInspector from "@/components/NodeInspector"
import PlaybackControls from "@/components/PlaybackControls"
import { fetchAlerts, fetchMap, fetchState, fetchSummary, logDecision, runPlaybook } from "@/lib/api"
import type {
  Alert,
  AlertsPayload,
  DayBundle,
  GridMapData,
  GridState,
  MapNode,
  PlaybookResult,
} from "@/lib/types"

const DEFAULT_DATETIME = "2024_01_01_18_00_00"

const GridMap = dynamic(() => import("@/components/GridMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg border border-slate-600 bg-slate-800">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
      <p className="text-sm text-slate-300">Loading map…</p>
    </div>
  )
})

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
  const [loading, setLoading] = useState(true)

  // Playback state
  const [playbackActive, setPlaybackActive] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  // Alert detail modal
  const [detailAlert, setDetailAlert] = useState<Alert | null>(null)

  // Announcement overlay (HIGH/CRITICAL during playback)
  const [announcementAlert, setAnnouncementAlert] = useState<Alert | null>(null)

  // Incident report
  const [incidentReport, setIncidentReport] = useState<PlaybookResult | null>(null)
  const [playbookLoading, setPlaybookLoading] = useState(false)

  // Shift summary modal
  const [showSummary, setShowSummary] = useState(false)
  const [summaryText, setSummaryText] = useState("")

  // Fetch live data when not in playback mode — state first so KPIs appear quickly.
  const loadLiveData = useCallback(async (dt: string) => {
    setLoading(true)
    setError(null)
    setState(null)
    setMap(null)
    setAlerts(null)

    try {
      const s = await fetchState(dt)
      setState(s)

      const [m, a] = await Promise.all([fetchMap(dt), fetchAlerts(dt)])
      setMap(m)
      setAlerts(a)
      setSelected((prev) => (prev ? m.nodes.find((n) => n.bus_name === prev.bus_name) ?? null : null))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setState(null)
      setMap(null)
      setAlerts(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (playbackActive) return
    loadLiveData(datetime)
  }, [datetime, playbackActive, loadLiveData])

  // Playback hour change handler
  const handleHourChange = useCallback((bundle: DayBundle, hourIndex: number) => {
    setPlaybackActive(true)
    const hour = bundle.hours[hourIndex]
    if (!hour) return
    setState(hour.state as GridState)
    setAlerts(hour.alerts as AlertsPayload)
    setDatetime(hour.datetime)
    // Map data comes from the hour's state — we reuse the same map structure
    // but update based on the hour. For playback we'll fetch map data separately
    // if needed, or use a simplified approach
    fetchMap(hour.datetime)
      .then((m) => {
        setMap(m)
        setSelected((prev) => (prev ? m.nodes.find((n) => n.bus_name === prev.bus_name) ?? null : null))
      })
      .catch(() => {})
  }, [])

  // Auto-pause on HIGH/CRITICAL
  const handlePause = useCallback((_bundle: DayBundle, hourIndex: number) => {
    const hour = _bundle.hours[hourIndex]
    if (!hour) return
    const critAlerts = hour.alerts.alerts.filter(
      (a) => a.severity === "HIGH" || a.severity === "CRITICAL"
    )
    if (critAlerts.length > 0) {
      // Show the worst alert as announcement
      const worst = critAlerts.sort((a, b) => {
        const w: Record<string, number> = { CRITICAL: 2, HIGH: 1 }
        return (w[b.severity] ?? 0) - (w[a.severity] ?? 0)
      })[0]
      setAnnouncementAlert(worst)
    }
  }, [])

  // Playback complete
  const handleComplete = useCallback((bundle: DayBundle) => {
    const end = bundle.hours[bundle.hours.length - 1]?.datetime ?? datetime
    fetchSummary(end)
      .then((summary) => setSummaryText(summary.summary))
      .catch(() => setSummaryText(bundle.summary))
      .finally(() => setShowSummary(true))
  }, [datetime])

  // Approve from announcement — run playbook
  const handleApprove = async () => {
    if (!announcementAlert) return
    const alert = announcementAlert
    setPlaybookLoading(true)
    setAnnouncementAlert(null)
    try {
      await logDecision(alert.element, datetime, "approved_investigate", alert.action).catch(() => undefined)
      const result = await runPlaybook(alert.element, datetime)
      setIncidentReport(result)
    } catch (e) {
      setError(`Playbook failed: ${e}`)
    } finally {
      setPlaybookLoading(false)
    }
  }

  // Disapprove: log the acknowledgement (no action), then resume
  const handleDismiss = () => {
    if (announcementAlert) {
      logDecision(
        announcementAlert.element,
        datetime,
        "acknowledged_no_action",
        announcementAlert.action
      ).catch(() => {})
    }
    setAnnouncementAlert(null)
    setIsPaused(false)
  }

  // Close incident report and resume
  const handleCloseReport = () => {
    setIncidentReport(null)
    setIsPaused(false)
  }

  return (
    <main className="min-h-screen p-4 space-y-4">
      {/* Announcement overlay */}
      {announcementAlert && (
        <AlertAnnouncement
          alert={announcementAlert}
          onApprove={handleApprove}
          onDismiss={handleDismiss}
        />
      )}

      {/* Incident report modal */}
      {incidentReport && (
        <IncidentReport result={incidentReport} onClose={handleCloseReport} />
      )}

      {/* Alert detail modal */}
      {detailAlert && (
        <AlertDetail
          alert={detailAlert}
          datetime={datetime}
          onClose={() => setDetailAlert(null)}
        />
      )}

      {/* Shift summary modal */}
      <Modal isOpen={showSummary} onClose={() => setShowSummary(false)} title="Shift summary">
        <p className="text-sm text-slate-300 whitespace-pre-wrap">{summaryText}</p>
      </Modal>

      {/* Header */}
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-100">Grid Pulse</h1>
            {state && !loading && (
              <span className="rounded-full border border-emerald-700/60 bg-emerald-950/50 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                Live · {state.total_load_mw.toLocaleString("en-GB", { maximumFractionDigits: 0 })} MW
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">IEEE-118 CEPS grid · dispatcher view</p>
        </div>
        <div className="flex items-center gap-4">
          <PlaybackControls
            onHourChange={handleHourChange}
            onPause={handlePause}
            onComplete={handleComplete}
            onLiveMode={() => {
              setPlaybackActive(false)
              setIsPaused(false)
              loadLiveData(datetime)
            }}
            isPaused={isPaused}
            setIsPaused={setIsPaused}
          />
          {!playbackActive && (
            <input
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              className="rounded bg-grid-panel border border-grid-edge px-2 py-1 text-sm"
            />
          )}
        </div>
      </header>

      {loading && !playbackActive && (
        <div className="rounded-lg border border-cyan-800/50 bg-cyan-950/30 px-4 py-2 text-sm text-cyan-200">
          Loading grid state from backend… (first load can take 10–30 seconds)
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          <p className="font-medium">Cannot load grid data</p>
          <p className="mt-1 text-red-300/90">{error}</p>
          <p className="mt-2 text-xs text-red-300/70">
            Ensure the backend is running on port 8000, then refresh. Type <strong>run</strong> in chat to start both servers.
          </p>
          <button
            type="button"
            onClick={() => loadLiveData(datetime)}
            className="mt-2 rounded bg-red-800/60 px-3 py-1 text-xs text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {playbookLoading && (
        <div className="text-sm text-amber-300 animate-pulse">
          Running playbook analysis...
        </div>
      )}

      <KpiTiles state={state} loading={loading && !playbackActive} />

      {/* Main layout: map + side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 h-[min(72vh,760px)] min-h-[480px]">
          <GridMap
            data={map}
            selected={selected?.bus_name ?? null}
            onSelect={setSelected}
            alerts={alerts?.alerts}
          />
        </div>
        <div className="space-y-4">
          <Panel title="Node inspector">
            <NodeInspector node={selected} />
          </Panel>
          <Panel title="AI summary">
            <AiSummary datetime={datetime} />
          </Panel>
        </div>
      </div>

      {/* Bottom: alerts (full width) + chat */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Panel title="Alerts">
            <AlertsPanel
              alerts={alerts?.alerts ?? []}
              onAlertClick={setDetailAlert}
            />
          </Panel>
        </div>
        <Panel title="Assistant">
          <ChatBox datetime={datetime} />
        </Panel>
      </div>
    </main>
  )
}
