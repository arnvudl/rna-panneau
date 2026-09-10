import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireSession, parseOrBadRequest, createApprovalRequest } from '@/lib/api-helpers'
import { getPermission } from '@/lib/permissions'
import { isFaceAvailable } from '@/lib/face-occupancy'
import { PATCH_STATUS_VALUES, resolveContratStatus, isValidContratTransition } from '@/lib/contrat-schema'
import { logAudit } from '@/lib/services/auditService'

// numero (Contrat.numero) is required + unique in the schema, unlike the old
// optional contractRef — it cannot be cleared to null, only replaced.
const patchSchema = z.object({
  status: z.enum(PATCH_STATUS_VALUES).optional(),
  endDate: z.string().datetime().nullable().optional(),
  numero: z.string().trim().min(1).max(200).optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireSession()
  if (error) return error

  const contrat = await prisma.contrat.findUnique({
    where: { id: params.id },
    include: { client: true, faces: true, billboard: true },
  })
  if (!contrat) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(contrat)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error

  const parsed = parseOrBadRequest(patchSchema, await req.json())
  if ('error' in parsed) return parsed.error
  const body = parsed.data
  const nextStatut = body.status === undefined ? undefined : resolveContratStatus(body.status)
  const data = {
    statut: nextStatut,
    dateFin: body.endDate === undefined ? undefined : body.endDate ? new Date(body.endDate) : null,
    numero: body.numero,
  } as const

  const existing = await prisma.contrat.findUnique({
    where: { id: params.id },
    include: { faces: { select: { face: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (nextStatut !== undefined && !isValidContratTransition(existing.statut, nextStatut)) {
    return NextResponse.json(
      { error: `Transition invalide : ${existing.statut} -> ${nextStatut}` },
      { status: 400 }
    )
  }

  if (getPermission(session.user.role, 'edit_occupancy') === 'requires_approval') {
    // Contract for the approvals API: EDIT_OCCUPANCY payload is always shaped
    // as { contratId: string, status?: one of PATCH_STATUS_VALUES, endDate?:
    // string (ISO) | null, numero?: string | null } — only the fields the
    // caller actually sent are included alongside contratId.
    // Reached only once the transition above has already been confirmed
    // legal per the state machine — approval gates *who* may make this
    // specific (legal) change, not whether the change is legal at all.
    return createApprovalRequest(session, 'EDIT_OCCUPANCY', { contratId: params.id, ...body })
  }

  // Re-activating a signed contrat could double-book a face that was
  // rented to someone else in the meantime — re-check availability.
  const face = existing.faces[0]?.face ?? 'BOTH'
  if (nextStatut === 'ACTIVE' && existing.statut !== 'ACTIVE') {
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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error

  const existing = await prisma.contrat.findUnique({
    where: { id: params.id },
    include: { faces: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Hard delete is intentionally scoped to DRAFT only: anything SIGNED+ has
  // real business history worth keeping even once cancelled. No
  // approval-gate check here — this is a direct action per the design
  // decision; visibility comes from the audit log below, not from gating
  // the action itself.
  if (existing.statut !== 'DRAFT') {
    return NextResponse.json(
      { error: 'Seuls les contrats en brouillon peuvent être supprimés définitivement' },
      { status: 400 }
    )
  }

  // JSON.parse(JSON.stringify(...)) turns Date fields into ISO strings so the
  // snapshot is valid Prisma.InputJsonValue (Date instances are not).
  const snapshot = JSON.parse(JSON.stringify(existing)) as Record<string, unknown>

  await prisma.$transaction(async (tx) => {
    await logAudit(
      {
        userId: session.user.id,
        action: 'delete',
        entityType: 'Contrat',
        entityId: existing.id,
        oldValues: snapshot,
      },
      tx
    )

    await tx.contrat.delete({ where: { id: params.id } })
  })

  return NextResponse.json({ status: 'deleted' })
}
