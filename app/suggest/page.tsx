'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CHECK_CATEGORIES } from '@/lib/checks/registry'

export default function SuggestPage() {
  const [form, setForm] = useState({ title: '', description: '', category: '', email: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const categories = Object.entries(CHECK_CATEGORIES)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.description || !form.category) return
    setStatus('loading')
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      setStatus('success')
    } catch {
      setStatus('error')
    }
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
            <Link href="/" className="hover:text-[#fafafa] transition-colors">Run audit</Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-[#fafafa] mb-2">Suggest a check</h1>
          <p className="text-[#71717a]">
            Found a failure mode we missed? We review every suggestion and add the best ones to the registry.
          </p>
        </div>

        {status === 'success' ? (
          <div className="p-8 bg-[#0f2a18] border border-[#1a4a28] rounded-xl text-center">
            <p className="text-2xl mb-3">✓</p>
            <h2 className="text-lg font-semibold text-[#22c55e] mb-2">Thanks for the suggestion</h2>
            <p className="text-sm text-[#71717a] mb-6">We review every submission. Good ones become checks.</p>
            <Link href="/" className="text-[#22c55e] text-sm hover:underline">Run an audit →</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#fafafa] mb-2">
                Title <span className="text-[#ef4444]">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Form submits without CAPTCHA on signup"
                maxLength={120}
                required
                className="w-full h-10 px-4 bg-[#111111] border border-[#1f1f1f] rounded-lg text-sm text-[#fafafa] placeholder-[#3a3a3a] focus:outline-none focus:border-[#2a2a2a]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#fafafa] mb-2">
                Description <span className="text-[#ef4444]">*</span>
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe the failure mode, why it matters, and ideally how it can be detected automatically..."
                maxLength={1000}
                required
                rows={5}
                className="w-full px-4 py-3 bg-[#111111] border border-[#1f1f1f] rounded-lg text-sm text-[#fafafa] placeholder-[#3a3a3a] focus:outline-none focus:border-[#2a2a2a] resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#fafafa] mb-2">
                Category <span className="text-[#ef4444]">*</span>
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                required
                className="w-full h-10 px-4 bg-[#111111] border border-[#1f1f1f] rounded-lg text-sm text-[#fafafa] focus:outline-none focus:border-[#2a2a2a]"
              >
                <option value="" disabled>Select category</option>
                {categories.map(([key, cat]) => (
                  <option key={key} value={key}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#71717a] mb-2">
                Your email (optional)
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="we'll credit you if it ships"
                className="w-full h-10 px-4 bg-[#111111] border border-[#1f1f1f] rounded-lg text-sm text-[#fafafa] placeholder-[#3a3a3a] focus:outline-none focus:border-[#2a2a2a]"
              />
            </div>

            {status === 'error' && (
              <p className="text-sm text-[#ef4444] font-mono">Something went wrong. Try again.</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading' || !form.title || !form.description || !form.category}
              className="w-full h-11 bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-[#1a3a28] disabled:text-[#2d6b47] text-black font-semibold rounded-lg transition-all"
            >
              {status === 'loading' ? 'Submitting...' : 'Submit suggestion'}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}
