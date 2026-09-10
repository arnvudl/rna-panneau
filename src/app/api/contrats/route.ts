import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireSession, parseOrBadRequest, createApprovalRequest } from '@/lib/api-helpers'
import { getPermission } from '@/lib/permissions'
import { isFaceAvailable } from '@/lib/face-occupancy'
import { createContratSchema } from '@/lib/contrat-schema'
import { generateContratNumero } from '@/lib/reference'

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error

  const parsed = parseOrBadRequest(createContratSchema, await req.json())
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

  if (getPermission(session.user.role, 'create_occupancy') === 'requires_approval') {
    // Contract for the approvals API: CREATE_OCCUPANCY payload is always
    // shaped as { billboardId: string, clientId: string, face: 'FACE_1' |
    // 'FACE_2' | 'BOTH', numero?: string, endDate?: string (ISO) }.
    return createApprovalRequest(session, 'CREATE_OCCUPANCY', body)
  }

  const activeContrats = await prisma.contrat.findMany({
    where: { billboardId: body.billboardId, statut: 'ACTIVE' },
    include: { faces: { select: { face: true } } },
  })
  const activeFaces = activeContrats.flatMap((c) => c.faces)
  if (!isFaceAvailable(body.face, activeFaces)) {
    return NextResponse.json({ error: 'Cette face du panneau est déjà occupée' }, { status: 409 })
  }

  try {
    const contrat = await prisma.contrat.create({
      data: {
        billboardId: body.billboardId,
        clientId: body.clientId,
        numero: body.numero ?? generateContratNumero(),
        type: 'contrat',
        typeReconduction: 'tacite',
        statut: 'ACTIVE',
        dateDebut: body.startDate ? new Date(body.startDate) : undefined,
        dateFin: body.endDate ? new Date(body.endDate) : undefined,
        faces: { create: { face: body.face } },
      },
      include: { faces: true },
    })
    return NextResponse.json(contrat, { status: 201 })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ error: 'Could not create contrat', code: err.code }, { status: 400 })
    }
    throw err
  }
}
