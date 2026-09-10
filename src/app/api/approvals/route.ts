import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/api-helpers'
import { getPermission } from '@/lib/permissions'

export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error
  if (getPermission(session.user.role, 'view_approvals') === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const requests = await prisma.approvalRequest.findMany({
    where: { status: 'PENDING' },
    include: { requestedBy: true },
    orderBy: { createdAt: 'asc' },
  })

  const withNames = await attachResolvedNames(requests)
  const enriched = await attachBeforeState(withNames)
  return NextResponse.json(enriched)
}

async function attachResolvedNames<
  T extends { payload: unknown }
>(requests: T[]) {
  const billboardIds = new Set<string>()
  const clientIds = new Set<string>()
  const contratIds = new Set<string>()
  const photoIds = new Set<string>()

  for (const r of requests) {
    const data = (r.payload ?? {}) as Record<string, unknown>
    if (typeof data.billboardId === 'string') billboardIds.add(data.billboardId)
    if (typeof data.clientId === 'string') clientIds.add(data.clientId)
    if (typeof data.contratId === 'string') contratIds.add(data.contratId)
    if (typeof data.photoId === 'string') photoIds.add(data.photoId)
  }

  const [billboards, clients, contrats, photos] = await Promise.all([
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
    contratIds.size
      ? prisma.contrat.findMany({
          where: { id: { in: Array.from(contratIds) } },
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
  const contratMap = new Map(
    contrats.map((o) => [o.id, `${o.billboard.reference} — ${o.client.name}`])
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
    if (typeof data.contratId === 'string') {
      const name = contratMap.get(data.contratId)
      if (name) resolvedNames.contratId = name
    }
    if (typeof data.photoId === 'string') {
      const name = photoMap.get(data.photoId)
      if (name) resolvedNames.photoId = name
    }
    return { ...r, resolvedNames }
  })
}

/**
 * For EDIT_* approval types, attaches the entity's current state under
 * `before` so the UI can render a field-by-field diff against `payload`
 * (the proposed "after"). CREATE/DELETE types get no `before` — there is
 * nothing to compare a creation against, and a deletion's payload already
 * only carries the id to remove.
 */
async function attachBeforeState<
  T extends { type: string; payload: unknown }
>(requests: T[]) {
  return Promise.all(
    requests.map(async (r) => {
      const data = (r.payload ?? {}) as Record<string, unknown>
      let before: Record<string, unknown> | null = null

      if (r.type === 'EDIT_BILLBOARD' && typeof data.billboardId === 'string') {
        before = await prisma.billboard.findUnique({ where: { id: data.billboardId } })
      } else if (r.type === 'EDIT_OCCUPANCY' && typeof data.contratId === 'string') {
        before = await prisma.contrat.findUnique({ where: { id: data.contratId } })
      } else if (r.type === 'EDIT_CLIENT' && typeof data.clientId === 'string') {
        before = await prisma.client.findUnique({ where: { id: data.clientId } })
      }

      return { ...r, before }
    })
  )
}
