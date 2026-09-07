import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { deriveBillboardStatus } from '@/lib/status'
import { requireSession, parseOrBadRequest, createApprovalRequest } from '@/lib/api-helpers'
import { deleteBillboardCascade, removePhotoFiles } from '@/lib/billboard-delete'
import { resolveGeoForCoordinates } from '@/lib/billboard-geo'
import { getPermission } from '@/lib/permissions'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireSession()
  if (error) return error

  const billboard = await prisma.billboard.findUnique({
    where: { id: params.id },
    include: {
      occupancies: { include: { client: true }, orderBy: { startDate: 'desc' } },
      maintenanceRecords: { orderBy: { date: 'desc' } },
      photos: { orderBy: { createdAt: 'desc' } },
      region: true,
      district: true,
      commune: true,
    },
  })
  if (!billboard) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ...billboard, status: deriveBillboardStatus(billboard) })
}

const patchSchema = z.object({
  damaged: z.boolean().optional(),
  regionId: z.string().optional(),
  districtId: z.string().optional(),
  dimension: z.enum(['D2X1', 'D4X3', 'D6X3', 'D8X3', 'D12X3']).optional(),
  sides: z.union([z.literal(1), z.literal(2)]).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  statusOverride: z
    .enum(['AVAILABLE', 'RENTED', 'EXPIRING_SOON', 'EXPIRED', 'MAINTENANCE'])
    .nullable()
    .optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  permitNumber: z.string().trim().max(100).nullable().optional(),
  taxPaymentRef: z.string().trim().max(200).nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error

  const parsed = parseOrBadRequest(patchSchema, await req.json())
  if ('error' in parsed) return parsed.error

  if (getPermission(session.user.role, 'edit_billboard') === 'requires_approval') {
    return createApprovalRequest(session, 'EDIT_BILLBOARD', {
      billboardId: params.id,
      ...parsed.data,
    })
  }

  const data = parsed.data
  const updateData: Record<string, unknown> = { ...data }

  const coordsChanged = data.lat !== undefined || data.lng !== undefined
  if (coordsChanged && !(data.regionId && data.districtId)) {
    const existing = await prisma.billboard.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const lat = data.lat ?? existing.lat
    const lng = data.lng ?? existing.lng
    const resolved = await resolveGeoForCoordinates(lat, lng)
    if (!resolved) {
      return NextResponse.json(
        {
          error: 'GEO_NOT_FOUND',
          message:
            "Impossible de déterminer la région/district à ces coordonnées. Sélectionnez-les manuellement.",
        },
        { status: 422 }
      )
    }
    updateData.regionId = resolved.regionId
    updateData.districtId = resolved.districtId
    updateData.communeId = resolved.communeId
  }

  const billboard = await prisma.billboard.update({ where: { id: params.id }, data: updateData })
  return NextResponse.json(billboard)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error

  if (getPermission(session.user.role, 'delete_billboard') === 'requires_approval') {
    // Contract for the approvals API: DELETE_BILLBOARD payload is always
    // shaped as { billboardId: string } — the id of the billboard to remove
    // once the request is approved.
    return createApprovalRequest(session, 'DELETE_BILLBOARD', { billboardId: params.id })
  }

  const existing = await prisma.billboard.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const filenames = await prisma.$transaction((tx) => deleteBillboardCascade(tx, params.id))
  await removePhotoFiles(filenames)
  return NextResponse.json({ status: 'deleted' })
}
