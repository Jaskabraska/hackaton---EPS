"use client"

import Modal from "@/components/Modal"
import type { PlaybookResult } from "@/lib/types"

type Props = {
  result: PlaybookResult
  onClose: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-200 border-b border-grid-edge pb-1">{title}</h3>
      {children}
    </div>
  )
}

function KV({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null) return null
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-200">{typeof value === "number" ? value.toLocaleString() : value}</span>
    </div>
  )
}

export default function IncidentReport({ result, onClose }: Props) {
  const { steps } = result
  const situation = steps.situation as Record<string, unknown>
  const n1Risk = steps.n1_risk as Record<string, unknown>
  const analoguesData = steps.analogues as Record<string, unknown>
  const primaryTrip = n1Risk.primary_trip as Record<string, unknown> | undefined
  const bc = situation.binding_constraint as Record<string, unknown> | null

  return (
    <Modal isOpen onClose={onClose} title={`Incident report: ${result.element}`} wide>
      <div className="space-y-6">
        {/* Step 1: Situation */}
        <Section title="1. Situation assessment">
          <div className="grid grid-cols-2 gap-2">
            <KV label="Total load" value={`${situation.total_load_mw} MW`} />
            <KV label="Total generation" value={`${situation.total_gen_mw} MW`} />
            <KV label="Voltage violations" value={Number(situation.voltage_violation_count)} />
          </div>
          {bc && (
            <div className="text-sm text-slate-300 mt-1">
              Binding constraint: {String(bc.element)} at {String(bc.loading_percent)}%
            </div>
          )}
        </Section>

        {/* Step 2: N-1 risk */}
        <Section title="2. N-1 risk analysis">
          {primaryTrip && (
            <div className="space-y-1">
              <KV label="Tripped element" value={primaryTrip.tripped_element as string} />
              <KV label="Converged" value={primaryTrip.converged ? "Yes" : "No"} />
              <KV label="N-1 secure" value={primaryTrip.n1_secure ? "Yes" : "No"} />
              <KV label="Worst loading" value={`${primaryTrip.worst_loading_percent}%`} />
              {(primaryTrip.isolated_bus_count as number) > 0 && (
                <KV label="Isolated buses" value={primaryTrip.isolated_bus_count as number} />
              )}
            </div>
          )}
          {(n1Risk.neighbour_trips as Array<Record<string, unknown>>)?.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-slate-400 mb-1">Neighbour contingencies checked:</p>
              {(n1Risk.neighbour_trips as Array<Record<string, unknown>>).map((t, i) => (
                <div key={i} className="text-xs text-slate-400">
                  {t.tripped_element as string}: {t.n1_secure ? "secure" : `at risk (${t.worst_loading_percent}%)`}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Step 3: Analogues */}
        <Section title="3. Historical analogues">
          {(analoguesData.available as boolean) ? (
            <div className="space-y-2">
              {((analoguesData.analogues as Array<Record<string, unknown>>) ?? []).map((a, i) => (
                <div key={i} className="text-sm text-slate-300 border border-grid-edge rounded p-2">
                  <div className="flex justify-between">
                    <span>{a.datetime as string}</span>
                    <span className="text-xs text-slate-500">distance: {a.similarity_distance as number}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Load: {a.total_load_mw as number} MW, binding: {a.binding_loading_pct as number}%
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No analogues available.</p>
          )}
        </Section>

        {/* Step 4: Ranked options */}
        <Section title="4. Remedial options (ranked by cost)">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-grid-edge">
                  <th className="py-1 pr-3">Action</th>
                  <th className="py-1 pr-3">MW</th>
                  <th className="py-1 pr-3">Cost (Kc)</th>
                  <th className="py-1">Feasibility</th>
                </tr>
              </thead>
              <tbody>
                {steps.options.map((opt, i) => (
                  <tr key={i} className="border-b border-grid-edge/50">
                    <td className="py-1.5 pr-3 text-slate-300">{opt.action}</td>
                    <td className="py-1.5 pr-3 text-slate-300">{opt.delta_mw}</td>
                    <td className="py-1.5 pr-3 text-amber-300">{opt.cost_czk.toLocaleString()}</td>
                    <td className="py-1.5 text-slate-400">{opt.feasibility}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Step 5: Immediate action */}
        <Section title="5. Immediate recommended action">
          <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-lg p-4">
            <p className="text-sm font-semibold text-emerald-300 mb-2">
              {steps.immediate_action.recommendation}
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <KV label="Redispatch" value={`${steps.immediate_action.delta_mw} MW`} />
              <KV label="Cost" value={`${steps.immediate_action.cost_czk.toLocaleString()} Kc`} />
              <KV label="Loading now" value={`${steps.immediate_action.current_loading_percent}%`} />
              <KV label="Loading after" value={`~${steps.immediate_action.estimated_loading_after_percent}%`} />
            </div>
            <p className="text-xs text-slate-400 mt-2">{steps.immediate_action.rationale}</p>
          </div>
        </Section>

        {/* Step 6: Forward guidance */}
        <Section title="6. Forward-looking guidance">
          <p className="text-sm text-slate-300">{steps.forward_guidance.guidance}</p>
        </Section>

        <div className="pt-4 border-t border-grid-edge flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-white"
          >
            Resume playback
          </button>
        </div>
      </div>
    </Modal>
  )
}
