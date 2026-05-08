import { prisma } from '@/lib/prisma'
import { getScoreColor, getScoreBand } from '@/lib/score'
import { formatUrl, timeAgo } from '@/lib/utils'
import Link from 'next/link'

export default async function DashboardPage() {
  let audits: any[] = []
  try {
    audits = await prisma.audit.findMany({
      where: { isPublic: true, status: 'COMPLETE' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, url: true, score: true, createdAt: true, stack: true, status: true },
    })
  } catch {}

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b border-[#1f1f1f] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-mono font-bold text-lg text-[#fafafa]">
            Vibe<span className="text-[#22c55e]">Check</span>
          </Link>
          <div className="flex items-center gap-6 text-sm text-[#71717a]">
            <Link href="/checks" className="hover:text-[#fafafa] transition-colors">100 Checks</Link>
            <Link href="/" className="hover:text-[#fafafa] transition-colors">Run audit</Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-[#fafafa] mb-2">Recent audits</h1>
          <p className="text-[#71717a]">Public audit results from the community.</p>
        </div>

        {audits.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#71717a] mb-4">No audits yet.</p>
            <Link href="/" className="text-[#22c55e] text-sm hover:underline">Run the first audit →</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {audits.map((audit) => {
              const score = audit.score ?? 0
              const color = getScoreColor(score)
              const band = getScoreBand(score)
              return (
                <Link
                  key={audit.id}
                  href={`/audit/${audit.id}`}
                  className="flex items-center gap-4 p-4 bg-[#111111] border border-[#1f1f1f] rounded-xl hover:border-[#2a2a2a] transition-all group"
                >
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center font-mono font-bold text-sm shrink-0"
                    style={{ background: color + '18', color }}
                  >
                    {score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-[#fafafa] truncate">{formatUrl(audit.url)}</p>
                    <p className="text-xs font-mono mt-0.5" style={{ color }}>{band.label}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {audit.stack.slice(0, 3).map((s: string) => (
                      <span key={s} className="px-1.5 py-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-[10px] font-mono text-[#71717a] hidden sm:inline">{s}</span>
                    ))}
                    <span className="text-xs text-[#3a3a3a] font-mono">{timeAgo(audit.createdAt)}</span>
                    <span className="text-[#3a3a3a] group-hover:text-[#71717a] transition-colors text-xs">→</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
