import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { requireSession } from '@/lib/api-helpers'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

export async function GET(_req: NextRequest, { params }: { params: { filename: string } }) {
  const { error } = await requireSession()
  if (error) return error

  const filename = params.filename
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
  }

  const ext = path.extname(filename).toLowerCase()
  const mimeType = MIME_TYPES[ext]
  if (!mimeType) return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })

  try {
    const filePath = path.join(UPLOADS_DIR, 'photos', filename)
    const buffer = await readFile(filePath)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
