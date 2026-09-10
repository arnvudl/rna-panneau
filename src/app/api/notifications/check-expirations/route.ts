import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/api-helpers'
import { notifyAdmins } from '@/lib/notifications'
import { getPermission } from '@/lib/permissions'

export async function POST() {
  const { session, error } = await requireSession()
  if (error) return error
  if (getPermission(session.user.role, 'manage_notifications') === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const now = new Date()

  const expiring = await prisma.contrat.findMany({
    where: {
      statut: 'ACTIVE',
      dateFin: { lte: thirtyDaysFromNow, gte: now },
    },
    include: {
      billboard: { select: { reference: true, id: true } },
      client: { select: { name: true } },
    },
  })

  const today = now.toISOString().slice(0, 10)

  // Single batched dedup query instead of one findFirst per occupancy.
  const dedupKeys = expiring.map((occ) => `EXPIRING_${occ.id}_${today}`)
  const alreadyNotified = new Set(
    dedupKeys.length > 0
      ? (
          await prisma.notification.findMany({
            where: { type: { in: dedupKeys } },
            select: { type: true },
          })
        ).map((n) => n.type)
      : []
  )

  let created = 0
  for (const occ of expiring) {
    const dedupKey = `EXPIRING_${occ.id}_${today}`
    if (alreadyNotified.has(dedupKey)) continue

    const daysLeft = Math.ceil((occ.dateFin!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    await notifyAdmins({
      type: dedupKey,
      title: 'Contrat expire bientôt',
      message: `${occ.billboard.reference} — ${occ.client.name} expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
      linkUrl: `/billboards/${occ.billboard.id}`,
    })
    created++
  }

  // Retention: notifications accumulate forever otherwise. Read ones older
  // than 60 days are safe to drop; this piggybacks on the periodic check.
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
  await prisma.notification.deleteMany({
    where: { read: true, createdAt: { lt: sixtyDaysAgo } },
  })

  return NextResponse.json({ checked: expiring.length, created })
}
