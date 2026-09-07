import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession, parseOrBadRequest, createApprovalRequest } from '@/lib/api-helpers'
import { getPermission } from '@/lib/permissions'
import { isFaceAvailable } from '@/lib/face-occupancy'

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

  if (getPermission(session.user.role, 'edit_occupancy') === 'requires_approval') {
    // Contract for the approvals API: EDIT_OCCUPANCY payload is always shaped
    // as { occupancyId: string, status?: 'ACTIVE'|'TERMINATED', endDate?:
    // string (ISO) | null, contractRef?: string | null } — only the fields
    // the caller actually sent are included alongside occupancyId.
    return createApprovalRequest(session, 'EDIT_OCCUPANCY', { occupancyId: params.id, ...body })
  }

  const existing = await prisma.occupancy.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Re-activating a terminated occupancy could double-book a face that was
  // rented to someone else in the meantime — re-check availability.
  if (body.status === 'ACTIVE' && existing.status !== 'ACTIVE') {
    const activeOccupancies = await prisma.occupancy.findMany({
      where: { billboardId: existing.billboardId, status: 'ACTIVE', id: { not: existing.id } },
      select: { face: true },
    })
    if (!isFaceAvailable(existing.face, activeOccupancies)) {
      return NextResponse.json({ error: 'Cette face du panneau est déjà occupée' }, { status: 409 })
    }
  }

  const occupancy = await prisma.occupancy.update({ where: { id: params.id }, data })
  return NextResponse.json(occupancy)
}
