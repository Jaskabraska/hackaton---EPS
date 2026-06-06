"use client"

import { useCallback, useRef, useState } from "react"

import MapLegend from "@/components/MapLegend"
import { BUS_GENERATION, TYPE_LABEL, iconPath } from "@/lib/generation"
import type { Alert, GridMapData, MapEdge, MapNode } from "@/lib/types"

const ROAD = "#cbd5e1"
const REGION_BORDER = "#94a3b8"
const TIE = "#38bdf8"
const LOAD_DOT = "#fb923c"
const LOAD_DOT_DIM = "#e2e8f0"

function edgeColour(loading: number): string {
  if (loading >= 100) return "#ef4444"
  if (loading >= 80) return "#f97316"
  if (loading >= 50) return "#d97706"
  return ROAD
}

const SEVERITY_RING: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#d97706",
  LOW: "#94a3b8"
}

function RegionBoundaries({ nodes, z }: { nodes: MapNode[]; z: number }) {
  const byRegion: Record<string, MapNode[]> = {}
  for (const n of nodes) {
    if (!byRegion[n.region]) byRegion[n.region] = []
    byRegion[n.region].push(n)
  }

  return (
    <>
      {Object.entries(byRegion).map(([region, rNodes]) => {
        const xs = rNodes.map((n) => n.x)
        const ys = rNodes.map((n) => n.y)
        const pad = 36
        const x = Math.min(...xs) - pad
        const y = Math.min(...ys) - pad
        const w = Math.max(...xs) - Math.min(...xs) + pad * 2
        const h = Math.max(...ys) - Math.min(...ys) + pad * 2
        return (
          <rect
            key={region}
            x={x}
            y={y}
            width={w}
            height={h}
            fill="none"
            stroke={REGION_BORDER}
            strokeWidth={1 * z}
            strokeOpacity={0.55}
            strokeDasharray={`${6 * z},${4 * z}`}
            rx={6 * z}
          />
        )
      })}
    </>
  )
}

function GenNode({
  node,
  z,
  isSelected,
  onClick
}: {
  node: MapNode
  z: number
  isSelected: boolean
  onClick: () => void
}) {
  const gen = BUS_GENERATION[node.bus_name]
  const href = iconPath(node.bus_name)
  if (!gen || !href) return null

  const base = 26 + 24 * Math.min(1, Math.sqrt(Math.max(0, node.p_gen_mw) / 500))
  const size = (isSelected ? base + 8 : base) * z
  const halo = size / 2 + 2 * z

  return (
    <g className="cursor-pointer" onClick={onClick}>
      <circle cx={node.x} cy={node.y} r={halo} fill="#0f172a" fillOpacity={0.85} stroke="#475569" strokeWidth={0.8 * z} />
      {!node.in_band && (
        <circle cx={node.x} cy={node.y} r={halo + 2 * z} fill="none" stroke="#ef4444" strokeWidth={1.5 * z} strokeDasharray="4 2" />
      )}
      {isSelected && (
        <circle cx={node.x} cy={node.y} r={halo + 3 * z} fill="none" stroke="#f8fafc" strokeWidth={2 * z} />
      )}
      <image href={href} x={node.x - size / 2} y={node.y - size / 2} width={size} height={size}>
        <title>{`${node.bus_name} ┬Ě ${gen.types.map((t) => TYPE_LABEL[t]).join(", ")} ┬Ě ${node.p_gen_mw.toFixed(0)} MW`}</title>
      </image>
    </g>
  )
}

function AlertMarkers({
  alerts,
  nodes,
  edges,
  z
}: {
  alerts: Alert[]
  nodes: MapNode[]
  edges: MapEdge[]
  z: number
}) {
  const nodeByName: Record<string, MapNode> = {}
  for (const n of nodes) nodeByName[n.bus_name] = n
  const edgeByName: Record<string, MapEdge> = {}
  for (const e of edges) edgeByName[e.branch_name] = e

  return (
    <>
      {alerts.map((alert) => {
        const node = nodeByName[alert.element]
        const edge = edgeByName[alert.element]
        let cx: number, cy: number
        if (node) {
          cx = node.x
          cy = node.y
        } else if (edge) {
          cx = (edge.x1 + edge.x2) / 2
          cy = (edge.y1 + edge.y2) / 2
        } else {
          return null
        }
        const colour = SEVERITY_RING[alert.severity] ?? "#94a3b8"
        return (
          <g key={alert.id}>
            <circle cx={cx} cy={cy} r={16 * z} fill="none" stroke={colour} strokeWidth={2 * z} strokeOpacity={0.85}>
              <animate attributeName="r" from={14 * z} to={22 * z} dur="1.4s" repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" from="0.85" to="0" dur="1.4s" repeatCount="indefinite" />
            </circle>
            <circle cx={cx} cy={cy} r={4 * z} fill={colour} fillOpacity={0.9} />
          </g>
        )
      })}
    </>
  )
}

export default function GridMap({
  data,
  selected,
  onSelect,
  alerts
}: {
  data: GridMapData | null
  selected: string | null
  onSelect: (node: MapNode) => void
  alerts?: Alert[]
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [viewBox, setViewBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null)

  const getComputedViewBox = useCallback(() => {
    if (!data) return { x: 0, y: 0, w: 100, h: 100 }
    const xs = data.nodes.map((n) => n.x)
    const ys = data.nodes.map((n) => n.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const pad = 70
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 }
  }, [data])

  if (!data) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg border border-slate-600 bg-slate-800">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
        <p className="text-sm text-slate-300">Loading transmission gridÔÇŽ</p>
        <p className="text-xs text-slate-500">Fetching 118 buses and 186 branches</p>
      </div>
    )
  }

  const baseVb = getComputedViewBox()
  const vb = viewBox ?? baseVb
  const z = vb.w / baseVb.w

  const toSvgCoords = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return {
      x: vb.x + ((clientX - rect.left) / rect.width) * vb.w,
      y: vb.y + ((clientY - rect.top) / rect.height) * vb.h
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 1.15 : 0.87
    const cursor = toSvgCoords(e.clientX, e.clientY)
    setViewBox({
      x: cursor.x - (cursor.x - vb.x) * factor,
      y: cursor.y - (cursor.y - vb.y) * factor,
      w: vb.w * factor,
      h: vb.h * factor
    })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y, moved: false }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !dragStart.current) return
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const dx = ((e.clientX - dragStart.current.x) / rect.width) * vb.w
    const dy = ((e.clientY - dragStart.current.y) / rect.height) * vb.h
    if (Math.abs(e.clientX - dragStart.current.x) + Math.abs(e.clientY - dragStart.current.y) > 3) {
      dragStart.current.moved = true
    }
    setViewBox({ ...vb, x: dragStart.current.vx - dx, y: dragStart.current.vy - dy })
  }

  const handleMouseUp = () => setDragging(false)

  const selectNode = (n: MapNode) => {
    if (dragStart.current?.moved) return
    onSelect(n)
  }

  const resetView = () => setViewBox(null)

  const loadNodes = data.nodes.filter((n) => !BUS_GENERATION[n.bus_name])
  const genNodes = data.nodes.filter((n) => BUS_GENERATION[n.bus_name])
  const tieCount = data.edges.filter((e) => e.is_tie_line).length
  const alertCount = alerts?.length ?? 0

  return (
    <div className="relative h-full w-full min-h-[420px]">
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className="h-full w-full rounded-lg border border-[#3d4450]"
        preserveAspectRatio="xMidYMid meet"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: dragging ? "grabbing" : "grab", background: "#0a0e17" }}
        aria-label="Transmission grid map"
      >
        <RegionBoundaries nodes={data.nodes} z={z} />

        {data.edges.map((e) => {
          const isTie = e.is_tie_line
          const stressed = e.loading_percent >= 50
          const colour = isTie ? TIE : edgeColour(e.loading_percent)
          return (
            <line
              key={e.branch_name}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke={colour}
              strokeWidth={(e.kind === "trafo" ? 3 : isTie ? 2 : stressed ? 2.2 : 1.6) * z}
              strokeOpacity={isTie ? 0.9 : stressed ? 1 : 0.85}
              strokeDasharray={isTie ? `${6 * z},${4 * z}` : undefined}
            >
              <title>{`${e.branch_name}: ${e.loading_percent.toFixed(0)}%${isTie ? " (tie)" : ""}`}</title>
            </line>
          )
        })}

        {alerts && alerts.length > 0 && (
          <AlertMarkers alerts={alerts} nodes={data.nodes} edges={data.edges} z={z} />
        )}

        {loadNodes.map((n) => {
          const isSel = n.bus_name === selected
          const r = (isSel ? 6 : 4.5) * z
          return (
            <circle
              key={n.bus_name}
              cx={n.x}
              cy={n.y}
              r={r}
              fill={!n.in_band ? "#ef4444" : isSel ? LOAD_DOT : LOAD_DOT_DIM}
              fillOpacity={isSel ? 1 : 0.85}
              stroke={isSel ? "#f8fafc" : "#1e293b"}
              strokeWidth={(isSel ? 1.5 : 0.8) * z}
              className="cursor-pointer"
              onClick={() => selectNode(n)}
            >
              <title>{`${n.bus_name} ┬Ě load ${n.p_load_mw.toFixed(0)} MW`}</title>
            </circle>
          )
        })}

        {genNodes.map((n) => (
          <GenNode key={n.bus_name} node={n} z={z} isSelected={n.bus_name === selected} onClick={() => selectNode(n)} />
        ))}
      </svg>

      {/* Quick stats ÔÇö helps confirm data is live */}
      <div className="pointer-events-none absolute left-2 top-2 flex gap-2 text-[10px] text-[#cbd5e1]">
        <span className="rounded bg-[#1a1f28]/90 px-2 py-1 border border-[#3d4450]">
          {genNodes.length} generators
        </span>
        <span className="rounded bg-[#1a1f28]/90 px-2 py-1 border border-[#3d4450]">
          {tieCount} ties
        </span>
        {alertCount > 0 && (
          <span className="rounded bg-[#7f1d1d]/80 px-2 py-1 border border-[#ef4444]/50 text-[#fecaca]">
            {alertCount} alerts
          </span>
        )}
      </div>

      <MapLegend />

      <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-md border border-[#3d4450] bg-[#1a1f28]/95 shadow-lg">
        <button
          type="button"
          onClick={() => setViewBox({ x: vb.x + vb.w * 0.13, y: vb.y + vb.h * 0.13, w: vb.w * 0.74, h: vb.h * 0.74 })}
          className="px-3 py-1.5 text-base text-[#e2e8f0] hover:bg-[#334155]"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setViewBox({ x: vb.x - vb.w * 0.175, y: vb.y - vb.h * 0.175, w: vb.w * 1.35, h: vb.h * 1.35 })}
          className="border-t border-[#3d4450] px-3 py-1.5 text-base text-[#e2e8f0] hover:bg-[#334155]"
          aria-label="Zoom out"
        >
          Ôłĺ
        </button>
        <button
          type="button"
          onClick={resetView}
          className="border-t border-[#3d4450] px-3 py-1 text-xs text-[#94a3b8] hover:bg-[#334155] hover:text-[#e2e8f0]"
          aria-label="Reset view"
        >
          fit
        </button>
      </div>
    </div>
  )
}
