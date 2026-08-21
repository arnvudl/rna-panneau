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
}

main().finally(() => prisma.$disconnect())
