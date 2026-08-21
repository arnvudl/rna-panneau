import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { deriveBillboardStatus } from '@/lib/status'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const billboard = await prisma.billboard.findUnique({
    where: { id: params.id },
    include: {
      contracts: { include: { client: true }, orderBy: { startDate: 'desc' } },
      maintenanceRecords: { orderBy: { date: 'desc' } },
    },
  })
  if (!billboard) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ...billboard, status: deriveBillboardStatus(billboard) })
}

const patchSchema = z.object({
  damaged: z.boolean().optional(),
  currentPhotoUrl: z.string().url().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = patchSchema.safeParse(await req.json())
  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: result.error.flatten() },
      { status: 400 }
    )
  }

  // USER role may only update the photo (part of "add photo" workflow); damaged
  // status is not sensitive enough to require approval per spec, but deletion is.
  const billboard = await prisma.billboard.update({ where: { id: params.id }, data: result.data })
  return NextResponse.json(billboard)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.user.role === 'USER') {
    // Contract for Task 8 (approvals API): DELETE_BILLBOARD payload is always
    // shaped as { billboardId: string } — the id of the billboard to remove
    // once the request is approved.
    await prisma.approvalRequest.create({
      data: {
        requestedById: session.user.id,
        type: 'DELETE_BILLBOARD',
        payload: { billboardId: params.id },
      },
    })
    return NextResponse.json({ status: 'pending_approval' }, { status: 202 })
  }

  await prisma.billboard.delete({ where: { id: params.id } })
  return NextResponse.json({ status: 'deleted' })
}
