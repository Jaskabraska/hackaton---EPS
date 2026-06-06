"use client"

import { useState } from "react"

import Modal from "@/components/Modal"
import { fetchRiskVerdict } from "@/lib/api"
import type { Alert, RiskVerdict } from "@/lib/types"

const SEVERITY_COLOUR: Record<string, string> = {
  LOW: "text-slate-400",
  MEDIUM: "text-amber-400",
  HIGH: "text-orange-400",
  CRITICAL: "text-red-400",
}

type Props = {
  alert: Alert
  datetime: string
  onClose: () => void
}

export default function AlertDetail({ alert, datetime, onClose }: Props) {
  const [verdict, setVerdict] = useState<RiskVerdict | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAssess = async () => {
    setLoading(true)
    setError(null)
    try {
      const v = await fetchRiskVerdict(alert.element, datetime)
      setVerdict(v)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={`Alert: ${alert.element}`} wide>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold uppercase ${SEVERITY_COLOUR[alert.severity] ?? "text-slate-400"}`}>
            {alert.severity}
          </span>
          <span className="text-xs text-slate-400">{alert.category}</span>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-200 mb-1">What happened</h3>
          <p className="text-sm text-slate-300">{alert.what}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-200 mb-1">Recommended action</h3>
          <p className="text-sm text-slate-300">{alert.action}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-200 mb-1">Impact and risk</h3>
          <p className="text-sm text-slate-300">{alert.impact_risk}</p>
        </div>

        {alert.financial && (
          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">Financial</h3>
            <p className="text-sm text-slate-300">
              Redispatch {String(alert.financial.delta_mw)} MW for {String(alert.financial.hours)} h
              @ {String(alert.financial.price_czk_per_mwh)} Kc/MWh
              = <span className="font-semibold text-amber-300">{Number(alert.financial.intervention_cost_czk).toLocaleString()} Kc</span>
            </p>
          </div>
        )}

        {!verdict && (
          <button
            onClick={handleAssess}
            disabled={loading}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm text-white disabled:opacity-50"
          >
            {loading ? "Assessing..." : "Assess risk (N-1 analysis)"}
          </button>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        {verdict && (
          <div className="border border-grid-edge rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold">Risk verdict:</span>
              <span className={`text-sm font-bold uppercase ${SEVERITY_COLOUR[verdict.verdict] ?? "text-slate-400"}`}>
                {verdict.verdict}
              </span>
              <span className="text-xs text-slate-400">
                N-1 {verdict.n1_secure ? "secure" : "at risk"}
              </span>
            </div>
            <p className="text-sm text-slate-300">{verdict.rationale}</p>
            {verdict.estimated_cost_czk != null && (
              <p className="text-sm text-slate-400">
                Estimated cost: <span className="text-amber-300">{verdict.estimated_cost_czk.toLocaleString()} Kc</span>
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
