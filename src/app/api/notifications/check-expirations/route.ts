import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/api-helpers'
import { notifyAdmins } from '@/lib/notifications'

export async function POST() {
  const { session, error } = await requireSession()
  if (error) return error
  if (session.user.role === 'USER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const now = new Date()

  const expiring = await prisma.occupancy.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { lte: thirtyDaysFromNow, gte: now },
    },
    include: {
      billboard: { select: { reference: true, id: true } },
      client: { select: { name: true } },
    },
  })

  const today = now.toISOString().slice(0, 10)

  let created = 0
  for (const occ of expiring) {
    const dedupKey = `EXPIRING_${occ.id}_${today}`
    const exists = await prisma.notification.findFirst({
      where: { type: dedupKey },
    })
    if (exists) continue

    const daysLeft = Math.ceil((occ.endDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    await notifyAdmins({
      type: dedupKey,
      title: 'Contrat expire bientôt',
      message: `${occ.billboard.reference} — ${occ.client.name} expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
      linkUrl: `/billboards/${occ.billboard.id}`,
    })
    created++
  }

  return NextResponse.json({ checked: expiring.length, created })
}
