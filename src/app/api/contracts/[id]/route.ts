import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

const patchSchema = z.object({
  status: z.enum(['ACTIVE', 'EXPIRED', 'TERMINATED']).optional(),
  endDate: z.string().datetime().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = patchSchema.safeParse(await req.json())
  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: result.error.flatten() },
      { status: 400 }
    )
  }
  const body = result.data
  const data = { ...body, endDate: body.endDate ? new Date(body.endDate) : undefined }

  if (session.user.role === 'USER') {
    // Contract for Task 8 (approvals API): EDIT_CONTRACT payload is always
    // shaped as { contractId: string, status?: 'ACTIVE'|'EXPIRED'|'TERMINATED',
    // endDate?: string (ISO) } — only the fields the caller actually sent are
    // included alongside contractId.
    const request = await prisma.approvalRequest.create({
      data: {
        requestedById: session.user.id,
        type: 'EDIT_CONTRACT',
        payload: { contractId: params.id, ...body },
      },
    })
    return NextResponse.json(request, { status: 202 })
  }

  const contract = await prisma.contract.update({ where: { id: params.id }, data })
  return NextResponse.json(contract)
}
