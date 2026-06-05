export type BranchLoading = {
  branch_name: string
  from_bus: string
  to_bus: string
  loading_percent: number
  kind: "line" | "trafo"
}

export type BusVoltage = {
  bus_name: string
  region: string
  vm_pu: number
  in_band: boolean
}

export type RegionBalance = {
  region: string
  load_mw: number
  gen_mw: number
  balance_mw: number
}

export type GridState = {
  datetime: string
  total_load_mw: number
  total_gen_mw: number
  n_buses: number
  n_branches: number
  binding_constraint: { element: string; kind: string; loading_percent: number } | null
  worst_voltage: BusVoltage | null
  regions: RegionBalance[]
  overloaded: BranchLoading[]
  voltage_violations: BusVoltage[]
}

export type MapNode = {
  bus_name: string
  region: string
  x: number
  y: number
  vm_pu: number
  in_band: boolean
  p_load_mw: number
  p_gen_mw: number
}

export type MapEdge = {
  branch_name: string
  kind: "line" | "trafo"
  x1: number
  y1: number
  x2: number
  y2: number
  loading_percent: number
}

export type GridMapData = {
  datetime: string
  nodes: MapNode[]
  edges: MapEdge[]
}

export type Alert = {
  id: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  element: string
  category: string
  title: string
  what: string
  action: string
  impact_risk: string
  financial: Record<string, unknown> | null
  predictive_basis: Record<string, unknown> | null
}

export type AlertsPayload = {
  generated_at: string
  datetime: string
  alerts: Alert[]
  recommendation_engine: {
    headline: string
    actions_ranked: Array<Record<string, unknown>>
  }
}

export type ProposedAction = {
  kind: string
  element: string | null
  datetime: string | null
  description: string
}

export type ChatResponse = {
  status: "answered" | "awaiting_approval"
  reply: string
  proposed_action: ProposedAction | null
  tool_trace: Array<{ tool: string; arguments: Record<string, unknown> }>
}

export type ShiftSummary = {
  window_start: string
  window_end: string
  alert_count: number
  summary: string
  events: Array<{ datetime: string; alert_count: number; top: string[] }>
}
