'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { isValidUrl } from '@/lib/utils'

export function UrlInput() {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const trimmed = url.trim()
    const normalized = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`

    if (!isValidUrl(normalized)) {
      setError('Please enter a valid URL (e.g. https://yourapp.com)')
      return
    }

    if (normalized.includes('localhost') || normalized.includes('127.0.0.1')) {
      setError('We need a public URL — localhost is not accessible from our scanner')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalized }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to start audit')
      }
      const { id } = await res.json()
      router.push(`/audit/${id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to start audit. Try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="relative flex items-center gap-0">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError('') }}
            placeholder="https://yourapp.vercel.app"
            disabled={loading}
            autoFocus
            className="w-full h-14 px-5 pr-4 bg-[#111111] border border-[#2a2a2a] rounded-l-xl text-[#fafafa] placeholder-[#3a3a3a] font-mono text-base focus:outline-none focus:border-[#22c55e] transition-colors disabled:opacity-60"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="h-14 px-8 bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-[#1a3a28] disabled:text-[#2d6b47] text-black font-semibold rounded-r-xl transition-all whitespace-nowrap flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              <span>Starting...</span>
            </>
          ) : (
            'Run VibeCheck'
          )}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-[#ef4444] font-mono">{error}</p>
      )}

      <p className="mt-3 text-xs text-[#3a3a3a] text-center">
        No sign-up required · Public URL only · Results shared by default
      </p>
    </form>
  )
}
