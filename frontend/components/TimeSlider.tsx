"use client"

import { addHours, format, parse } from "date-fns"

const FMT = "yyyy_MM_dd_HH_mm_ss"

function toDate(value: string): Date {
  return parse(value, FMT, new Date(2024, 0, 1))
}

export default function TimeSlider({
  datetime,
  onChange
}: {
  datetime: string
  onChange: (next: string) => void
}) {
  const date = toDate(datetime)
  const hour = date.getHours()

  const step = (hours: number) => onChange(format(addHours(date, hours), FMT))
  const setHour = (h: number) => {
    const next = new Date(date)
    next.setHours(h)
    onChange(format(next, FMT))
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 border-t border-grid-edge/60">
      <div className="flex items-center gap-1">
        <button onClick={() => step(-24)} className="chip" title="Previous day">−1d</button>
        <button onClick={() => step(-1)} className="chip" title="Previous hour">−1h</button>
      </div>

      <input
        type="range"
        min={0}
        max={23}
        value={hour}
        onChange={(e) => setHour(Number(e.target.value))}
        className="flex-1 accent-accent"
        aria-label="Hour of day"
      />

      <div className="flex items-center gap-1">
        <button onClick={() => step(1)} className="chip" title="Next hour">+1h</button>
        <button onClick={() => step(24)} className="chip" title="Next day">+1d</button>
      </div>

      <div className="min-w-[150px] text-right font-mono text-xs text-slate-300 tabular-nums">
        {format(date, "dd MMM yyyy · HH:mm")}
      </div>
    </div>
  )
}
