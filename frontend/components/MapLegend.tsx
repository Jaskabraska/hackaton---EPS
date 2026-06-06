import { TYPE_LABEL, TYPE_ORDER } from "@/lib/generation"

export default function MapLegend() {
  const types = TYPE_ORDER.filter((t) => ["solar", "wind", "hydro", "combined_cycle_gas", "combustion_gas", "biomass"].includes(t))

  return (
    <div className="pointer-events-none absolute bottom-2 left-2 right-14 flex flex-wrap items-end gap-3 rounded-lg border border-[#3d4450] bg-[#1a1f28]/95 px-3 py-2 backdrop-blur-sm">
      <div className="flex flex-col gap-1">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-[#94a3b8]">Branches</span>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#cbd5e1]">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 rounded bg-[#94a3b8]" />
            normal
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 rounded bg-[#d97706]" />
            stressed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 rounded bg-[#ef4444]" />
            overload
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 border-t border-dashed border-[#38bdf8]" />
            region tie
          </span>
        </div>
      </div>

      <div className="h-8 w-px bg-[#3d4450] hidden sm:block" />

      <div className="flex flex-col gap-1">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-[#94a3b8]">Nodes</span>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#cbd5e1]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#fb923c]" />
            load bus
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border border-white/40 bg-[#334155]" />
            generator
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="relative h-3 w-3">
              <span className="absolute inset-0 rounded-full border border-[#f97316] animate-ping opacity-60" />
              <span className="absolute inset-0 rounded-full border border-[#f97316]" />
            </span>
            alert
          </span>
        </div>
      </div>

      <div className="h-8 w-px bg-[#3d4450] hidden md:block" />

      <div className="flex flex-col gap-1 min-w-0">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-[#94a3b8]">Generation types</span>
        <div className="flex flex-wrap gap-1.5">
          {types.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded bg-[#252b36] px-1.5 py-0.5 text-[9px] text-[#e2e8f0]">
              <img src={`/icons/types/${t}.svg`} alt="" width={14} height={14} className="shrink-0" />
              {TYPE_LABEL[t].split(" ")[0]}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
