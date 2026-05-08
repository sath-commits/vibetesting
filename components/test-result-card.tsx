'use client'

import { useState } from 'react'

interface TestResultCardProps {
  checkId: string
  category: string
  name: string
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP' | 'ERROR'
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  message?: string
  detail?: string
  fixSuggestion?: string
  duration?: number
}

const STATUS_CONFIG = {
  PASS:  { label: 'PASS',  color: '#22c55e', bg: 'bg-[#0f2a18]' },
  FAIL:  { label: 'FAIL',  color: '#ef4444', bg: 'bg-[#2a0f0f]' },
  WARN:  { label: 'WARN',  color: '#f59e0b', bg: 'bg-[#2a1f0f]' },
  SKIP:  { label: 'SKIP',  color: '#71717a', bg: 'bg-[#1a1a1a]' },
  ERROR: { label: 'ERROR', color: '#a855f7', bg: 'bg-[#1f0f2a]' },
}

const SEVERITY_CONFIG = {
  CRITICAL: { label: 'CRITICAL', color: '#ef4444' },
  HIGH:     { label: 'HIGH',     color: '#f97316' },
  MEDIUM:   { label: 'MEDIUM',   color: '#f59e0b' },
  LOW:      { label: 'LOW',      color: '#71717a' },
}

export function TestResultCard({
  checkId, category, name, status, severity, message, detail, fixSuggestion, duration,
}: TestResultCardProps) {
  const [expanded, setExpanded] = useState(false)
  const sc = STATUS_CONFIG[status]
  const sev = SEVERITY_CONFIG[severity]
  const isExpandable = (detail || fixSuggestion) && status !== 'PASS' && status !== 'SKIP'

  return (
    <div
      className={`rounded-lg border border-[#1f1f1f] ${sc.bg} p-4 transition-all`}
      onClick={() => isExpandable && setExpanded((e) => !e)}
      style={{ cursor: isExpandable ? 'pointer' : 'default' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className="font-mono text-xs font-bold px-2 py-0.5 rounded border mt-0.5 shrink-0"
            style={{ color: sc.color, borderColor: sc.color + '40', background: sc.color + '15' }}
          >
            {sc.label}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#fafafa] leading-snug">{name}</p>
            {message && <p className="text-xs text-[#71717a] mt-0.5 leading-snug">{message}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="font-mono text-xs px-1.5 py-0.5 rounded"
            style={{ color: sev.color, background: sev.color + '18' }}
          >
            {sev.label}
          </span>
          {isExpandable && (
            <span className="text-[#3a3a3a] text-xs">{expanded ? '▲' : '▼'}</span>
          )}
        </div>
      </div>

      {isExpandable && (
        <div className={`mt-3 pt-3 border-t border-[#2a2a2a] space-y-2 ${expanded ? '' : 'hidden print:block'}`}>
          {detail && (
            <div>
              <p className="text-xs text-[#71717a] font-mono mb-1">Detail</p>
              <pre className="text-xs text-[#fafafa] bg-[#0a0a0a] rounded p-2 overflow-x-auto whitespace-pre-wrap">{detail}</pre>
            </div>
          )}
          {fixSuggestion && (
            <div className="flex gap-2">
              <span className="text-[#22c55e] shrink-0 mt-0.5">→</span>
              <p className="text-xs text-[#a0a0a0]">{fixSuggestion}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mt-2">
        <span className="font-mono text-[10px] text-[#2a2a2a]">{checkId}</span>
        <span className="text-[#2a2a2a] text-[10px]">·</span>
        <span className="font-mono text-[10px] text-[#2a2a2a]">{category}</span>
        {duration && (
          <>
            <span className="text-[#2a2a2a] text-[10px]">·</span>
            <span className="font-mono text-[10px] text-[#2a2a2a]">{duration}ms</span>
          </>
        )}
      </div>
    </div>
  )
}
