'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { VibeScore } from '@/components/vibe-score'
import { AuditProgress } from '@/components/audit-progress'
import { TestResultCard } from '@/components/test-result-card'
import { CategoryBreakdown } from '@/components/category-breakdown'
import { ShareCard } from '@/components/share-card'
import { calculateScore } from '@/lib/score'
import { formatUrl } from '@/lib/utils'
import Link from 'next/link'

type AuditStatus = 'QUEUED' | 'RUNNING' | 'COMPLETE' | 'FAILED'

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

interface AuditData {
  id: string
  url: string
  status: AuditStatus
  score?: number
  results: AuditResult[]
  createdAt: string
  completedAt?: string
  stack: string[]
}

type FilterStatus = 'ALL' | 'FAIL' | 'WARN' | 'PASS' | 'SKIP' | 'ERROR'
type FilterCategory = 'ALL' | string

export default function AuditPage() {
  const { id } = useParams<{ id: string }>()
  const [audit, setAudit] = useState<AuditData | null>(null)
  const [pageStatus, setPageStatus] = useState<'loading' | 'running' | 'complete' | 'error'>('loading')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL')
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('ALL')

  useEffect(() => {
    fetch(`/api/audit/${id}`)
      .then((r) => r.json())
      .then((data: AuditData) => {
        setAudit(data)
        if (data.status === 'COMPLETE') setPageStatus('complete')
        else if (data.status === 'FAILED') setPageStatus('error')
        else setPageStatus('running')
      })
      .catch(() => setPageStatus('error'))
  }, [id])

  const handleComplete = (score: number, results: AuditResult[]) => {
    setAudit((prev) => prev ? { ...prev, status: 'COMPLETE', score, results } : prev)
    setPageStatus('complete')
  }

  const handleError = () => setPageStatus('error')

  if (pageStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#1f1f1f] border-t-[#22c55e] rounded-full animate-spin" />
      </div>
    )
  }

  const filteredResults = (audit?.results || []).filter((r) => {
    if (filterStatus !== 'ALL' && r.status !== filterStatus) return false
    if (filterCategory !== 'ALL' && r.category !== filterCategory) return false
    return true
  })

  const categories = Array.from(new Set((audit?.results || []).map((r) => r.category)))

  const categoryData = categories.map((cat) => {
    const catResults = (audit?.results || []).filter((r) => r.category === cat && r.status !== 'SKIP')
    const score = calculateScore(catResults)
    return {
      category: cat,
      pass: catResults.filter((r) => r.status === 'PASS').length,
      fail: catResults.filter((r) => r.status === 'FAIL').length,
      warn: catResults.filter((r) => r.status === 'WARN').length,
      skip: (audit?.results || []).filter((r) => r.category === cat && r.status === 'SKIP').length,
      score,
    }
  })

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b border-[#1f1f1f] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-mono font-bold text-lg text-[#fafafa]">
            Vibe<span className="text-[#22c55e]">Check</span>
          </Link>
          <Link href="/" className="text-sm text-[#71717a] hover:text-[#fafafa] transition-colors">
            ← New audit
          </Link>
        </div>
      </nav>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        {/* Running state */}
        {pageStatus === 'running' && audit && (
          <div className="flex flex-col items-center gap-8">
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-[#fafafa] mb-2">Running checks</h1>
              <p className="text-sm text-[#71717a] font-mono">{formatUrl(audit.url)}</p>
            </div>
            <AuditProgress
              auditId={id}
              url={audit.url}
              onComplete={handleComplete}
              onError={handleError}
            />
          </div>
        )}

        {/* Error state */}
        {pageStatus === 'error' && (
          <div className="flex flex-col items-center text-center gap-6 py-20">
            <div className="w-16 h-16 rounded-full bg-[#2a0f0f] flex items-center justify-center text-2xl">
              ✗
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[#ef4444] mb-2">Audit failed</h1>
              <p className="text-[#71717a] mb-1">We could not reach or scan this URL.</p>
              <p className="text-sm text-[#3a3a3a]">Common reasons:</p>
            </div>
            <ul className="text-sm text-[#71717a] space-y-1">
              <li>The URL is behind a login page</li>
              <li>The site is blocking automated browsers</li>
              <li>The URL returned a server error</li>
              <li>The site took too long to respond</li>
            </ul>
            <Link
              href="/"
              className="px-6 py-3 bg-[#22c55e] text-black font-semibold rounded-lg hover:bg-[#16a34a] transition-colors"
            >
              Try another URL
            </Link>
          </div>
        )}

        {/* Complete state */}
        {pageStatus === 'complete' && audit && audit.score !== undefined && (
          <div className="space-y-12">
            {/* Score hero */}
            <div className="flex flex-col items-center gap-6 py-8">
              <p className="font-mono text-sm text-[#71717a]">{formatUrl(audit.url)}</p>
              <VibeScore score={audit.score} animate />
              <div className="no-print">
                <ShareCard auditId={audit.id} url={audit.url} score={audit.score} />
              </div>
              <button
                onClick={() => window.print()}
                className="no-print text-xs text-[#71717a] border border-[#1f1f1f] px-4 py-2 rounded-lg hover:border-[#2a2a2a] hover:text-[#fafafa] transition-colors font-mono"
              >
                Download PDF
              </button>
            </div>

            {/* Stack detected */}
            {audit.stack.length > 0 && (
              <div className="p-4 bg-[#111111] border border-[#1f1f1f] rounded-xl">
                <p className="text-xs text-[#71717a] font-mono mb-2">Stack detected</p>
                <div className="flex flex-wrap gap-2">
                  {audit.stack.map((s) => (
                    <span key={s} className="px-2 py-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-xs font-mono text-[#fafafa]">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Category breakdown */}
            <div className="p-6 bg-[#111111] border border-[#1f1f1f] rounded-xl">
              <h2 className="font-semibold text-[#fafafa] mb-6">Score by category</h2>
              <CategoryBreakdown data={categoryData} />
            </div>

            {/* Results table */}
            <div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <h2 className="font-semibold text-[#fafafa]">
                  All results
                  <span className="ml-2 font-mono text-xs text-[#71717a]">({filteredResults.length})</span>
                </h2>
                <div className="no-print flex flex-wrap gap-2">
                  {(['ALL', 'FAIL', 'WARN', 'PASS', 'SKIP'] as FilterStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(s)}
                      className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors ${
                        filterStatus === s
                          ? 'bg-[#22c55e] text-black'
                          : 'bg-[#111111] border border-[#1f1f1f] text-[#71717a] hover:border-[#2a2a2a]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {categories.length > 1 && (
                <div className="no-print flex flex-wrap gap-2 mb-4">
                  {(['ALL', ...categories] as string[]).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setFilterCategory(cat)}
                      className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors ${
                        filterCategory === cat
                          ? 'bg-[#1f1f1f] text-[#fafafa] border border-[#3a3a3a]'
                          : 'bg-[#111111] border border-[#1f1f1f] text-[#3a3a3a] hover:border-[#2a2a2a]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                {filteredResults.map((r) => (
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
                {filteredResults.length === 0 && (
                  <p className="text-center py-12 text-[#71717a] text-sm font-mono">No results match this filter</p>
                )}
              </div>
            </div>

            <div className="no-print text-center py-8 border-t border-[#1f1f1f]">
              <p className="text-sm text-[#71717a] mb-3">Missing a check?</p>
              <Link href="/suggest" className="text-[#22c55e] text-sm hover:underline">
                Suggest a failure mode →
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
