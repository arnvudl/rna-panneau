import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma, type ApprovalType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireSession, parseOrBadRequest } from '@/lib/api-helpers'
import { getPermission } from '@/lib/permissions'
import { isFaceAvailable } from '@/lib/face-occupancy'
import { createNotification } from '@/lib/notifications'
import { deleteBillboardCascade, removePhotoFiles } from '@/lib/billboard-delete'
import { resolveGeoForCoordinates } from '@/lib/billboard-geo'
import { generateContratNumero } from '@/lib/reference'
import { LEGACY_STATUS_TO_CONTRAT_STATUS } from '@/lib/contrat-schema'
import { logAudit } from '@/lib/services/auditService'

const patchSchema = z.object({ decision: z.enum(['APPROVED', 'REJECTED']) })

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error
  if (getPermission(session.user.role, 'view_approvals') === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = parseOrBadRequest(patchSchema, await req.json())
  if ('error' in parsed) return parsed.error
  const { decision } = parsed.data

  const approval = await prisma.approvalRequest.findUnique({ where: { id: params.id } })
  if (!approval) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const { updated, filesToRemove } = await prisma.$transaction(async (tx) => {
      let filesToRemove: string[] = []
      if (decision === 'APPROVED') {
        filesToRemove =
          (await applyApproval(tx, approval.type, approval.payload, session.user.id)) ?? []
      }
      const updated = await tx.approvalRequest.update({
        where: { id: params.id },
        data: { status: decision, reviewedById: session.user.id, reviewedAt: new Date() },
      })
      return { updated, filesToRemove }
    })

    // File cleanup only after the transaction committed — a rollback must
    // never leave DB rows pointing at already-deleted files.
    if (filesToRemove.length > 0) await removePhotoFiles(filesToRemove)

    const statusLabel = decision === 'APPROVED' ? 'approuvée' : 'rejetée'
    await createNotification({
      userId: approval.requestedById,
      type: 'APPROVAL_RESULT',
      title: `Demande ${statusLabel}`,
      message: `Votre demande a été ${statusLabel} par ${session.user.email}`,
      // No linkUrl: the requester is a USER, and /dashboard is admin-only.
    })

    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        { error: 'Could not apply approval', code: err.code },
        { status: 400 }
      )
    }
    throw err
  }
}

/**
 * Applies an approved request inside the transaction. Returns the photo
 * filenames whose files must be removed from disk after commit (if any).
 */
async function applyApproval(
  tx: Prisma.TransactionClient,
  type: ApprovalType,
  payload: Prisma.JsonValue,
  userId: string
): Promise<string[] | undefined> {
  const data = payload as Record<string, unknown>
  switch (type) {
    case 'CREATE_OCCUPANCY': {
      // Plain Error (not a Prisma error) deliberately bypasses the
      // PrismaClientKnownRequestError branch below and surfaces as a 500,
      // leaving this approval PENDING (transaction rolls back) instead of a
      // clean 400 — accepted tradeoff for the rare stale-approval case where
      // the requested face was taken by another contrat after the request
      // was submitted but before admin review.
      const face = (data.face as 'FACE_1' | 'FACE_2' | 'BOTH') ?? 'BOTH'
      const activeContrats = await tx.contrat.findMany({
        where: { billboardId: data.billboardId as string, statut: 'ACTIVE' },
        include: { faces: { select: { face: true } } },
      })
      const activeFaces = activeContrats.flatMap((c) => c.faces)
      if (!isFaceAvailable(face, activeFaces)) {
        throw new Error('Face already occupied')
      }
      // An approved creation is immediately live — matches old behavior
      // where an approved occupancy was live as soon as it was applied.
      // The schema splits what was one Occupancy row into two related rows
      // (Contrat header + ContratFace), created together atomically here.
      const created = await tx.contrat.create({
        data: {
          billboardId: data.billboardId as string,
          clientId: data.clientId as string,
          numero: (data.numero as string | undefined) ?? generateContratNumero(),
          type: 'contrat',
          typeReconduction: 'tacite',
          statut: 'ACTIVE',
          dateDebut: data.startDate ? new Date(data.startDate as string) : undefined,
          dateFin: data.endDate ? new Date(data.endDate as string) : undefined,
          faces: { create: { face } },
        },
      })
      await logAudit(
        {
          userId,
          action: 'create',
          entityType: 'Contrat',
          entityId: created.id,
          newValues: { statut: created.statut },
        },
        tx
      )
      break
    }
    case 'EDIT_OCCUPANCY': {
      const existing = await tx.contrat.findUnique({ where: { id: data.contratId as string } })
      const nextStatut =
        data.status === undefined
          ? undefined
          : LEGACY_STATUS_TO_CONTRAT_STATUS[data.status as 'ACTIVE' | 'TERMINATED']
      const updated = await tx.contrat.update({
        where: { id: data.contratId as string },
        data: {
          statut: nextStatut,
          dateFin: data.endDate === undefined ? undefined : data.endDate ? new Date(data.endDate as string) : null,
          // numero is required+unique on Contrat — an explicit null (clear
          // request, valid under the old optional contractRef) is dropped
          // rather than applied, leaving the field unchanged.
          numero: (data.numero as string | undefined) || undefined,
        },
      })
      // Only audit an actual statut transition — matches the same rule
      // applied to the direct PATCH /api/contrats/[id] path.
      if (existing && nextStatut !== undefined && nextStatut !== existing.statut) {
        await logAudit(
          {
            userId,
            action: 'update',
            entityType: 'Contrat',
            entityId: updated.id,
            oldValues: { statut: existing.statut },
            newValues: { statut: updated.statut },
          },
          tx
        )
      }
      break
    }
    case 'DELETE_BILLBOARD':
      return deleteBillboardCascade(tx, data.billboardId as string)
    case 'EDIT_BILLBOARD': {
      const { billboardId, ...fields } = data
      const updateFields = { ...fields } as Record<string, unknown>

      const coordsChanged = 'lat' in updateFields || 'lng' in updateFields
      if (coordsChanged && !(updateFields.regionId && updateFields.districtId)) {
        const existing = await tx.billboard.findUnique({ where: { id: billboardId as string } })
        if (existing) {
          const lat = (updateFields.lat as number | undefined) ?? existing.lat
          const lng = (updateFields.lng as number | undefined) ?? existing.lng
          const resolved = await resolveGeoForCoordinates(lat, lng)
          if (resolved) {
            updateFields.regionId = resolved.regionId
            updateFields.districtId = resolved.districtId
            updateFields.communeId = resolved.communeId
          }
          // If resolution fails here, leave the existing region/district/commune
          // untouched rather than blocking the approval — rare, fixable by hand.
        }
      }

      await tx.billboard.update({
        where: { id: billboardId as string },
        data: updateFields,
      })
      break
    }
    case 'EDIT_CLIENT': {
      const { clientId, ...fields } = data
      await tx.client.update({
        where: { id: clientId as string },
        data: fields as Record<string, unknown>,
      })
      break
    }
    case 'DELETE_PHOTO': {
      const photo = await tx.billboardPhoto.findUnique({
        where: { id: data.photoId as string },
      })
      if (photo) {
        await tx.billboardPhoto.delete({ where: { id: photo.id } })
        return [photo.filename]
      }
      break
    }
    case 'DELETE_CLIENT': {
      // Plain Error (not a Prisma error) deliberately bypasses the
      // PrismaClientKnownRequestError branch below and surfaces as a 500,
      // leaving this approval PENDING (transaction rolls back) instead of a
      // clean 400 — accepted tradeoff for the rare stale-approval case where
      // contrats were added after the request but before admin review.
      const occupancyCount = await tx.contrat.count({ where: { clientId: data.clientId as string } })
      if (occupancyCount > 0) {
        throw new Error('Client has associated contrats, cannot delete')
      }
      await tx.client.delete({ where: { id: data.clientId as string } })
      break
    }
    default: {
      const _exhaustive: never = type
      throw new Error(`Unhandled ApprovalType: ${_exhaustive}`)
    }
  }
}
