import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma, type ApprovalType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireSession, parseOrBadRequest } from '@/lib/api-helpers'
import { isFaceAvailable } from '@/lib/face-occupancy'
import { createNotification } from '@/lib/notifications'
import { deleteBillboardCascade, removePhotoFiles } from '@/lib/billboard-delete'

const patchSchema = z.object({ decision: z.enum(['APPROVED', 'REJECTED']) })

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error
  if (session.user.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = parseOrBadRequest(patchSchema, await req.json())
  if ('error' in parsed) return parsed.error
  const { decision } = parsed.data

  const approval = await prisma.approvalRequest.findUnique({ where: { id: params.id } })
  if (!approval) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const { updated, filesToRemove } = await prisma.$transaction(async (tx) => {
      let filesToRemove: string[] = []
      if (decision === 'APPROVED') {
        filesToRemove = (await applyApproval(tx, approval.type, approval.payload)) ?? []
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
  payload: Prisma.JsonValue
): Promise<string[] | undefined> {
  const data = payload as Record<string, unknown>
  switch (type) {
    case 'CREATE_OCCUPANCY': {
      // Plain Error (not a Prisma error) deliberately bypasses the
      // PrismaClientKnownRequestError branch below and surfaces as a 500,
      // leaving this approval PENDING (transaction rolls back) instead of a
      // clean 400 — accepted tradeoff for the rare stale-approval case where
      // the requested face was taken by another occupancy after the request
      // was submitted but before admin review.
      const face = (data.face as 'FACE_1' | 'FACE_2' | 'BOTH') ?? 'BOTH'
      const activeOccupancies = await tx.occupancy.findMany({
        where: { billboardId: data.billboardId as string, status: 'ACTIVE' },
        select: { face: true },
      })
      if (!isFaceAvailable(face, activeOccupancies)) {
        throw new Error('Face already occupied')
      }
      await tx.occupancy.create({
        data: {
          billboardId: data.billboardId as string,
          clientId: data.clientId as string,
          face,
          contractRef: data.contractRef as string | undefined,
          endDate: data.endDate ? new Date(data.endDate as string) : undefined,
        },
      })
      break
    }
    case 'EDIT_OCCUPANCY':
      await tx.occupancy.update({
        where: { id: data.occupancyId as string },
        data: {
          status: data.status as 'ACTIVE' | 'TERMINATED' | undefined,
          endDate: data.endDate === undefined ? undefined : data.endDate ? new Date(data.endDate as string) : null,
          contractRef: data.contractRef as string | null | undefined,
        },
      })
      break
    case 'DELETE_BILLBOARD':
      return deleteBillboardCascade(tx, data.billboardId as string)
    case 'EDIT_BILLBOARD': {
      const { billboardId, ...fields } = data
      await tx.billboard.update({
        where: { id: billboardId as string },
        data: fields as Record<string, unknown>,
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
      // occupancies were added after the request but before admin review.
      const occupancyCount = await tx.occupancy.count({ where: { clientId: data.clientId as string } })
      if (occupancyCount > 0) {
        throw new Error('Client has associated occupancies, cannot delete')
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
