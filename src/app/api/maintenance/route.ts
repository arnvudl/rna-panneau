import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession, parseOrBadRequest } from '@/lib/api-helpers'

const createSchema = z.object({
  billboardId: z.string(),
  date: z.string().datetime(),
  type: z.string().min(1),
  comment: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error

  const parsed = parseOrBadRequest(createSchema, await req.json())
  if ('error' in parsed) return parsed.error
  const body = parsed.data

  // No approval-gating here: any authenticated user (any role) may log a
  // maintenance visit, per the design spec.
  const record = await prisma.maintenanceRecord.create({
    data: { ...body, date: new Date(body.date), technicianId: session.user.id },
  })
  return NextResponse.json(record, { status: 201 })
}
