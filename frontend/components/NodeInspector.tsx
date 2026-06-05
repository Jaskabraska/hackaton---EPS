import type { MapNode } from "@/lib/types"

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-1 border-b border-grid-edge/60">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-100">{value}</span>
    </div>
  )
}

export default function NodeInspector({ node }: { node: MapNode | null }) {
  if (!node)
    return <div className="text-sm text-slate-400">Select a bus on the map to inspect it.</div>
  return (
    <div>
      <div className="text-base font-semibold mb-2">{node.bus_name}</div>
      <Row label="Region" value={node.region} />
      <Row label="Voltage" value={`${node.vm_pu.toFixed(3)} p.u.`} />
      <Row label="In band" value={node.in_band ? "yes" : "no"} />
      <Row label="Local load" value={`${node.p_load_mw.toFixed(1)} MW`} />
      <Row label="Local generation" value={`${node.p_gen_mw.toFixed(1)} MW`} />
    </div>
  )
}
