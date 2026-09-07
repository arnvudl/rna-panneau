import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { seedGeo } from './seed-geo'

async function main() {
  const users = [
    { email: 'dev@rna.mg', password: 'xK9m2pLq', role: 'DEV' as const },
    { email: 'admin@rna.mg', password: 'Rn4wJ7hB', role: 'ADMIN' as const },
    { email: 'user@rna.mg', password: 'Tz6vF3cY', role: 'USER' as const },
  ]

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10)
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, passwordHash, role: u.role },
    })
  }

  await seedGeo()
  await seedSampleData()
}

async function seedSampleData() {
  const client = await prisma.client.upsert({
    where: { id: 'seed-client-orange' },
    update: {},
    create: { id: 'seed-client-orange', name: 'Orange Madagascar', email: 'contact@orange.mg' },
  })

  const analamanga = await prisma.region.findUniqueOrThrow({ where: { name: 'Analamanga' } })
  const district = await prisma.district.findFirstOrThrow({
    where: { regionId: analamanga.id },
    orderBy: { name: 'asc' },
  })

  const billboard = await prisma.billboard.upsert({
    where: { reference: 'ANL-0001' },
    update: {},
    create: {
      reference: 'ANL-0001',
      lat: -18.8792,
      lng: 47.5079,
      regionId: analamanga.id,
      districtId: district.id,
      dimension: 'D4X3',
      sides: 2,
    },
  })

  await prisma.occupancy.upsert({
    where: { id: 'seed-occupancy-1' },
    update: {},
    create: {
      id: 'seed-occupancy-1',
      billboardId: billboard.id,
      clientId: client.id,
      contractRef: 'Contrat-Orange-2026.pdf',
      endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
    },
  })
}

main().finally(() => prisma.$disconnect())
