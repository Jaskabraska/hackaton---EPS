"use client"

import { useState } from "react"

import { applyAction, sendChat } from "@/lib/api"
import type { ChatResponse, ProposedAction } from "@/lib/types"

type Entry = { role: "user" | "assistant"; text: string }

const SUGGESTIONS = [
  "Is the grid N-1 secure right now?",
  "Show me the worst branch loading",
  "Which region has the tightest reserve?",
  "Draft a shift handover note"
]

export default function ChatBox({ datetime }: { datetime: string }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [input, setInput] = useState("")
  const [pending, setPending] = useState<ProposedAction | null>(null)
  const [busy, setBusy] = useState(false)

  function describeError(error: unknown) {
    return error instanceof Error ? error.message : "Assistant request failed."
  }

  async function send(message: string) {
    const text = message.trim()
    if (!text || busy) return
    setEntries((e) => [...e, { role: "user", text }])
    setInput("")
    setBusy(true)
    try {
      const res: ChatResponse = await sendChat(text, datetime)
      setEntries((e) => [...e, { role: "assistant", text: res.reply }])
      setPending(res.status === "awaiting_approval" ? res.proposed_action : null)
    } catch (error) {
      setEntries((e) => [...e, { role: "assistant", text: describeError(error) }])
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  async function approve() {
    if (!pending) return
    setBusy(true)
    try {
      await applyAction(pending)
      setEntries((e) => [...e, { role: "assistant", text: `Applied: ${pending.description}. Deeper analysis written to output/.` }])
      setPending(null)
    } catch (error) {
      setEntries((e) => [...e, { role: "assistant", text: describeError(error) }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col px-3 py-3">
      <div className="flex-1 space-y-2 overflow-y-auto pr-1 min-h-[140px] max-h-[260px]">
        {entries.length === 0 ? (
          <div className="text-xs text-slate-500">
            Ask about the live grid state, alerts or forecast. Every number comes from a tool call.
          </div>
        ) : (
          entries.map((e, i) => (
            <div
              key={i}
              className={`max-w-[88%] rounded-lg px-2.5 py-1.5 text-sm ${
                e.role === "user"
                  ? "ml-auto bg-accent-soft/30 text-slate-100"
                  : "bg-grid-raised text-slate-200"
              }`}
            >
              {e.text}
            </div>
          ))
        )}
      </div>

      {pending && (
        <div className="mt-2 rounded-lg border border-status-warn/50 bg-status-warn/10 p-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-status-warn">Awaiting approval</div>
          <div className="mt-1 mb-2 text-sm text-slate-100">{pending.description}</div>
          <button
            onClick={approve}
            disabled={busy}
            className="rounded-md bg-status-warn/80 px-2.5 py-1 text-[11px] font-medium text-grid-bg hover:bg-status-warn disabled:opacity-50"
          >
            Approve and run analysis
          </button>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => send(s)} disabled={busy} className="chip disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder="Ask about a bus, line, alert or forecast…"
          className="flex-1 rounded-lg border border-grid-line bg-grid-bg px-2.5 py-1.5 text-sm placeholder:text-slate-600 focus:border-accent/60 focus:outline-none"
        />
        <button
          onClick={() => send(input)}
          disabled={busy}
          className="rounded-lg bg-accent-soft px-3.5 py-1.5 text-sm font-medium text-white hover:bg-accent-soft/80 disabled:opacity-50"
        >
          {busy ? "…" : "Send"}
        </button>
      </div>
    </div>
  )
}
