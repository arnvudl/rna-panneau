import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { addMonths } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { requireSession, parseOrBadRequest, createApprovalRequest } from '@/lib/api-helpers'
import { isFaceAvailable } from '@/lib/contract-occupancy'

const createSchema = z.object({
  billboardId: z.string(),
  clientId: z.string(),
  startDate: z.string().datetime(),
  amount: z.number().positive(),
  durationMonths: z.number().int().positive().default(6),
  face: z.enum(['FACE_1', 'FACE_2', 'BOTH']).default('BOTH'),
})

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error

  const parsed = parseOrBadRequest(createSchema, await req.json())
  if ('error' in parsed) return parsed.error
  const body = parsed.data
  const startDate = new Date(body.startDate)
  const endDate = addMonths(startDate, body.durationMonths)

  if (session.user.role === 'USER') {
    // Contract for Task 8 (approvals API): CREATE_CONTRACT payload is always
    // shaped as { billboardId: string, clientId: string, startDate: string (ISO),
    // amount: number, durationMonths: number, endDate: string (ISO), face: 'FACE_1' |
    // 'FACE_2' | 'BOTH' } — startDate and endDate are pre-computed and serialized so
    // approval simply persists them.
    return createApprovalRequest(session, 'CREATE_CONTRACT', {
      billboardId: body.billboardId,
      clientId: body.clientId,
      startDate: startDate.toISOString(),
      amount: body.amount,
      durationMonths: body.durationMonths,
      endDate: endDate.toISOString(),
      face: body.face,
    })
  }

  const activeContracts = await prisma.contract.findMany({
    where: { billboardId: body.billboardId, status: 'ACTIVE' },
    select: { face: true },
  })
  if (!isFaceAvailable(body.face, activeContracts)) {
    return NextResponse.json({ error: 'Cette face du panneau est déjà louée' }, { status: 409 })
  }

  const contract = await prisma.contract.create({
    data: {
      billboardId: body.billboardId,
      clientId: body.clientId,
      face: body.face,
      startDate,
      endDate,
      amount: body.amount,
    },
  })
  return NextResponse.json(contract, { status: 201 })
}
