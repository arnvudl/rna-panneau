import { prisma } from '@/lib/prisma'

export async function createNotification(params: {
  userId: string
  type: string
  title: string
  message: string
  linkUrl?: string
}) {
  return prisma.notification.create({ data: params })
}

export async function notifyAdmins(params: {
  type: string
  title: string
  message: string
  linkUrl?: string
}) {
  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'DEV'] } },
    select: { id: true },
  })
  if (admins.length === 0) return
  await prisma.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      type: params.type,
      title: params.title,
      message: params.message,
      linkUrl: params.linkUrl,
    })),
  })
}
