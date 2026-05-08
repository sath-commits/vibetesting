import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enqueueAudit } from '@/lib/queue'
import { isValidUrl } from '@/lib/utils'

const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000
const FREE_AUDITS_PER_DAY = 3

async function checkRateLimit(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS)
  const count = await prisma.audit.count({
    where: {
      createdAt: { gte: since },
    },
  })
  return count < FREE_AUDITS_PER_DAY * 100
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    if (!isValidUrl(url)) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      return NextResponse.json({ error: 'Public URL required — localhost not supported' }, { status: 400 })
    }

    const audit = await prisma.audit.create({
      data: {
        url,
        status: 'QUEUED',
        stack: [],
        isPublic: true,
      },
    })

    await enqueueAudit({ auditId: audit.id, url }).catch(async (err) => {
      console.error('Queue error — calling worker directly:', err)
      if (process.env.WORKER_URL) {
        fetch(`${process.env.WORKER_URL}/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-worker-secret': process.env.WORKER_SECRET || '',
          },
          body: JSON.stringify({ auditId: audit.id, url }),
        }).catch(console.error)
      }
    })

    return NextResponse.json({ id: audit.id }, { status: 201 })
  } catch (err) {
    console.error('Audit creation error:', err)
    return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 })
  }
}
