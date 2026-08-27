import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession, parseOrBadRequest, createApprovalRequest } from '@/lib/api-helpers'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireSession()
  if (error) return error

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: { occupancies: { include: { billboard: true }, orderBy: { startDate: 'desc' } } },
  })
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(client)
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().trim().nullable().optional(),
  email: z.string().trim().email().or(z.literal('')).nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error

  const parsed = parseOrBadRequest(patchSchema, await req.json())
  if ('error' in parsed) return parsed.error

  if (session.user.role === 'USER') {
    return createApprovalRequest(session, 'EDIT_CLIENT', {
      clientId: params.id,
      ...parsed.data,
    })
  }

  const client = await prisma.client.update({ where: { id: params.id }, data: parsed.data })
  return NextResponse.json(client)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error

  if (session.user.role === 'USER') {
    return createApprovalRequest(session, 'DELETE_CLIENT', { clientId: params.id })
  }

  const occupancyCount = await prisma.occupancy.count({ where: { clientId: params.id } })
  if (occupancyCount > 0) {
    return NextResponse.json(
      { error: 'Ce client a des contrats associés (actifs ou passés) et ne peut pas être supprimé.' },
      { status: 409 }
    )
  }

  await prisma.client.delete({ where: { id: params.id } })
  return NextResponse.json({ status: 'deleted' })
}
