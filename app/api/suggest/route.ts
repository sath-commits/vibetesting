import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { title, description, category, email } = await req.json()

    if (!title || !description || !category) {
      return NextResponse.json({ error: 'title, description, and category are required' }, { status: 400 })
    }

    let userId: string | undefined
    if (email) {
      const user = await prisma.user.findUnique({ where: { email } })
      userId = user?.id
    }

    await prisma.failureSuggestion.create({
      data: { title, description, category, userId },
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    console.error('Suggest error:', err)
    return NextResponse.json({ error: 'Failed to save suggestion' }, { status: 500 })
  }
}
