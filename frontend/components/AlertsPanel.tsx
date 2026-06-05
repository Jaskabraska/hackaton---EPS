"use client"

import { useMemo } from "react"

import type { Alert } from "@/lib/types"

const severityColour: Record<Alert["severity"], string> = {
  LOW: "border-slate-500 text-slate-300",
  MEDIUM: "border-amber-500 text-amber-300",
  HIGH: "border-orange-500 text-orange-300",
  CRITICAL: "border-red-500 text-red-300",
}

const SEVERITY_WEIGHT: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
}

export default function AlertsPanel({
  alerts,
  onAlertClick,
}: {
  alerts: Alert[]
  onAlertClick?: (alert: Alert) => void
}) {
  const sorted = useMemo(() => {
    return [...alerts].sort((a, b) => {
      const wa = SEVERITY_WEIGHT[a.severity] ?? 0
      const wb = SEVERITY_WEIGHT[b.severity] ?? 0
      return wb - wa
    })
  }, [alerts])

  if (!sorted.length)
    return <div className="text-sm text-slate-400">No active alerts for this hour.</div>

  return (
    <div className="space-y-2 max-h-[300px] overflow-y-auto">
      {sorted.map((a) => (
        <div
          key={a.id}
          className={`rounded-md border-l-4 bg-grid-panel px-3 py-2 ${severityColour[a.severity]} ${
            onAlertClick ? "cursor-pointer hover:bg-grid-edge/40" : ""
          }`}
          onClick={() => onAlertClick?.(a)}
        >
          <div className="flex justify-between items-center">
            <span className="text-xs uppercase tracking-wide">{a.severity}</span>
            <span className="text-xs text-slate-500">{a.element}</span>
          </div>
          <div className="text-sm text-slate-100 mt-1">{a.title}</div>
          <div className="text-xs text-slate-400 mt-1">{a.action}</div>
        </div>
      ))}
    </div>
  )
}
