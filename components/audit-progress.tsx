'use client'

import { useEffect, useState, useRef } from 'react'
import { TestResultCard } from './test-result-card'

interface AuditResult {
  id: string
  checkId: string
  category: string
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP' | 'ERROR'
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  message?: string
  detail?: string
  fixSuggestion?: string
  duration?: number
  name?: string
}

interface AuditProgressProps {
  auditId: string
  url: string
  onComplete: (score: number, results: AuditResult[]) => void
  onError: () => void
}

const CHECK_NAMES: Record<string, string> = {
  AUTH: 'Authentication', PAYMENTS: 'Payments', DATABASE: 'Database',
  API: 'API', FRONTEND: 'Frontend', MOBILE: 'Mobile',
  PERFORMANCE: 'Performance', SECURITY: 'Security', EMAIL: 'Email & Notifications',
}

export function AuditProgress({ auditId, url, onComplete, onError }: AuditProgressProps) {
  const [results, setResults] = useState<AuditResult[]>([])
  const [total, setTotal] = useState(100)
  const [status, setStatus] = useState<string>('RUNNING')
  const pollRef = useRef<NodeJS.Timeout>()
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/audit/${auditId}`)
        if (!res.ok) throw new Error('Poll failed')
        const data = await res.json()
        setResults(data.results || [])
        setStatus(data.status)

        if (data.status === 'COMPLETE') {
          clearInterval(pollRef.current)
          onComplete(data.score, data.results)
          return
        }
        if (data.status === 'FAILED') {
          clearInterval(pollRef.current)
          onError()
          return
        }
      } catch {
        // keep polling
      }
    }

    poll()
    pollRef.current = setInterval(poll, 2000)
    return () => clearInterval(pollRef.current)
  }, [auditId, onComplete, onError])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [results.length])

  const progress = Math.min((results.length / total) * 100, 95)
  const passCount = results.filter((r) => r.status === 'PASS').length
  const failCount = results.filter((r) => r.status === 'FAIL').length
  const warnCount = results.filter((r) => r.status === 'WARN').length

  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* URL being tested */}
      <div className="flex items-center gap-3 p-4 bg-[#111111] rounded-xl border border-[#1f1f1f]">
        <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
        <span className="font-mono text-sm text-[#71717a]">Scanning</span>
        <span className="font-mono text-sm text-[#fafafa] truncate">{url}</span>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-mono text-[#71717a]">
          <span>{results.length} / {total} checks</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1 bg-[#1f1f1f] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#22c55e] rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'PASS', count: passCount, color: '#22c55e' },
          { label: 'FAIL', count: failCount, color: '#ef4444' },
          { label: 'WARN', count: warnCount, color: '#f59e0b' },
        ].map((s) => (
          <div key={s.label} className="bg-[#111111] rounded-lg border border-[#1f1f1f] p-3 text-center">
            <p className="font-mono text-xs" style={{ color: s.color }}>{s.label}</p>
            <p className="font-mono text-2xl font-bold text-[#fafafa]">{s.count}</p>
          </div>
        ))}
      </div>

      {/* Live results feed */}
      <div ref={listRef} className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {results.slice().reverse().map((r) => (
          <TestResultCard
            key={r.id}
            checkId={r.checkId}
            category={r.category}
            name={r.name || r.checkId}
            status={r.status}
            severity={r.severity}
            message={r.message}
            detail={r.detail}
            fixSuggestion={r.fixSuggestion}
            duration={r.duration}
          />
        ))}
        {results.length === 0 && (
          <div className="text-center py-8 text-[#71717a] text-sm font-mono">
            Launching browser and running checks...
          </div>
        )}
      </div>
    </div>
  )
}
