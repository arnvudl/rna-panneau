import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, parseOrBadRequest, createApprovalRequest } from '@/lib/api-helpers'
import { isFaceAvailable } from '@/lib/face-occupancy'
import { createOccupancySchema } from '@/lib/occupancy-schema'

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error

  const parsed = parseOrBadRequest(createOccupancySchema, await req.json())
  if ('error' in parsed) return parsed.error
  const body = parsed.data

  const [billboard, client] = await Promise.all([
    prisma.billboard.findUnique({ where: { id: body.billboardId }, select: { sides: true } }),
    prisma.client.findUnique({ where: { id: body.clientId }, select: { id: true } }),
  ])
  if (!billboard) return NextResponse.json({ error: 'Panneau introuvable' }, { status: 404 })
  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  if (billboard.sides === 1 && body.face !== 'BOTH') {
    return NextResponse.json(
      { error: 'Un panneau à une seule face ne peut être loué que en entier' },
      { status: 400 }
    )
  }

  if (session.user.role === 'USER') {
    // Contract for the approvals API: CREATE_OCCUPANCY payload is always
    // shaped as { billboardId: string, clientId: string, face: 'FACE_1' |
    // 'FACE_2' | 'BOTH', contractRef?: string, endDate?: string (ISO) }.
    return createApprovalRequest(session, 'CREATE_OCCUPANCY', body)
  }

  const activeOccupancies = await prisma.occupancy.findMany({
    where: { billboardId: body.billboardId, status: 'ACTIVE' },
    select: { face: true },
  })
  if (!isFaceAvailable(body.face, activeOccupancies)) {
    return NextResponse.json({ error: 'Cette face du panneau est déjà occupée' }, { status: 409 })
  }

  const occupancy = await prisma.occupancy.create({
    data: {
      billboardId: body.billboardId,
      clientId: body.clientId,
      face: body.face,
      contractRef: body.contractRef,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
    },
  })
  return NextResponse.json(occupancy, { status: 201 })
}
