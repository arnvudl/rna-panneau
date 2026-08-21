import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { addMonths } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

const createSchema = z.object({
  billboardId: z.string(),
  clientId: z.string(),
  startDate: z.string().datetime(),
  amount: z.number().positive(),
  durationMonths: z.number().int().positive().default(6),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = createSchema.safeParse(await req.json())
  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: result.error.flatten() },
      { status: 400 }
    )
  }
  const body = result.data
  const startDate = new Date(body.startDate)
  const endDate = addMonths(startDate, body.durationMonths)

  if (session.user.role === 'USER') {
    // Contract for Task 8 (approvals API): CREATE_CONTRACT payload is always
    // shaped as { billboardId: string, clientId: string, startDate: string (ISO),
    // amount: number, durationMonths: number, endDate: string (ISO) } — startDate
    // and endDate are pre-computed and serialized so approval simply persists them.
    const request = await prisma.approvalRequest.create({
      data: {
        requestedById: session.user.id,
        type: 'CREATE_CONTRACT',
        payload: {
          billboardId: body.billboardId,
          clientId: body.clientId,
          startDate: startDate.toISOString(),
          amount: body.amount,
          durationMonths: body.durationMonths,
          endDate: endDate.toISOString(),
        },
      },
    })
    return NextResponse.json(request, { status: 202 })
  }

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
