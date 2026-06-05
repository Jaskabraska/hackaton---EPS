"use client"

import { useCallback, useEffect, useState } from "react"

import AiSummary from "@/components/AiSummary"
import AlertAnnouncement from "@/components/AlertAnnouncement"
import AlertDetail from "@/components/AlertDetail"
import AlertsPanel from "@/components/AlertsPanel"
import ChatBox from "@/components/ChatBox"
import GridMap from "@/components/GridMap"
import IncidentReport from "@/components/IncidentReport"
import KpiTiles from "@/components/KpiTiles"
import Modal from "@/components/Modal"
import NodeInspector from "@/components/NodeInspector"
import PlaybackControls from "@/components/PlaybackControls"
import { fetchAlerts, fetchMap, fetchState, runPlaybook } from "@/lib/api"
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

  // Fetch live data when not in playback mode
  useEffect(() => {
    if (playbackActive) return
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
  }, [datetime, playbackActive])

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
    fetchMap(hour.datetime).then(setMap).catch(() => {})
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
    setSummaryText(bundle.summary)
    setShowSummary(true)
  }, [])

  // Approve from announcement — run playbook
  const handleApprove = async () => {
    if (!announcementAlert) return
    setPlaybookLoading(true)
    setAnnouncementAlert(null)
    try {
      const result = await runPlaybook(announcementAlert.element, datetime)
      setIncidentReport(result)
    } catch (e) {
      setError(`Playbook failed: ${e}`)
    } finally {
      setPlaybookLoading(false)
    }
  }

  // Dismiss announcement
  const handleDismiss = () => {
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
          <h1 className="text-2xl font-bold text-slate-100">Grid Pulse</h1>
          <p className="text-xs text-slate-400">IEEE-118 CEPS grid · dispatcher view</p>
        </div>
        <div className="flex items-center gap-4">
          <PlaybackControls
            onHourChange={handleHourChange}
            onPause={handlePause}
            onComplete={handleComplete}
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

      {error && (
        <div className="text-sm text-red-400">
          Cannot reach the backend ({error}). Is it running on :8000?
        </div>
      )}

      {playbookLoading && (
        <div className="text-sm text-amber-300 animate-pulse">
          Running playbook analysis...
        </div>
      )}

      <KpiTiles state={state} />

      {/* Main layout: map + side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 h-[520px]">
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
