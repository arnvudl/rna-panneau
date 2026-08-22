import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

async function main() {
  const users = [
    { email: 'dev@rna.mg', password: process.env.SEED_DEV_PASSWORD ?? 'changeme-dev', role: 'DEV' as const },
    { email: 'admin@rna.mg', password: process.env.SEED_ADMIN_PASSWORD ?? 'changeme-admin', role: 'ADMIN' as const },
    { email: 'user@rna.mg', password: process.env.SEED_USER_PASSWORD ?? 'changeme-user', role: 'USER' as const },
  ]

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10)
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, passwordHash, role: u.role },
    })
  }

  await seedSampleData()
}

async function seedSampleData() {
  const client = await prisma.client.upsert({
    where: { id: 'seed-client-orange' },
    update: {},
    create: { id: 'seed-client-orange', name: 'Orange Madagascar', email: 'contact@orange.mg' },
  })

  const billboard = await prisma.billboard.upsert({
    where: { reference: 'ANM 001 TNR' },
    update: {},
    create: {
      reference: 'ANM 001 TNR',
      lat: -18.8792,
      lng: 47.5079,
      city: 'Antananarivo',
      dimension: 'D4X3',
      sides: 2,
    },
  })

  await prisma.contract.upsert({
    where: { id: 'seed-contract-1' },
    update: {},
    create: {
      id: 'seed-contract-1',
      billboardId: billboard.id,
      clientId: client.id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      amount: 1500000,
      status: 'ACTIVE',
    },
  })
}

main().finally(() => prisma.$disconnect())
