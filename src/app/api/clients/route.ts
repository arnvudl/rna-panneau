import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession, parseOrBadRequest } from '@/lib/api-helpers'
import { getPermission } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const { error } = await requireSession()
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')
  const clients = await prisma.client.findMany({
    where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(clients)
}

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
})

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (getPermission(session.user.role, 'create_client') === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = parseOrBadRequest(createSchema, await req.json())
  if ('error' in parsed) return parsed.error

  const client = await prisma.client.create({ data: parsed.data })
  return NextResponse.json(client, { status: 201 })
}
