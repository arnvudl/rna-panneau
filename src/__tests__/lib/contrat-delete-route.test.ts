import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const requireSession = vi.fn()
const contratFindUnique = vi.fn()
const contratDelete = vi.fn()
const logAudit = vi.fn()

vi.mock('@/lib/api-helpers', () => ({
  requireSession: (...args: unknown[]) => requireSession(...args),
  parseOrBadRequest: vi.fn(),
  createApprovalRequest: vi.fn(),
}))

vi.mock('@/lib/permissions', () => ({
  getPermission: vi.fn(),
}))

vi.mock('@/lib/face-occupancy', () => ({
  isFaceAvailable: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contrat: {
      findUnique: (...args: unknown[]) => contratFindUnique(...args),
    },
    $transaction: (fn: (tx: unknown) => unknown) =>
      fn({
        contrat: {
          delete: (...args: unknown[]) => contratDelete(...args),
        },
      }),
  },
}))

vi.mock('@/lib/services/auditService', () => ({
  logAudit: (...args: unknown[]) => logAudit(...args),
}))

import { DELETE } from '@/app/api/contrats/[id]/route'

function makeRequest() {
  return new NextRequest('http://localhost/api/contrats/contrat-1', { method: 'DELETE' })
}

describe('DELETE /api/contrats/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    requireSession.mockResolvedValue({ session: { user: { id: 'user-1', role: 'ADMIN' } } })
  })

  it('returns 401 without a session', async () => {
    requireSession.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })

    const res = await DELETE(makeRequest(), { params: { id: 'contrat-1' } })

    expect(res.status).toBe(401)
    expect(contratFindUnique).not.toHaveBeenCalled()
  })

  it('returns 404 when the contrat does not exist', async () => {
    contratFindUnique.mockResolvedValue(null)

    const res = await DELETE(makeRequest(), { params: { id: 'missing-id' } })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body).toEqual({ error: 'Not found' })
    expect(contratDelete).not.toHaveBeenCalled()
    expect(logAudit).not.toHaveBeenCalled()
  })

  it('rejects a non-DRAFT contrat with 400, without deleting or auditing', async () => {
    contratFindUnique.mockResolvedValue({
      id: 'contrat-1',
      statut: 'SIGNED',
      faces: [{ face: 'BOTH' }],
    })

    const res = await DELETE(makeRequest(), { params: { id: 'contrat-1' } })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/brouillon/i)
    expect(contratDelete).not.toHaveBeenCalled()
    expect(logAudit).not.toHaveBeenCalled()
  })

  it('audits then deletes a DRAFT contrat inside the same transaction', async () => {
    const existing = {
      id: 'contrat-1',
      statut: 'DRAFT',
      numero: 'CTR-001',
      clientId: 'client-1',
      billboardId: 'bb-1',
      dateDebut: new Date('2026-01-01'),
      dateFin: null,
      faces: [{ face: 'BOTH' }],
    }
    contratFindUnique.mockResolvedValue(existing)
    contratDelete.mockResolvedValue(existing)

    const callOrder: string[] = []
    logAudit.mockImplementation(async () => {
      callOrder.push('audit')
    })
    contratDelete.mockImplementation(async () => {
      callOrder.push('delete')
      return existing
    })

    const res = await DELETE(makeRequest(), { params: { id: 'contrat-1' } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ status: 'deleted' })

    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'delete',
        entityType: 'Contrat',
        entityId: 'contrat-1',
        oldValues: expect.objectContaining({ id: 'contrat-1', statut: 'DRAFT', numero: 'CTR-001' }),
      }),
      expect.anything()
    )
    expect(contratDelete).toHaveBeenCalledWith({ where: { id: 'contrat-1' } })
    // Audit write happens before the delete, inside the same transaction.
    expect(callOrder).toEqual(['audit', 'delete'])
  })
})
