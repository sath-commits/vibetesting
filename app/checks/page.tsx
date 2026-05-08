'use client'

import { useState } from 'react'
import { ALL_CHECKS, CHECK_CATEGORIES } from '@/lib/checks/registry'
import type { CheckCategory } from '@/lib/checks/types'
import Link from 'next/link'

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

export default function ChecksPage() {
  const [filterCategory, setFilterCategory] = useState<CheckCategory | 'ALL'>('ALL')
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL')
  const [search, setSearch] = useState('')

  const filtered = ALL_CHECKS
    .filter((c) => filterCategory === 'ALL' || c.category === filterCategory)
    .filter((c) => filterSeverity === 'ALL' || c.severity === filterSeverity)
    .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])

  const SEVERITY_COLORS: Record<string, string> = {
    CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#71717a',
  }

  const categories = Object.entries(CHECK_CATEGORIES)

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b border-[#1f1f1f] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-mono font-bold text-lg text-[#fafafa]">
            Vibe<span className="text-[#22c55e]">Check</span>
          </Link>
          <div className="flex items-center gap-6 text-sm text-[#71717a]">
            <Link href="/checks" className="text-[#fafafa]">100 Checks</Link>
            <Link href="/suggest" className="hover:text-[#fafafa] transition-colors">Suggest</Link>
            <Link href="/" className="hover:text-[#fafafa] transition-colors">Run audit</Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-[#fafafa] mb-2">All 100 checks</h1>
          <p className="text-[#71717a]">Every check VibeCheck runs against your app. Filterable by category and severity.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search checks..."
            className="flex-1 h-10 px-4 bg-[#111111] border border-[#1f1f1f] rounded-lg text-sm text-[#fafafa] placeholder-[#3a3a3a] focus:outline-none focus:border-[#2a2a2a]"
          />
          <div className="flex gap-2 flex-wrap">
            {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors ${
                  filterSeverity === sev
                    ? 'bg-[#22c55e] text-black'
                    : 'bg-[#111111] border border-[#1f1f1f] text-[#71717a] hover:border-[#2a2a2a]'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setFilterCategory('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
              filterCategory === 'ALL' ? 'bg-[#1f1f1f] text-[#fafafa] border border-[#3a3a3a]' : 'text-[#71717a] hover:text-[#fafafa]'
            }`}
          >
            All ({ALL_CHECKS.length})
          </button>
          {categories.map(([key, cat]) => {
            const count = ALL_CHECKS.filter((c) => c.category === key).length
            return (
              <button
                key={key}
                onClick={() => setFilterCategory(key as CheckCategory)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                  filterCategory === key ? 'bg-[#1f1f1f] text-[#fafafa] border border-[#3a3a3a]' : 'text-[#71717a] hover:text-[#fafafa]'
                }`}
              >
                {cat.label} ({count})
              </button>
            )
          })}
        </div>

        {/* Results count */}
        <p className="text-xs font-mono text-[#3a3a3a] mb-4">{filtered.length} checks</p>

        {/* Checks list */}
        <div className="space-y-2">
          {filtered.map((check) => (
            <div
              key={check.id}
              className="p-4 bg-[#111111] border border-[#1f1f1f] rounded-xl hover:border-[#2a2a2a] transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs text-[#3a3a3a]">{check.id}</span>
                    <span className="text-[#2a2a2a]">·</span>
                    <span className="text-xs text-[#71717a]">{CHECK_CATEGORIES[check.category as CheckCategory]?.label || check.category}</span>
                  </div>
                  <h3 className="text-sm font-medium text-[#fafafa] mb-1">{check.name}</h3>
                  <p className="text-xs text-[#71717a] leading-relaxed">{check.description}</p>
                  {check.stacks.length > 0 && !check.stacks.includes('all') && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {check.stacks.map((s) => (
                        <span key={s} className="px-1.5 py-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-[10px] font-mono text-[#71717a]">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
                <span
                  className="font-mono text-xs px-2 py-0.5 rounded shrink-0"
                  style={{ color: SEVERITY_COLORS[check.severity], background: SEVERITY_COLORS[check.severity] + '18' }}
                >
                  {check.severity}
                </span>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-[#71717a]">
            <p className="text-sm font-mono">No checks match your filters</p>
          </div>
        )}

        <div className="mt-12 text-center">
          <p className="text-sm text-[#71717a] mb-3">Know a failure mode we missed?</p>
          <Link href="/suggest" className="text-[#22c55e] text-sm hover:underline">Suggest a check →</Link>
        </div>
      </main>
    </div>
  )
}
