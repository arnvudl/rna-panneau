import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { requireSession, createApprovalRequest } from '@/lib/api-helpers'
import { getPermission } from '@/lib/permissions'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; photoId: string } }
) {
  const { session, error } = await requireSession()
  if (error) return error

  const photo = await prisma.billboardPhoto.findUnique({ where: { id: params.photoId } })
  if (!photo || photo.billboardId !== params.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (getPermission(session.user.role, 'delete_photo') === 'requires_approval') {
    return createApprovalRequest(session, 'DELETE_PHOTO', {
      photoId: params.photoId,
      billboardId: params.id,
    })
  }

  // DB row first, file second: if the DB delete fails we must not have
  // already removed the file the row still points at.
  await prisma.billboardPhoto.delete({ where: { id: params.photoId } })
  await unlink(path.join(UPLOADS_DIR, 'photos', photo.filename)).catch(() => {})
  return NextResponse.json({ status: 'deleted' })
}
