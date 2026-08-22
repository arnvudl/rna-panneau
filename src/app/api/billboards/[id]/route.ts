import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { deriveBillboardStatus } from '@/lib/status'
import { requireSession, parseOrBadRequest, createApprovalRequest } from '@/lib/api-helpers'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireSession()
  if (error) return error

  const billboard = await prisma.billboard.findUnique({
    where: { id: params.id },
    include: {
      contracts: { include: { client: true }, orderBy: { startDate: 'desc' } },
      maintenanceRecords: { orderBy: { date: 'desc' } },
    },
  })
  if (!billboard) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ...billboard, status: deriveBillboardStatus(billboard) })
}

const patchSchema = z.object({
  damaged: z.boolean().optional(),
  currentPhotoUrl: z.string().url().optional(),
  city: z.string().trim().min(1).optional(),
  dimension: z.enum(['D2X1', 'D4X3', 'D6X3', 'D8X3', 'D12X3']).optional(),
  sides: z.union([z.literal(1), z.literal(2)]).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  statusOverride: z
    .enum(['AVAILABLE', 'RENTED', 'EXPIRING_SOON', 'EXPIRED', 'MAINTENANCE'])
    .nullable()
    .optional(),
})

const RESTRICTED_FIELDS = ['city', 'dimension', 'sides', 'statusOverride'] as const

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error

  const parsed = parseOrBadRequest(patchSchema, await req.json())
  if ('error' in parsed) return parsed.error

  // USER role may only update the photo (part of "add photo" workflow) or the
  // damaged flag; editing core billboard attributes is more sensitive and
  // requires DEV/ADMIN.
  const touchesRestrictedField = RESTRICTED_FIELDS.some((field) => field in parsed.data)
  if (touchesRestrictedField && session.user.role === 'USER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const billboard = await prisma.billboard.update({ where: { id: params.id }, data: parsed.data })
  return NextResponse.json(billboard)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error

  if (session.user.role === 'USER') {
    // Contract for Task 8 (approvals API): DELETE_BILLBOARD payload is always
    // shaped as { billboardId: string } — the id of the billboard to remove
    // once the request is approved.
    return createApprovalRequest(session, 'DELETE_BILLBOARD', { billboardId: params.id })
  }

  await prisma.billboard.delete({ where: { id: params.id } })
  return NextResponse.json({ status: 'deleted' })
}
