import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession, parseOrBadRequest, createApprovalRequest } from '@/lib/api-helpers'

const patchSchema = z.object({
  status: z.enum(['ACTIVE', 'EXPIRED', 'TERMINATED']).optional(),
  endDate: z.string().datetime().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error

  const parsed = parseOrBadRequest(patchSchema, await req.json())
  if ('error' in parsed) return parsed.error
  const body = parsed.data
  const data = { ...body, endDate: body.endDate ? new Date(body.endDate) : undefined }

  if (session.user.role === 'USER') {
    // Contract for Task 8 (approvals API): EDIT_CONTRACT payload is always
    // shaped as { contractId: string, status?: 'ACTIVE'|'EXPIRED'|'TERMINATED',
    // endDate?: string (ISO) } — only the fields the caller actually sent are
    // included alongside contractId.
    return createApprovalRequest(session, 'EDIT_CONTRACT', { contractId: params.id, ...body })
  }

  const contract = await prisma.contract.update({ where: { id: params.id }, data })
  return NextResponse.json(contract)
}
