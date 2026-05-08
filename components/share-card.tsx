'use client'

import { useState } from 'react'
import { getScoreBand, getScoreColor } from '@/lib/score'
import { formatUrl } from '@/lib/utils'

interface ShareCardProps {
  auditId: string
  url: string
  score: number
}

export function ShareCard({ auditId, url, score }: ShareCardProps) {
  const [copied, setCopied] = useState(false)
  const band = getScoreBand(score)
  const color = getScoreColor(score)

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/audit/${auditId}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tweetText = encodeURIComponent(
    `My app got a ${score}/100 Vibe Score on VibeCheck — "${band.label}"\n\nRun 100 pre-launch checks on your app:`
  )
  const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(shareUrl)}`

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3">
      <button
        onClick={handleCopy}
        className="flex items-center gap-2 px-4 py-2 bg-[#111111] hover:bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-sm font-mono transition-colors"
      >
        {copied ? (
          <span className="text-[#22c55e]">✓ Copied</span>
        ) : (
          <span className="text-[#71717a]">Copy link</span>
        )}
      </button>
      <a
        href={tweetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-4 py-2 bg-[#111111] hover:bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-sm font-mono transition-colors text-[#71717a] hover:text-[#fafafa]"
      >
        Share on 𝕏
      </a>
    </div>
  )
}
