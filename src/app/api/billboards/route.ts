import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { deriveBillboardStatus } from '@/lib/status'
import { generateReference } from '@/lib/reference'
import { buildBillboardWhere } from './where'
import { requireSession, parseOrBadRequest } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  const { error } = await requireSession()
  if (error) return error

  const where = buildBillboardWhere(req.nextUrl.searchParams)
  const billboards = await prisma.billboard.findMany({
    where,
    include: { contracts: { where: { status: 'ACTIVE' } } },
    orderBy: { createdAt: 'desc' },
  })

  const statusFilter = req.nextUrl.searchParams.get('status')
  const withStatus = billboards.map((b) => ({ ...b, status: deriveBillboardStatus(b) }))
  const filtered = statusFilter ? withStatus.filter((b) => b.status === statusFilter) : withStatus

  return NextResponse.json(filtered)
}

const createSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  city: z.string().min(1),
  dimension: z.enum(['D2X1', 'D4X3', 'D6X3', 'D8X3', 'D12X3']),
  sides: z.union([z.literal(1), z.literal(2)]),
})

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (session.user.role === 'USER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = parseOrBadRequest(createSchema, await req.json())
  if ('error' in parsed) return parsed.error
  const body = parsed.data

  const count = await prisma.billboard.count({ where: { city: body.city } })
  const reference = generateReference({ sequence: count + 1, city: body.city })

  try {
    const billboard = await prisma.billboard.create({
      data: { ...body, reference },
    })
    return NextResponse.json(billboard, { status: 201 })
  } catch (err) {
    // Reference is unique; under concurrent requests for the same city the
    // count-then-create sequence can race and collide. At this project's
    // scale (3 users, <500 billboards) a clean error is enough — no retry loop.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json(
        { error: 'Reference collision, please retry the request' },
        { status: 409 }
      )
    }
    throw err
  }
}
