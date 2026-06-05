"use client"

import { useState } from "react"

import { applyAction, sendChat } from "@/lib/api"
import type { ChatResponse, ProposedAction } from "@/lib/types"

type Entry = { role: "user" | "assistant"; text: string }

export default function ChatBox({ datetime }: { datetime: string }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [input, setInput] = useState("")
  const [pending, setPending] = useState<ProposedAction | null>(null)
  const [busy, setBusy] = useState(false)

  function describeError(error: unknown) {
    return error instanceof Error ? error.message : "Assistant request failed."
  }

  async function ask() {
    const message = input.trim()
    if (!message || busy) return
    setEntries((e) => [...e, { role: "user", text: message }])
    setInput("")
    setBusy(true)
    try {
      const res: ChatResponse = await sendChat(message, datetime)
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
    <div className="flex flex-col h-full">
      <div className="text-sm font-semibold mb-2">Ask the dispatcher assistant</div>
      <div className="flex-1 overflow-y-auto space-y-2 mb-2 max-h-64">
        {entries.map((e, i) => (
          <div
            key={i}
            className={`text-sm rounded px-2 py-1 ${
              e.role === "user" ? "bg-slate-700 text-slate-100" : "bg-grid-panel text-slate-200"
            }`}
          >
            {e.text}
          </div>
        ))}
      </div>
      {pending && (
        <div className="rounded border border-amber-500 bg-amber-500/10 p-2 mb-2">
          <div className="text-xs text-amber-300 mb-1">Awaiting approval</div>
          <div className="text-sm text-slate-100 mb-2">{pending.description}</div>
          <button
            onClick={approve}
            className="text-xs rounded bg-amber-600 hover:bg-amber-500 px-2 py-1 text-white"
          >
            Approve and run analysis
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="e.g. is the grid N-1 secure right now?"
          className="flex-1 rounded bg-grid-bg border border-grid-edge px-2 py-1 text-sm"
        />
        <button
          onClick={ask}
          disabled={busy}
          className="text-sm rounded bg-blue-600 hover:bg-blue-500 px-3 py-1 text-white disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  )
}
