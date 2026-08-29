import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { _prisma?: PrismaClient }

let _prisma: PrismaClient | undefined

export function getPrisma(): PrismaClient {
  if (globalForPrisma._prisma) return globalForPrisma._prisma
  if (_prisma) return _prisma

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }
  const adapter = new PrismaPg({ connectionString })
  const client = new PrismaClient({ adapter })

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma._prisma = client
  }
  _prisma = client
  return client
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return Reflect.get(getPrisma(), prop)
  },
})
