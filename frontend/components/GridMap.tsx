"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { Alert, GridMapData, MapEdge, MapNode } from "@/lib/types"

/* Map the backend's simplified gen type to a generated energy icon (served from /public). */
const GEN_TYPE_ICON: Record<string, string> = {
  solar: "/icons/types/solar.svg",
  wind: "/icons/types/wind.svg",
  hydro: "/icons/types/hydro.svg",
  biomass: "/icons/types/biomass.svg",
  geothermal: "/icons/types/geothermal.svg",
  gas: "/icons/types/combined_cycle_gas.svg",
  coal: "/icons/types/steam_coal.svg",
  oil: "/icons/types/combustion_oil.svg",
  other: "/icons/types/steam_other.svg",
}

function genTypeIcon(type: string | null | undefined): string | null {
  if (!type) return null
  return GEN_TYPE_ICON[type] ?? null
}

function edgeColour(loading: number): string {
  if (loading >= 100) return "#ef4444"
  if (loading >= 80) return "#f97316"
  if (loading >= 50) return "#eab308"
  return "#3b82f6"
}

const REGION_COLOUR: Record<string, string> = {
  r1: "#5b8def",
  r2: "#46c89a",
  r3: "#e8a33d",
}

const SEVERITY_RING: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#94a3b8",
}

function nodeRadius(node: MapNode): number {
  const power = Math.max(node.p_gen_mw, node.p_load_mw)
  return Math.min(20, Math.max(4, 4 + Math.sqrt(Math.max(0, power)) * 1.2))
}

/* ----- Node icon by generator type ----- */
function NodeIcon({
  node,
  x,
  y,
  isSelected,
  onClick,
}: {
  node: MapNode
  x: number
  y: number
  isSelected: boolean
  onClick: () => void
}) {
  const r = nodeRadius(node)
  const fill = node.in_band ? REGION_COLOUR[node.region] ?? "#94a3b8" : "#ef4444"
  const strokeW = isSelected ? 2.5 : 1
  const stroke = isSelected ? "#ffffff" : "#0b0f1780"
  const glow = node.is_producer ? `drop-shadow(0 0 ${r * 0.6}px ${fill}40)` : undefined

  const common = {
    className: "cursor-pointer",
    onClick,
    style: { filter: glow },
  }

  const title = (
    <title>{`${node.bus_name} (${node.region}) · ${node.vm_pu.toFixed(3)} p.u. · ${
      node.is_producer ? `gen ${node.p_gen_mw.toFixed(0)} MW` : `load ${node.p_load_mw.toFixed(0)} MW`
    }${node.primary_gen_type ? ` [${node.primary_gen_type}]` : ""}`}</title>
  )

  const type = node.primary_gen_type
  const icon = node.is_producer ? genTypeIcon(type) : null

  // Producer with a known generation type: render the generated energy icon.
  // The icon carries its own brand colour; a ring conveys band/selection status.
  if (icon) {
    const size = r * 2.2
    const ringR = r * 1.25
    const ringStroke = !node.in_band ? "#ef4444" : isSelected ? "#ffffff" : "transparent"
    const ringW = !node.in_band ? 2.5 : isSelected ? 2.5 : 0
    return (
      <g {...common}>
        {ringW > 0 && (
          <circle cx={x} cy={y} r={ringR} fill="none" stroke={ringStroke} strokeWidth={ringW} />
        )}
        <image
          href={icon}
          x={x - size / 2}
          y={y - size / 2}
          width={size}
          height={size}
          preserveAspectRatio="xMidYMid meet"
        />
        {title}
      </g>
    )
  }

  // Load-only: house (pentagon)
  if (!node.is_producer && node.p_load_mw > 0) {
    const h = r * 1.1
    const w = r * 1.0
    return (
      <g {...common}>
        <polygon
          points={`${x},${y - h} ${x + w},${y - h * 0.3} ${x + w},${y + h * 0.5} ${x - w},${y + h * 0.5} ${x - w},${y - h * 0.3}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeW}
        />
        {title}
      </g>
    )
  }

  // Default: circle
  return (
    <g {...common}>
      <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={strokeW} />
      {title}
    </g>
  )
}

/* ----- Region backdrop ----- */
function RegionBackdrop({ nodes, tx, ty }: { nodes: MapNode[]; tx: (x: number) => number; ty: (y: number) => number }) {
  const byRegion: Record<string, MapNode[]> = {}
  for (const n of nodes) {
    if (!byRegion[n.region]) byRegion[n.region] = []
    byRegion[n.region].push(n)
  }

  return (
    <>
      {Object.entries(byRegion).map(([region, rNodes]) => {
        const xs = rNodes.map((n) => tx(n.x))
        const ys = rNodes.map((n) => ty(n.y))
        const pad = 30
        const x1 = Math.min(...xs) - pad
        const y1 = Math.min(...ys) - pad
        const x2 = Math.max(...xs) + pad
        const y2 = Math.max(...ys) + pad
        const colour = REGION_COLOUR[region] ?? "#94a3b8"
        return (
          <g key={region}>
            <rect
              x={x1}
              y={y1}
              width={x2 - x1}
              height={y2 - y1}
              fill={colour}
              fillOpacity={0.05}
              stroke={colour}
              strokeOpacity={0.2}
              strokeWidth={1}
              rx={8}
            />
            <text
              x={x1 + 6}
              y={y1 + 14}
              fill={colour}
              fillOpacity={0.4}
              fontSize={10}
              fontWeight="bold"
            >
              {region.toUpperCase()}
            </text>
          </g>
        )
      })}
    </>
  )
}

/* ----- Alert markers on map ----- */
function AlertMarkers({
  alerts,
  nodes,
  edges,
  tx,
  ty,
}: {
  alerts: Alert[]
  nodes: MapNode[]
  edges: MapEdge[]
  tx: (x: number) => number
  ty: (y: number) => number
}) {
  const nodeByName: Record<string, MapNode> = {}
  for (const n of nodes) nodeByName[n.bus_name] = n

  const edgeByName: Record<string, MapEdge> = {}
  for (const e of edges) edgeByName[e.branch_name] = e

  return (
    <>
      {alerts.map((alert) => {
        // Try to find the alert position
        const node = nodeByName[alert.element]
        const edge = edgeByName[alert.element]
        let cx: number, cy: number
        if (node) {
          cx = tx(node.x)
          cy = ty(node.y)
        } else if (edge) {
          cx = (tx(edge.x1) + tx(edge.x2)) / 2
          cy = (ty(edge.y1) + ty(edge.y2)) / 2
        } else {
          return null
        }

        const colour = SEVERITY_RING[alert.severity] ?? "#94a3b8"
        return (
          <g key={alert.id}>
            <circle
              cx={cx}
              cy={cy}
              r={14}
              fill="none"
              stroke={colour}
              strokeWidth={2}
              strokeOpacity={0.7}
            >
              <animate attributeName="r" from="12" to="20" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" from="0.7" to="0" dur="1.5s" repeatCount="indefinite" />
            </circle>
            <circle cx={cx} cy={cy} r={12} fill="none" stroke={colour} strokeWidth={1.5} strokeOpacity={0.5} />
          </g>
        )
      })}
    </>
  )
}

/* ----- Main component ----- */
export default function GridMap({
  data,
  selected,
  onSelect,
  alerts,
}: {
  data: GridMapData | null
  selected: string | null
  onSelect: (node: MapNode) => void
  alerts?: Alert[]
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewBox, setViewBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const dragStart = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      containerRef.current?.requestFullscreen()
    }
  }, [])

  const getComputedViewBox = useCallback(() => {
    if (!data) return { x: 0, y: 0, w: 100, h: 100 }
    const xs = data.nodes.map((n) => n.x)
    const ys = data.nodes.map((n) => n.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const pad = 50
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 }
  }, [data])

  if (!data) return <div className="text-slate-400 p-6">Loading map...</div>

  const vb = viewBox ?? getComputedViewBox()
  const tx = (x: number) => x
  const ty = (y: number) => y

  const toSvgCoords = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return {
      x: vb.x + (clientX - rect.left) / rect.width * vb.w,
      y: vb.y + (clientY - rect.top) / rect.height * vb.h,
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 1.15 : 0.87
    const cursor = toSvgCoords(e.clientX, e.clientY)
    const newW = vb.w * factor
    const newH = vb.h * factor
    setViewBox({
      x: cursor.x - (cursor.x - vb.x) * factor,
      y: cursor.y - (cursor.y - vb.y) * factor,
      w: newW,
      h: newH,
    })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !dragStart.current) return
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const dx = (e.clientX - dragStart.current.x) / rect.width * vb.w
    const dy = (e.clientY - dragStart.current.y) / rect.height * vb.h
    setViewBox({ ...vb, x: dragStart.current.vx - dx, y: dragStart.current.vy - dy })
  }

  const handleMouseUp = () => {
    setDragging(false)
    dragStart.current = null
  }

  const resetView = () => setViewBox(null)

  return (
    <div ref={containerRef} className="relative w-full h-full bg-grid-bg">
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className="w-full h-full bg-grid-bg rounded-lg border border-grid-edge"
        preserveAspectRatio="xMidYMid meet"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: dragging ? "grabbing" : "grab" }}
      >
        {/* Region backdrop */}
        <RegionBackdrop nodes={data.nodes} tx={tx} ty={ty} />

        {/* Edges */}
        {data.edges.map((e) => {
          const isTie = e.is_tie_line
          return (
            <line
              key={e.branch_name}
              x1={tx(e.x1)}
              y1={ty(e.y1)}
              x2={tx(e.x2)}
              y2={ty(e.y2)}
              stroke={edgeColour(e.loading_percent)}
              strokeWidth={e.kind === "trafo" ? 4 : isTie ? 3 : 2}
              strokeOpacity={0.8}
              strokeDasharray={isTie ? "8,4" : undefined}
            >
              <title>{`${e.branch_name}: ${e.loading_percent.toFixed(0)}%${isTie ? " (tie-line)" : ""}`}</title>
            </line>
          )
        })}

        {/* Alert markers */}
        {alerts && alerts.length > 0 && (
          <AlertMarkers alerts={alerts} nodes={data.nodes} edges={data.edges} tx={tx} ty={ty} />
        )}

        {/* Nodes */}
        {data.nodes.map((n) => (
          <NodeIcon
            key={n.bus_name}
            node={n}
            x={tx(n.x)}
            y={ty(n.y)}
            isSelected={n.bus_name === selected}
            onClick={() => onSelect(n)}
          />
        ))}
      </svg>

      {/* Controls */}
      <div className="absolute top-2 right-2 flex gap-2">
        {viewBox && (
          <button
            onClick={resetView}
            className="px-2 py-1 text-xs bg-grid-panel/80 border border-grid-edge rounded text-slate-300 hover:text-white"
          >
            Reset view
          </button>
        )}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit full screen" : "Full screen"}
          aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
          className="px-2 py-1 text-xs bg-grid-panel/80 border border-grid-edge rounded text-slate-300 hover:text-white"
        >
          {isFullscreen ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
