import type { GridState } from "@/lib/types"

type Status = "ok" | "warn" | "high" | "crit"

const dotColour: Record<Status, string> = {
  ok: "bg-emerald-400",
  warn: "bg-amber-400",
  high: "bg-orange-400",
  crit: "bg-red-400"
}

const valueColour: Record<Status, string> = {
  ok: "text-white",
  warn: "text-amber-300",
  high: "text-orange-300",
  crit: "text-red-300"
}

function Tile({
  label,
  value,
  unit,
  sub,
  status
}: {
  label: string
  value: string
  unit?: string
  sub: string
  status: Status
}) {
  return (
    <div className="rounded-xl border border-slate-600 bg-slate-800/90 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <span className={`h-2 w-2 rounded-full ${dotColour[status]}`} />
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={`text-2xl font-semibold tabular-nums ${valueColour[status]}`}>{value}</span>
        {unit && <span className="text-xs text-slate-500">{unit}</span>}
      </div>
      <div className="mt-1 truncate text-[11px] text-slate-500">{sub}</div>
    </div>
  )
}

function LoadingTile() {
  return (
    <div className="rounded-xl border border-slate-600 bg-slate-800/90 px-4 py-3 animate-pulse">
      <div className="h-3 w-20 rounded bg-slate-600" />
      <div className="mt-3 h-8 w-28 rounded bg-slate-600" />
      <div className="mt-2 h-2 w-32 rounded bg-slate-700" />
      <p className="mt-2 text-[10px] text-slate-500">Loading grid data…</p>
    </div>
  )
}

export default function KpiTiles({ state, loading }: { state: GridState | null; loading?: boolean }) {
  if (!state)
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <LoadingTile key={i} />
        ))}
      </div>
    )

  const binding = state.binding_constraint
  const loadingPct = binding?.loading_percent ?? 0
  const reserve = state.total_gen_mw - state.total_load_mw
  const headroom = Math.max(0, 100 - loadingPct)
  const voltages = state.voltage_violations.length

  const bindingStatus: Status = loadingPct >= 100 ? "crit" : loadingPct >= 90 ? "high" : loadingPct >= 75 ? "warn" : "ok"
  const headroomStatus: Status = headroom < 5 ? "crit" : headroom < 15 ? "warn" : "ok"
  const voltageStatus: Status = voltages > 3 ? "crit" : voltages > 0 ? "warn" : "ok"

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <Tile
        label="Total load"
        value={state.total_load_mw.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
        unit="MW"
        sub={`${state.n_buses} buses · ${state.regions.length} regions`}
        status="ok"
      />
      <Tile
        label="Total generation"
        value={state.total_gen_mw.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
        unit="MW"
        sub={`Reserve ${reserve.toLocaleString("en-GB", { maximumFractionDigits: 0 })} MW`}
        status={reserve < 0 ? "warn" : "ok"}
      />
      <Tile
        label="Binding constraint"
        value={binding ? loadingPct.toFixed(0) : "—"}
        unit={binding ? "%" : undefined}
        sub={binding ? binding.element : "no binding element"}
        status={bindingStatus}
      />
      <Tile
        label="N-1 headroom"
        value={headroom.toFixed(0)}
        unit="%"
        sub={headroom < 15 ? "below 15% target" : "within target"}
        status={headroomStatus}
      />
      <Tile
        label="Voltage issues"
        value={`${voltages}`}
        unit={voltages === 1 ? "bus" : "buses"}
        sub={state.worst_voltage ? `worst ${state.worst_voltage.vm_pu.toFixed(3)} p.u.` : "all in band"}
        status={voltageStatus}
      />
    </div>
  )
}
