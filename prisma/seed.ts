import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

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
}

main().finally(() => prisma.$disconnect())
