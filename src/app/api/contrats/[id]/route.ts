import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireSession, parseOrBadRequest, createApprovalRequest } from '@/lib/api-helpers'
import { getPermission } from '@/lib/permissions'
import { isFaceAvailable } from '@/lib/face-occupancy'
import { LEGACY_STATUS_TO_CONTRAT_STATUS } from '@/lib/contrat-schema'
import { logAudit } from '@/lib/services/auditService'

// numero (Contrat.numero) is required + unique in the schema, unlike the old
// optional contractRef — it cannot be cleared to null, only replaced.
const patchSchema = z.object({
  status: z.enum(['ACTIVE', 'TERMINATED']).optional(),
  endDate: z.string().datetime().nullable().optional(),
  numero: z.string().trim().min(1).max(200).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error

  const parsed = parseOrBadRequest(patchSchema, await req.json())
  if ('error' in parsed) return parsed.error
  const body = parsed.data
  const data = {
    statut: body.status === undefined ? undefined : LEGACY_STATUS_TO_CONTRAT_STATUS[body.status],
    dateFin: body.endDate === undefined ? undefined : body.endDate ? new Date(body.endDate) : null,
    numero: body.numero,
  } as const

  if (getPermission(session.user.role, 'edit_occupancy') === 'requires_approval') {
    // Contract for the approvals API: EDIT_OCCUPANCY payload is always shaped
    // as { contratId: string, status?: 'ACTIVE'|'TERMINATED', endDate?:
    // string (ISO) | null, numero?: string | null } — only the fields the
    // caller actually sent are included alongside contratId.
    return createApprovalRequest(session, 'EDIT_OCCUPANCY', { contratId: params.id, ...body })
  }

  const existing = await prisma.contrat.findUnique({
    where: { id: params.id },
    include: { faces: { select: { face: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Re-activating an ended contrat could double-book a face that was
  // rented to someone else in the meantime — re-check availability.
  const face = existing.faces[0]?.face ?? 'BOTH'
  if (body.status === 'ACTIVE' && existing.statut !== 'ACTIVE') {
    const activeContrats = await prisma.contrat.findMany({
      where: { billboardId: existing.billboardId, statut: 'ACTIVE', id: { not: existing.id } },
      include: { faces: { select: { face: true } } },
    })
    const activeFaces = activeContrats.flatMap((c) => c.faces)
    if (!isFaceAvailable(face, activeFaces)) {
      return NextResponse.json({ error: 'Cette face du panneau est déjà occupée' }, { status: 409 })
    }
  }

  try {
    const contrat = await prisma.$transaction(async (tx) => {
      const updated = await tx.contrat.update({
        where: { id: params.id },
        data,
        include: { faces: true },
      })

      // Only a real statut transition (sign/activate/end) is a "meaningful
      // business event" worth auditing — plain field edits (numero, endDate
      // alone) are not.
      if (data.statut !== undefined && data.statut !== existing.statut) {
        await logAudit(
          {
            userId: session.user.id,
            action: 'update',
            entityType: 'Contrat',
            entityId: updated.id,
            oldValues: { statut: existing.statut },
            newValues: { statut: data.statut },
          },
          tx
        )
      }

      return updated
    })

    return NextResponse.json(contrat)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ error: 'Could not update contrat', code: err.code }, { status: 400 })
    }
    throw err
  }
}
