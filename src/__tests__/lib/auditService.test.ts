import { describe, it, expect, vi, beforeEach } from 'vitest'

const auditLogCreate = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: { create: (...args: unknown[]) => auditLogCreate(...args) },
  },
}))

import { logAudit } from '@/lib/services/auditService'

describe('logAudit', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('writes an AuditLog row with the given fields', async () => {
    auditLogCreate.mockResolvedValue({ id: 'log-1' })

    await logAudit({
      userId: 'user-1',
      action: 'update',
      entityType: 'Contrat',
      entityId: 'contrat-1',
      oldValues: { statut: 'DRAFT' },
      newValues: { statut: 'ACTIVE' },
    })

    expect(auditLogCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        action: 'update',
        entityType: 'Contrat',
        entityId: 'contrat-1',
        oldValues: { statut: 'DRAFT' },
        newValues: { statut: 'ACTIVE' },
      },
    })
  })

  it('omits oldValues/newValues when not provided (e.g. a pure create)', async () => {
    auditLogCreate.mockResolvedValue({ id: 'log-2' })

    await logAudit({
      userId: 'user-1',
      action: 'create',
      entityType: 'Contrat',
      entityId: 'contrat-2',
      newValues: { statut: 'ACTIVE' },
    })

    expect(auditLogCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        action: 'create',
        entityType: 'Contrat',
        entityId: 'contrat-2',
        oldValues: undefined,
        newValues: { statut: 'ACTIVE' },
      },
    })
  })

  it('writes through a provided transaction client instead of the default prisma client', async () => {
    const txCreate = vi.fn().mockResolvedValue({ id: 'log-3' })
    const tx = { auditLog: { create: txCreate } } as unknown as Parameters<typeof logAudit>[1]

    await logAudit(
      { userId: 'user-1', action: 'create', entityType: 'Contrat', entityId: 'contrat-3' },
      tx
    )

    expect(txCreate).toHaveBeenCalled()
    expect(auditLogCreate).not.toHaveBeenCalled()
  })

  it('throws when a required field is missing', async () => {
    await expect(
      logAudit({
        userId: '',
        action: 'update',
        entityType: 'Contrat',
        entityId: 'contrat-1',
      })
    ).rejects.toThrow(/required/)
    expect(auditLogCreate).not.toHaveBeenCalled()
  })
})
