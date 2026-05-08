'use client'

import { useEffect, useState } from 'react'
import { getScoreBand, getScoreColor } from '@/lib/score'

interface VibeScoreProps {
  score: number
  animate?: boolean
}

export function VibeScore({ score, animate = true }: VibeScoreProps) {
  const [displayed, setDisplayed] = useState(animate ? 0 : score)
  const band = getScoreBand(score)
  const color = getScoreColor(score)

  useEffect(() => {
    if (!animate) return
    let start = 0
    const duration = 1500
    const startTime = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      start = Math.round(eased * score)
      setDisplayed(start)
      if (progress < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  }, [score, animate])

  const circumference = 2 * Math.PI * 54
  const offset = circumference - (displayed / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        <svg width="160" height="160" className="-rotate-90">
          <circle cx="80" cy="80" r="54" fill="none" stroke="#1f1f1f" strokeWidth="10" />
          <circle
            cx="80"
            cy="80"
            r="54"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.05s linear, stroke 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-5xl font-bold font-mono tabular-nums"
            style={{ color }}
          >
            {displayed}
          </span>
          <span className="text-xs text-[#71717a] font-mono mt-0.5">/100</span>
        </div>
      </div>

      <div className="text-center">
        <p className="text-2xl font-semibold" style={{ color }}>{band.label}</p>
        <p className="text-sm text-[#71717a] mt-1">{band.description}</p>
      </div>
    </div>
  )
}
