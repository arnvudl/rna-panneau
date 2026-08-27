import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/api-helpers'

export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error
  if (session.user.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const requests = await prisma.approvalRequest.findMany({
    where: { status: 'PENDING' },
    include: { requestedBy: true },
    orderBy: { createdAt: 'asc' },
  })

  const enriched = await attachResolvedNames(requests)
  return NextResponse.json(enriched)
}

async function attachResolvedNames<
  T extends { payload: unknown }
>(requests: T[]) {
  const billboardIds = new Set<string>()
  const clientIds = new Set<string>()
  const occupancyIds = new Set<string>()
  const photoIds = new Set<string>()

  for (const r of requests) {
    const data = (r.payload ?? {}) as Record<string, unknown>
    if (typeof data.billboardId === 'string') billboardIds.add(data.billboardId)
    if (typeof data.clientId === 'string') clientIds.add(data.clientId)
    if (typeof data.occupancyId === 'string') occupancyIds.add(data.occupancyId)
    if (typeof data.photoId === 'string') photoIds.add(data.photoId)
  }

  const [billboards, clients, occupancies, photos] = await Promise.all([
    billboardIds.size
      ? prisma.billboard.findMany({
          where: { id: { in: Array.from(billboardIds) } },
          select: { id: true, reference: true },
        })
      : Promise.resolve([]),
    clientIds.size
      ? prisma.client.findMany({
          where: { id: { in: Array.from(clientIds) } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    occupancyIds.size
      ? prisma.occupancy.findMany({
          where: { id: { in: Array.from(occupancyIds) } },
          select: {
            id: true,
            billboard: { select: { reference: true } },
            client: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    photoIds.size
      ? prisma.billboardPhoto.findMany({
          where: { id: { in: Array.from(photoIds) } },
          select: { id: true, filename: true, billboard: { select: { reference: true } } },
        })
      : Promise.resolve([]),
  ])

  const photoMap = new Map(
    photos.map((p) => [p.id, `${p.billboard.reference} — ${p.filename}`])
  )

  const billboardMap = new Map(billboards.map((b) => [b.id, b.reference]))
  const clientMap = new Map(clients.map((c) => [c.id, c.name]))
  const occupancyMap = new Map(
    occupancies.map((o) => [o.id, `${o.billboard.reference} — ${o.client.name}`])
  )

  return requests.map((r) => {
    const data = (r.payload ?? {}) as Record<string, unknown>
    const resolvedNames: Record<string, string> = {}
    if (typeof data.billboardId === 'string') {
      const name = billboardMap.get(data.billboardId)
      if (name) resolvedNames.billboardId = name
    }
    if (typeof data.clientId === 'string') {
      const name = clientMap.get(data.clientId)
      if (name) resolvedNames.clientId = name
    }
    if (typeof data.occupancyId === 'string') {
      const name = occupancyMap.get(data.occupancyId)
      if (name) resolvedNames.occupancyId = name
    }
    if (typeof data.photoId === 'string') {
      const name = photoMap.get(data.photoId)
      if (name) resolvedNames.photoId = name
    }
    return { ...r, resolvedNames }
  })
}
