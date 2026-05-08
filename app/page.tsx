import { UrlInput } from '@/components/url-input'
import { prisma } from '@/lib/prisma'
import { CHECK_CATEGORIES } from '@/lib/checks/registry'
import Link from 'next/link'

async function getStats() {
  try {
    const [auditCount, failCount] = await Promise.all([
      prisma.audit.count({ where: { status: 'COMPLETE' } }),
      prisma.testResult.count({ where: { status: 'FAIL' } }),
    ])
    return { auditCount, failCount }
  } catch {
    return { auditCount: 0, failCount: 0 }
  }
}

export default async function HomePage() {
  const stats = await getStats()
  const categories = Object.entries(CHECK_CATEGORIES)

  const CATEGORY_ICONS: Record<string, string> = {
    AUTH: '🔐', PAYMENTS: '💳', DATABASE: '🗄️', API: '⚡',
    FRONTEND: '🖥️', MOBILE: '📱', PERFORMANCE: '🚀', SECURITY: '🛡️', EMAIL: '📧',
  }

  const CATEGORY_COUNTS: Record<string, number> = {
    AUTH: 18, PAYMENTS: 14, DATABASE: 10, API: 12,
    FRONTEND: 14, MOBILE: 10, PERFORMANCE: 8, SECURITY: 8, EMAIL: 6,
  }

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b border-[#1f1f1f] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-mono font-bold text-lg text-[#fafafa]">
            Vibe<span className="text-[#22c55e]">Check</span>
          </Link>
          <div className="flex items-center gap-6 text-sm text-[#71717a]">
            <Link href="/checks" className="hover:text-[#fafafa] transition-colors">100 Checks</Link>
            <Link href="/suggest" className="hover:text-[#fafafa] transition-colors">Suggest</Link>
            <Link href="/dashboard" className="hover:text-[#fafafa] transition-colors">Dashboard</Link>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#0f2a18] border border-[#1a4a28] rounded-full text-xs font-mono text-[#22c55e] mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
            100 automated pre-launch checks
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-[#fafafa] leading-tight tracking-tight mb-6">
            Ship without<br />
            <span className="text-[#22c55e]">embarrassment</span>
          </h1>

          <p className="text-lg text-[#71717a] max-w-xl mb-12 leading-relaxed">
            Paste your staging URL. We run 100 pre-launch checks across auth, payments,
            mobile, performance, and security. No code access needed.
          </p>

          <UrlInput />

          {stats.auditCount > 0 && (
            <p className="mt-8 text-sm text-[#3a3a3a] font-mono">
              {stats.auditCount.toLocaleString()} audits run &middot;{' '}
              {stats.failCount.toLocaleString()} issues caught
            </p>
          )}
        </section>

        <section className="border-t border-[#1f1f1f]">
          <div className="max-w-6xl mx-auto px-6 py-20">
            <h2 className="text-2xl font-semibold text-[#fafafa] text-center mb-3">What we check</h2>
            <p className="text-[#71717a] text-center mb-12">9 categories. 100 checks. All automated.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map(([key, cat]) => (
                <Link
                  key={key}
                  href={`/checks?category=${key}`}
                  className="group p-5 bg-[#111111] border border-[#1f1f1f] rounded-xl hover:border-[#2a2a2a] transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-2xl">{CATEGORY_ICONS[key]}</span>
                    <span className="font-mono text-xs text-[#3a3a3a] group-hover:text-[#22c55e] transition-colors">
                      {CATEGORY_COUNTS[key]} checks
                    </span>
                  </div>
                  <h3 className="font-semibold text-[#fafafa] mb-1">{cat.label}</h3>
                  <p className="text-xs text-[#71717a] leading-relaxed">{cat.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-[#1f1f1f]">
          <div className="max-w-3xl mx-auto px-6 py-20">
            <h2 className="text-2xl font-semibold text-[#fafafa] text-center mb-12">FAQ</h2>
            <div className="space-y-6">
              {[
                ['Do you store my code?', 'No. We never access your source code. We only visit your public URL with a headless browser, just like a user would.'],
                ['Does it work on localhost?', 'No. We need a publicly accessible URL. Use a staging deployment on Vercel, Railway, or Fly.io.'],
                ['Is it free?', 'Yes, to start. 3 audits per day without signing in. Upgrade for unlimited audits, private results, and audit history.'],
                ['How long does an audit take?', 'About 3-5 minutes. We run 100 checks including full page loads, mobile viewport tests, and performance measurements.'],
                ['Can I run it on a password-protected staging site?', 'Not yet. The scanner is unauthenticated. If your staging site is behind auth, the scan will reflect that.'],
              ].map(([q, a]) => (
                <div key={q} className="border-b border-[#1f1f1f] pb-6">
                  <h3 className="font-medium text-[#fafafa] mb-2">{q}</h3>
                  <p className="text-sm text-[#71717a] leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#1f1f1f] px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-mono text-sm text-[#3a3a3a]">VibeCheck</span>
          <div className="flex items-center gap-6 text-sm text-[#3a3a3a]">
            <Link href="/checks" className="hover:text-[#71717a] transition-colors">All 100 checks</Link>
            <Link href="/suggest" className="hover:text-[#71717a] transition-colors">Suggest a check</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
