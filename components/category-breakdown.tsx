'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { CHECK_CATEGORIES } from '@/lib/checks/registry'

interface CategoryData {
  category: string
  pass: number
  fail: number
  warn: number
  skip: number
  score: number
}

interface CategoryBreakdownProps {
  data: CategoryData[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-3 text-xs font-mono">
      <p className="text-[#fafafa] font-semibold mb-2">{label}</p>
      <p className="text-[#22c55e]">PASS: {d.pass}</p>
      <p className="text-[#ef4444]">FAIL: {d.fail}</p>
      <p className="text-[#f59e0b]">WARN: {d.warn}</p>
      <p className="text-[#71717a]">SKIP: {d.skip}</p>
      <p className="text-[#fafafa] mt-1 font-bold">Score: {d.score}</p>
    </div>
  )
}

export function CategoryBreakdown({ data }: CategoryBreakdownProps) {
  return (
    <div className="space-y-3">
      {data.map((cat) => {
        const color = cat.score >= 75 ? '#22c55e' : cat.score >= 50 ? '#f59e0b' : '#ef4444'
        const catInfo = CHECK_CATEGORIES[cat.category as keyof typeof CHECK_CATEGORIES]
        return (
          <div key={cat.category} className="flex items-center gap-4">
            <div className="w-24 text-xs text-[#71717a] font-mono shrink-0">{catInfo?.label || cat.category}</div>
            <div className="flex-1 h-2 bg-[#1f1f1f] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${cat.score}%`, background: color }}
              />
            </div>
            <div className="w-12 text-right font-mono text-sm font-bold" style={{ color }}>{cat.score}</div>
          </div>
        )
      })}
    </div>
  )
}
