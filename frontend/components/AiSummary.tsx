"use client"

import { useState } from "react"

import { fetchSummary } from "@/lib/api"
import type { ShiftSummary } from "@/lib/types"

export default function AiSummary({ datetime }: { datetime: string }) {
  const [summary, setSummary] = useState<ShiftSummary | null>(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    try {
      setSummary(await fetchSummary(datetime))
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
      ) : (
        <div className="text-xs text-slate-400">
          Generates a deterministic 12-hour handover from the gathered alerts.
        </div>
      )}
    </div>
  )
}
