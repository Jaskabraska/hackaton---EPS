"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { fetchDayBundle } from "@/lib/api"
import type { DayBundle } from "@/lib/types"

type Props = {
  onHourChange: (bundle: DayBundle, hourIndex: number) => void
  onPause: (bundle: DayBundle, hourIndex: number) => void
  onComplete: (bundle: DayBundle) => void
  isPaused: boolean
  setIsPaused: (v: boolean) => void
}

export default function PlaybackControls({ onHourChange, onPause, onComplete, isPaused, setIsPaused }: Props) {
  const [bundle, setBundle] = useState<DayBundle | null>(null)
  const [hour, setHour] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadBundle = async () => {
    setLoading(true)
    setError(null)
    try {
      const b = await fetchDayBundle("2024_02_17")
      setBundle(b)
      setHour(0)
      if (b.hours.length > 0) {
        onHourChange(b, 0)
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const play = useCallback(() => {
    if (!bundle || bundle.hours.length === 0) return
    setIsPlaying(true)
    setIsPaused(false)
  }, [bundle, setIsPaused])

  const pause = useCallback(() => {
    setIsPlaying(false)
    stopInterval()
  }, [stopInterval])

  // Playback timer
  useEffect(() => {
    if (!isPlaying || isPaused || !bundle) {
      stopInterval()
      return
    }

    intervalRef.current = setInterval(() => {
      setHour((prev) => {
        const next = prev + 1
        if (next >= bundle.hours.length) {
          setIsPlaying(false)
          onComplete(bundle)
          return prev
        }
        return next
      })
    }, 2000)

    return stopInterval
  }, [isPlaying, isPaused, bundle, stopInterval, onComplete])

  // When hour changes, notify parent and check for HIGH/CRITICAL alerts
  useEffect(() => {
    if (!bundle || hour >= bundle.hours.length) return
    onHourChange(bundle, hour)

    const hourData = bundle.hours[hour]
    const critAlerts = hourData.alerts.alerts.filter(
      (a) => a.severity === "HIGH" || a.severity === "CRITICAL"
    )
    if (critAlerts.length > 0 && isPlaying) {
      setIsPaused(true)
      onPause(bundle, hour)
    }
  }, [hour, bundle, onHourChange, onPause, isPlaying, setIsPaused])

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const h = parseInt(e.target.value, 10)
    setHour(h)
  }

  if (!bundle) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={loadBundle}
          disabled={loading}
          className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Loading..." : "Apply"}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    )
  }

  const currentHour = bundle.hours[hour]
  const stem = currentHour?.datetime ?? ""
  const displayTime = stem.replace(/_/g, "-").slice(0, 13).replace(/-/g, ":").replace(":", "-").replace(":", "-")
  const hourLabel = stem.split("_")[3] ?? "00"

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={isPlaying && !isPaused ? pause : play}
        className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-white"
      >
        {isPaused ? "Resume" : isPlaying ? "Pause" : "Play"}
      </button>
      <input
        type="range"
        min={0}
        max={bundle.hours.length - 1}
        value={hour}
        onChange={handleScrub}
        className="w-48 accent-emerald-500"
      />
      <span className="text-sm text-slate-300 font-mono min-w-[3ch]">{hourLabel}:00</span>
      <span className="text-xs text-slate-500">
        2024-02-17 · hour {hour + 1}/{bundle.hours.length}
      </span>
    </div>
  )
}
