import { unlink } from 'fs/promises'
import path from 'path'
import type { Prisma } from '@prisma/client'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'

/**
 * Deletes a billboard and its dependent rows (contrats, maintenance
 * records; photos and ContratFace rows cascade at the DB level). Contrat and
 * MaintenanceRecord have no onDelete cascade in the schema, so a bare
 * `billboard.delete` fails with a FK violation as soon as the billboard has
 * any history.
 *
 * Returns the photo filenames so the caller can remove the files from disk
 * AFTER the transaction commits — never before, or a rollback would leave
 * DB rows pointing at deleted files.
 */
export async function deleteBillboardCascade(
  tx: Prisma.TransactionClient,
  billboardId: string
): Promise<string[]> {
  const photos = await tx.billboardPhoto.findMany({
    where: { billboardId },
    select: { filename: true },
  })
  await tx.contrat.deleteMany({ where: { billboardId } })
  await tx.maintenanceRecord.deleteMany({ where: { billboardId } })
  await tx.billboard.delete({ where: { id: billboardId } })
  return photos.map((p) => p.filename)
}

/** Best-effort removal of photo files once the DB delete has committed. */
export async function removePhotoFiles(filenames: string[]) {
  await Promise.all(
    filenames.map((f) => unlink(path.join(UPLOADS_DIR, 'photos', f)).catch(() => {}))
  )
}
