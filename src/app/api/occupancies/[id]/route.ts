import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession, parseOrBadRequest, createApprovalRequest } from '@/lib/api-helpers'

const patchSchema = z.object({
  status: z.enum(['ACTIVE', 'TERMINATED']).optional(),
  endDate: z.string().datetime().nullable().optional(),
  contractRef: z.string().trim().max(200).nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error

  const parsed = parseOrBadRequest(patchSchema, await req.json())
  if ('error' in parsed) return parsed.error
  const body = parsed.data
  const data = { ...body, endDate: body.endDate === undefined ? undefined : body.endDate ? new Date(body.endDate) : null }

  if (session.user.role === 'USER') {
    // Contract for the approvals API: EDIT_OCCUPANCY payload is always shaped
    // as { occupancyId: string, status?: 'ACTIVE'|'TERMINATED', endDate?:
    // string (ISO) | null, contractRef?: string | null } — only the fields
    // the caller actually sent are included alongside occupancyId.
    return createApprovalRequest(session, 'EDIT_OCCUPANCY', { occupancyId: params.id, ...body })
  }

  const occupancy = await prisma.occupancy.update({ where: { id: params.id }, data })
  return NextResponse.json(occupancy)
}
