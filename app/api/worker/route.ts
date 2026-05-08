import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateScore } from '@/lib/score'
import { sendAuditReport } from '@/lib/email'

interface WorkerResult {
  checkId: string
  category: string
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP' | 'ERROR'
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  message?: string
  detail?: string
  fixSuggestion?: string
  duration?: number
}

interface WorkerPayload {
  auditId: string
  status: 'COMPLETE' | 'FAILED'
  stack: string[]
  results: WorkerResult[]
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-worker-secret')
  if (secret !== process.env.WORKER_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload: WorkerPayload = await req.json()
    const { auditId, status, stack, results } = payload

    if (status === 'FAILED') {
      await prisma.audit.update({
        where: { id: auditId },
        data: { status: 'FAILED', completedAt: new Date() },
      })
      return NextResponse.json({ ok: true })
    }

    await prisma.testResult.createMany({
      data: results.map((r) => ({
        auditId,
        checkId: r.checkId,
        category: r.category,
        status: r.status,
        severity: r.severity,
        message: r.message,
        detail: r.detail,
        fixSuggestion: r.fixSuggestion,
        duration: r.duration,
      })),
    })

    const score = calculateScore(results)

    await prisma.audit.update({
      where: { id: auditId },
      data: {
        status: 'COMPLETE',
        score,
        stack,
        completedAt: new Date(),
      },
    })

    await Promise.allSettled(
      results.map((r) =>
        prisma.check.upsert({
          where: { slug: r.checkId },
          update: {
            failCount: r.status === 'FAIL' ? { increment: 1 } : undefined,
            passCount: r.status === 'PASS' ? { increment: 1 } : undefined,
          },
          create: {
            slug: r.checkId,
            category: r.category,
            name: r.checkId,
            description: '',
            severity: r.severity,
            stacks: ['all'],
            failCount: r.status === 'FAIL' ? 1 : 0,
            passCount: r.status === 'PASS' ? 1 : 0,
          },
        })
      )
    )

    // Fire-and-forget email if user is logged in
    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_...') {
      const auditWithUser = await prisma.audit.findUnique({
        where: { id: auditId },
        include: { user: { select: { email: true } } },
      })
      if (auditWithUser?.user?.email) {
        sendAuditReport({
          to: auditWithUser.user.email,
          url: auditWithUser.url,
          auditId,
          score,
          results,
        }).catch(console.error)
      }
    }

    return NextResponse.json({ ok: true, score })
  } catch (err) {
    console.error('Worker callback error:', err)
    return NextResponse.json({ error: 'Failed to process results' }, { status: 500 })
  }
}
