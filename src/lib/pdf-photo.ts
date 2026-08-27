import { readFile } from 'fs/promises'
import path from 'path'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'

export type PdfPhoto = { data: Buffer; format: 'jpg' | 'png' }

/**
 * Loads a billboard photo from disk for embedding in a PDF.
 *
 * The photos must NOT be referenced by URL (`/api/uploads/...`): that route
 * requires an authenticated session, and react-pdf's server-side fetch has no
 * cookies, so the request 401s and the image silently never renders.
 *
 * react-pdf only supports JPEG and PNG; other formats return null and the
 * PDF simply omits the photo.
 */
export async function loadPdfPhoto(filename: string): Promise<PdfPhoto | null> {
  const ext = path.extname(filename).toLowerCase()
  const format = ext === '.jpg' || ext === '.jpeg' ? 'jpg' : ext === '.png' ? 'png' : null
  if (!format) return null
  try {
    const data = await readFile(path.join(UPLOADS_DIR, 'photos', filename))
    return { data, format }
  } catch {
    return null
  }
}
