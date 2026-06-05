import type { GridState } from "@/lib/types"

function Tile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg bg-grid-panel px-4 py-3 border border-grid-edge">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-xl font-semibold ${accent ?? "text-slate-100"}`}>{value}</div>
    </div>
  )
}

export default function KpiTiles({ state }: { state: GridState | null }) {
  if (!state) return null
  const binding = state.binding_constraint
  const secure = binding ? binding.loading_percent < 100 : true
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Tile label="Total load" value={`${state.total_load_mw.toFixed(0)} MW`} />
      <Tile label="Total generation" value={`${state.total_gen_mw.toFixed(0)} MW`} />
      <Tile
        label="Binding constraint"
        value={binding ? `${binding.loading_percent.toFixed(0)}%` : "n/a"}
        accent={binding && binding.loading_percent >= 90 ? "text-amber-400" : "text-emerald-400"}
      />
      <Tile
        label="N-1 headroom"
        value={secure ? "within limits" : "over limit"}
        accent={secure ? "text-emerald-400" : "text-red-400"}
      />
      <Tile
        label="Voltage issues"
        value={`${state.voltage_violations.length}`}
        accent={state.voltage_violations.length ? "text-amber-400" : "text-emerald-400"}
      />
    </div>
  )
}
