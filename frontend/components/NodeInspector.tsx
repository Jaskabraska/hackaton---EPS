import { BUS_GENERATION, REGION_LABEL, TYPE_COLOUR, TYPE_LABEL } from "@/lib/generation"
import type { MapNode } from "@/lib/types"

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 text-sm border-b border-grid-edge/50 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-100 tabular-nums">{value}</span>
    </div>
  )
}

function VoltageGauge({ vm, inBand }: { vm: number; inBand: boolean }) {
  // Display window 0.90–1.10 p.u. with the nominal band 0.95–1.05 highlighted.
  const lo = 0.9
  const hi = 1.1
  const pct = Math.min(100, Math.max(0, ((vm - lo) / (hi - lo)) * 100))
  return (
    <div className="mt-1">
      <div className="relative h-2 rounded-full bg-grid-raised">
        <div className="absolute inset-y-0 rounded-full bg-status-ok/20" style={{ left: "25%", right: "25%" }} />
        <div
          className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-grid-bg ${inBand ? "bg-status-ok" : "bg-status-crit"}`}
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-600">
        <span>0.90</span>
        <span>1.00</span>
        <span>1.10</span>
      </div>
    </div>
  )
}

export default function NodeInspector({ node }: { node: MapNode | null }) {
  if (!node)
    return <div className="px-3 py-6 text-sm text-slate-500">Select a bus on the map to inspect it.</div>

  const gen = BUS_GENERATION[node.bus_name]

  return (
    <div className="px-3 py-3">
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold text-slate-100">{node.bus_name}</div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            node.in_band ? "bg-status-ok/15 text-status-ok" : "bg-status-crit/15 text-status-crit"
          }`}
        >
          {node.in_band ? "nominal" : "critical voltage"}
        </span>
      </div>
      <div className="mt-0.5 text-xs text-slate-500">{REGION_LABEL[node.region] ?? node.region}</div>

      <div className="mt-3">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">Voltage · {node.vm_pu.toFixed(3)} p.u.</div>
        <VoltageGauge vm={node.vm_pu} inBand={node.in_band} />
      </div>

      <div className="mt-3">
        <Row label="Local load" value={`${node.p_load_mw.toFixed(1)} MW`} />
        <Row label="Local generation" value={`${node.p_gen_mw.toFixed(1)} MW`} />
        <Row label="Net injection" value={`${(node.p_gen_mw - node.p_load_mw).toFixed(1)} MW`} />
      </div>

      <div className="mt-3">
        <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">Generation mix</div>
        {gen ? (
          <div className="flex flex-wrap gap-1.5">
            {gen.types.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 rounded-full bg-grid-raised px-2 py-1 text-[11px] text-slate-200"
              >
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: TYPE_COLOUR[t] }} />
                {TYPE_LABEL[t]}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-500">Load / transit bus — no generation.</div>
        )}
      </div>
    </div>
  )
}
