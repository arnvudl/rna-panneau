import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { addMonths } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { requireSession, parseOrBadRequest, createApprovalRequest } from '@/lib/api-helpers'

const createSchema = z.object({
  billboardId: z.string(),
  clientId: z.string(),
  startDate: z.string().datetime(),
  amount: z.number().positive(),
  durationMonths: z.number().int().positive().default(6),
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
    // amount: number, durationMonths: number, endDate: string (ISO) } — startDate
    // and endDate are pre-computed and serialized so approval simply persists them.
    return createApprovalRequest(session, 'CREATE_CONTRACT', {
      billboardId: body.billboardId,
      clientId: body.clientId,
      startDate: startDate.toISOString(),
      amount: body.amount,
      durationMonths: body.durationMonths,
      endDate: endDate.toISOString(),
    })
  }

  // Known limitation (documented, not fixed, per current project scale): there is
  // no guard preventing two overlapping ACTIVE contracts on the same billboard.
  // Revisit if double-booking becomes an observed problem.
  const contract = await prisma.contract.create({
    data: {
      billboardId: body.billboardId,
      clientId: body.clientId,
      startDate,
      endDate,
      amount: body.amount,
    },
  })
  return NextResponse.json(contract, { status: 201 })
}
