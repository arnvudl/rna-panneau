import { Prisma, type PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface LogAuditInput {
  userId: string
  action: string
  entityType: string
  entityId: string
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
}

/**
 * Thin, explicit wrapper around AuditLog writes. Call sites are
 * state-transition / approval-driven mutations that already have a
 * `userId` in scope (session or approval review) — this is deliberately
 * NOT a global Prisma middleware, since middleware has no access to
 * "who is making this change" outside a request handler.
 *
 * Pass a `Prisma.TransactionClient` as `client` to write the audit row as
 * part of an in-flight transaction (e.g. the approval-apply flow).
 */
export async function logAudit(
  input: LogAuditInput,
  client: PrismaClient | Prisma.TransactionClient = prisma
) {
  const { userId, action, entityType, entityId, oldValues, newValues } = input

  if (!userId || !action || !entityType || !entityId) {
    throw new Error('logAudit: userId, action, entityType and entityId are required')
  }

  return client.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      oldValues: (oldValues ?? undefined) as Prisma.InputJsonValue | undefined,
      newValues: (newValues ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  })
}
