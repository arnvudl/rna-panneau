import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession, parseOrBadRequest } from '@/lib/api-helpers'

export async function GET() {
  const { error } = await requireSession()
  if (error) return error

  const prefixes = await prisma.cityPrefix.findMany({ orderBy: { city: 'asc' } })
  return NextResponse.json(prefixes)
}

const upsertSchema = z.object({
  city: z.string().trim().min(1),
  prefix: z
    .string()
    .trim()
    .min(2)
    .max(6)
    .transform((s) => s.toUpperCase()),
})

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (session.user.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = parseOrBadRequest(upsertSchema, await req.json())
  if ('error' in parsed) return parsed.error

  const entry = await prisma.cityPrefix.upsert({
    where: { city: parsed.data.city },
    update: { prefix: parsed.data.prefix },
    create: parsed.data,
  })
  return NextResponse.json(entry, { status: 201 })
}
