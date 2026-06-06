"use client"

import { useState } from "react"

import { fetchSummary } from "@/lib/api"
import type { ShiftSummary } from "@/lib/types"

// Event datetimes arrive as snapshot stems: "YYYY_MM_DD_HH_MM_SS".
function clockFromStem(stem: string): string {
  const parts = stem.split("_")
  return parts.length >= 5 ? `${parts[3]}:${parts[4]}` : stem
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-grid-raised/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold text-slate-100 tabular-nums">{value}</div>
    </div>
  )
}

export default function AiSummary({ datetime }: { datetime: string }) {
  const [summary, setSummary] = useState<ShiftSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      setSummary(await fetchSummary(datetime))
    } catch (err) {
      setSummary(null)
      setError(err instanceof Error ? err.message : "Summary generation failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-3 py-3">
      <div className="flex items-center justify-between">
        <span className="panel-title">AI shift summary</span>
        <button
          onClick={run}
          disabled={loading}
          className="rounded-md bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-white hover:bg-accent-soft/80 disabled:opacity-50"
        >
          {loading ? "Working…" : "Generate"}
        </button>
      </div>

      {summary ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg border border-grid-edge bg-grid-bg/50 p-3 text-sm text-slate-200 whitespace-pre-wrap">
            {summary.summary}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Metric label="Alerts in window" value={`${summary.alert_count}`} />
            <Metric label="Hourly events" value={`${summary.events.length}`} />
          </div>

          {summary.events.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11px] uppercase tracking-wide text-slate-500">Open items this shift</div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {summary.events.map((ev) => (
                  <div key={ev.datetime} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 font-mono text-slate-500">{clockFromStem(ev.datetime)}</span>
                    <span className="text-slate-300">{ev.top.join(" · ") || `${ev.alert_count} alerts`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : error ? (
        <div className="mt-3 text-xs text-rose-300">{error}</div>
      ) : (
        <div className="mt-3 text-xs text-slate-500">
          Generates a deterministic 12-hour handover from the gathered alerts and events.
        </div>
      )}
    </div>
  )
}
