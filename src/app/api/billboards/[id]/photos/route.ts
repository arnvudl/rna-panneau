import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { randomUUID } from 'crypto'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/api-helpers'
import { matchesImageSignature } from '@/lib/image-signature'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'
const MAX_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const EXT_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireSession()
  if (error) return error

  const photos = await prisma.billboardPhoto.findMany({
    where: { billboardId: params.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(photos)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireSession()
  if (error) return error

  const billboard = await prisma.billboard.findUnique({ where: { id: params.id } })
  if (!billboard) return NextResponse.json({ error: 'Billboard not found' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  // The declared MIME type is client-controlled; verify the actual bytes so
  // arbitrary content can't be stored under an image extension.
  if (!matchesImageSignature(file.type, buffer)) {
    return NextResponse.json({ error: 'File content does not match its type' }, { status: 400 })
  }

  const ext = EXT_MAP[file.type] ?? '.jpg'
  const filename = `${randomUUID()}${ext}`

  const dir = path.join(UPLOADS_DIR, 'photos')
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, filename), buffer)

  const photo = await prisma.billboardPhoto.create({
    data: { billboardId: params.id, filename },
  })
  return NextResponse.json(photo, { status: 201 })
}
