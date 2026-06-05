import type { Alert } from "@/lib/types"

const severityColour: Record<Alert["severity"], string> = {
  LOW: "border-slate-500 text-slate-300",
  MEDIUM: "border-amber-500 text-amber-300",
  HIGH: "border-orange-500 text-orange-300",
  CRITICAL: "border-red-500 text-red-300"
}

export default function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length)
    return <div className="text-sm text-slate-400">No active alerts for this hour.</div>
  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <div key={a.id} className={`rounded-md border-l-4 bg-grid-panel px-3 py-2 ${severityColour[a.severity]}`}>
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
