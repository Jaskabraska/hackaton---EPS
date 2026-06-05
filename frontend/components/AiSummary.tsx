"use client"

import { useState } from "react"

import { fetchSummary } from "@/lib/api"
import type { ShiftSummary } from "@/lib/types"

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
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold">AI shift summary</span>
        <button
          onClick={run}
          className="text-xs rounded bg-emerald-600 hover:bg-emerald-500 px-2 py-1 text-white"
        >
          {loading ? "Working…" : "Generate"}
        </button>
      </div>
      {summary ? (
        <div className="text-sm text-slate-200 whitespace-pre-wrap">{summary.summary}</div>
      ) : error ? (
        <div className="text-xs text-rose-300">{error}</div>
      ) : (
        <div className="text-xs text-slate-400">
          Generates a deterministic 12-hour handover from the gathered alerts.
        </div>
      )}
    </div>
  )
}
