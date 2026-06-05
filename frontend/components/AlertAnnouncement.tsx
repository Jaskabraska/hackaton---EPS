"use client"

import type { Alert } from "@/lib/types"

const SEVERITY_BG: Record<string, string> = {
  HIGH: "border-orange-500 bg-orange-500/10",
  CRITICAL: "border-red-500 bg-red-500/10",
}

const SEVERITY_TEXT: Record<string, string> = {
  HIGH: "text-orange-400",
  CRITICAL: "text-red-400",
}

type Props = {
  alert: Alert
  onApprove: () => void
  onDismiss: () => void
}

export default function AlertAnnouncement({ alert, onApprove, onDismiss }: Props) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" />
      <div
        className={`relative rounded-xl border-2 shadow-2xl max-w-lg w-full p-8 ${
          SEVERITY_BG[alert.severity] ?? "border-grid-edge bg-grid-panel"
        }`}
      >
        <div className="text-center space-y-5">
          <div
            className={`text-3xl font-bold uppercase tracking-wider ${
              SEVERITY_TEXT[alert.severity] ?? "text-slate-200"
            }`}
          >
            {alert.severity} alert
          </div>

          <div className="text-lg font-semibold text-slate-100">{alert.element}</div>

          <p className="text-sm text-slate-300 leading-relaxed">{alert.what}</p>

          <div className="flex justify-center gap-4 pt-4">
            <button
              onClick={onApprove}
              className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white shadow-lg"
            >
              Investigate
            </button>
            <button
              onClick={onDismiss}
              className="px-6 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold text-slate-200 shadow-lg"
            >
              Acknowledge
            </button>
          </div>

          <p className="text-xs text-slate-500">
            Playback is paused. Choose an action to continue.
          </p>
        </div>
      </div>
    </div>
  )
}
