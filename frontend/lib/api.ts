import type {
  AlertsPayload,
  ChatResponse,
  DayBundle,
  GridMapData,
  GridState,
  PlaybookResult,
  ProposedAction,
  RiskVerdict,
  ShiftSummary
} from "./types"

// Default to same-origin /api proxy (see next.config.mjs) so the browser never
// blocks requests when the backend is on a different host/port.
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api"

async function errorMessage(res: Response): Promise<string> {
  try {
    const payload = await res.json()
    if (typeof payload.detail === "string") return payload.detail
  } catch {
    // Fall through to a generic status message when the backend is unreachable or returns non-JSON.
  }
  return `request failed: ${res.status}`
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(await errorMessage(res))
  return res.json() as Promise<T>
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(await errorMessage(res))
  return res.json() as Promise<T>
}

export const fetchState = (datetime: string) => getJson<GridState>(`/state?datetime=${datetime}`)
export const fetchMap = (datetime: string) => getJson<GridMapData>(`/map?datetime=${datetime}`)
export const fetchAlerts = (datetime: string) => getJson<AlertsPayload>(`/alerts?datetime=${datetime}`)
export const fetchSummary = (datetime: string) => getJson<ShiftSummary>(`/summary?datetime=${datetime}`)

export const sendChat = (message: string, datetime: string) =>
  postJson<ChatResponse>("/chat", { message, datetime, history: [] })

export const applyAction = (action: ProposedAction) =>
  postJson<Record<string, unknown>>("/apply", action)

export const fetchDayBundle = (date: string) =>
  getJson<DayBundle>(`/day?date=${date}`)

export const runPlaybook = (element: string, datetime: string) =>
  postJson<PlaybookResult>(`/playbook?element=${encodeURIComponent(element)}&datetime=${encodeURIComponent(datetime)}`, {})

export const fetchRiskVerdict = (element: string, datetime: string) =>
  getJson<RiskVerdict>(`/assess?element=${encodeURIComponent(element)}&datetime=${encodeURIComponent(datetime)}`)

export const logDecision = (
  element: string,
  datetime: string,
  decision: string,
  recommendedAction?: string | null
) => {
  const params = new URLSearchParams({
    element,
    datetime,
    decision
  })
  if (recommendedAction) params.set("recommended_action", recommendedAction)
  return postJson<Record<string, unknown>>(`/decision?${params.toString()}`, {})
}
