import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')
  const clients = await prisma.client.findMany({
    where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(clients)
}

const createSchema = z.object({ name: z.string().min(1), contactInfo: z.string().optional() })

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = createSchema.safeParse(await req.json())
  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: result.error.flatten() },
      { status: 400 }
    )
  }

  const client = await prisma.client.create({ data: result.data })
  return NextResponse.json(client, { status: 201 })
}
