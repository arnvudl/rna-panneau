import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, createApprovalRequest } from '@/lib/api-helpers'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireSession()
  if (error) return error

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: { contracts: { include: { billboard: true }, orderBy: { startDate: 'desc' } } },
  })
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(client)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error

  if (session.user.role === 'USER') {
    return createApprovalRequest(session, 'DELETE_CLIENT', { clientId: params.id })
  }

  const contractCount = await prisma.contract.count({ where: { clientId: params.id } })
  if (contractCount > 0) {
    return NextResponse.json(
      { error: 'Ce client a des contrats associés (actifs ou passés) et ne peut pas être supprimé.' },
      { status: 409 }
    )
  }

  await prisma.client.delete({ where: { id: params.id } })
  return NextResponse.json({ status: 'deleted' })
}
