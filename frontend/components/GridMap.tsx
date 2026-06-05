"use client"

import type { GridMapData, MapNode } from "@/lib/types"

function edgeColour(loading: number): string {
  if (loading >= 100) return "#ef4444"
  if (loading >= 80) return "#f97316"
  if (loading >= 50) return "#eab308"
  return "#3b82f6"
}

const regionColour: Record<string, string> = {
  r1: "#22d3ee",
  r2: "#a78bfa",
  r3: "#fb923c"
}

export default function GridMap({
  data,
  selected,
  onSelect
}: {
  data: GridMapData | null
  selected: string | null
  onSelect: (node: MapNode) => void
}) {
  if (!data) return <div className="text-slate-400 p-6">Loading map…</div>

  const xs = data.nodes.map((n) => n.x)
  const ys = data.nodes.map((n) => n.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const pad = 40
  const width = maxX - minX + pad * 2
  const height = maxY - minY + pad * 2

  const tx = (x: number) => x - minX + pad
  const ty = (y: number) => y - minY + pad

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full bg-grid-bg rounded-lg border border-grid-edge"
      preserveAspectRatio="xMidYMid meet"
    >
      {data.edges.map((e) => (
        <line
          key={e.branch_name}
          x1={tx(e.x1)}
          y1={ty(e.y1)}
          x2={tx(e.x2)}
          y2={ty(e.y2)}
          stroke={edgeColour(e.loading_percent)}
          strokeWidth={e.kind === "trafo" ? 4 : 2}
          strokeOpacity={0.8}
        >
          <title>{`${e.branch_name}: ${e.loading_percent.toFixed(0)}%`}</title>
        </line>
      ))}
      {data.nodes.map((n) => {
        const isSelected = n.bus_name === selected
        return (
          <circle
            key={n.bus_name}
            cx={tx(n.x)}
            cy={ty(n.y)}
            r={isSelected ? 9 : 5}
            fill={n.in_band ? regionColour[n.region] ?? "#94a3b8" : "#ef4444"}
            stroke={isSelected ? "#ffffff" : "#0b0f17"}
            strokeWidth={isSelected ? 2 : 1}
            className="cursor-pointer"
            onClick={() => onSelect(n)}
          >
            <title>{`${n.bus_name} (${n.region}) · ${n.vm_pu.toFixed(3)} p.u.`}</title>
          </circle>
        )
      })}
    </svg>
  )
}
