import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ALL_CHECKS } from '@/lib/checks/registry'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const audit = await prisma.audit.findUnique({
      where: { id: params.id },
      include: {
        results: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    // Enrich results with check name from registry
    const enrichedResults = audit.results.map((r) => {
      const check = ALL_CHECKS.find((c) => c.id === r.checkId)
      return {
        ...r,
        name: check?.name || r.checkId,
      }
    })

    return NextResponse.json({
      ...audit,
      results: enrichedResults,
    })
  } catch (err) {
    console.error('Audit fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch audit' }, { status: 500 })
  }
}
