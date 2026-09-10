import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireSession = vi.fn()
const parseOrBadRequest = vi.fn()
const createApprovalRequest = vi.fn()
const getPermission = vi.fn()
const isFaceAvailable = vi.fn()
const contratFindUnique = vi.fn()
const contratFindMany = vi.fn()
const contratUpdate = vi.fn()
const logAudit = vi.fn()

vi.mock('@/lib/api-helpers', () => ({
  requireSession: (...args: unknown[]) => requireSession(...args),
  parseOrBadRequest: (...args: unknown[]) => parseOrBadRequest(...args),
  createApprovalRequest: (...args: unknown[]) => createApprovalRequest(...args),
}))

vi.mock('@/lib/permissions', () => ({
  getPermission: (...args: unknown[]) => getPermission(...args),
}))

vi.mock('@/lib/face-occupancy', () => ({
  isFaceAvailable: (...args: unknown[]) => isFaceAvailable(...args),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contrat: {
      findUnique: (...args: unknown[]) => contratFindUnique(...args),
      findMany: (...args: unknown[]) => contratFindMany(...args),
      update: (...args: unknown[]) => contratUpdate(...args),
    },
    $transaction: (fn: (tx: unknown) => unknown) =>
      fn({
        contrat: {
          update: (...args: unknown[]) => contratUpdate(...args),
        },
      }),
  },
}))

vi.mock('@/lib/services/auditService', () => ({
  logAudit: (...args: unknown[]) => logAudit(...args),
}))

import { PATCH } from '@/app/api/contrats/[id]/route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/contrats/contrat-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/contrats/[id] audit logging', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    requireSession.mockResolvedValue({ session: { user: { id: 'user-1', role: 'ADMIN' } } })
    getPermission.mockReturnValue('allowed')
  })

  it('logs an audit row with before/after statut on a real transition', async () => {
    parseOrBadRequest.mockReturnValue({ data: { status: 'ACTIVE' } })
    contratFindUnique.mockResolvedValue({
      id: 'contrat-1',
      statut: 'SIGNED',
      billboardId: 'bb-1',
      faces: [{ face: 'BOTH' }],
    })
    contratFindMany.mockResolvedValue([])
    isFaceAvailable.mockReturnValue(true)
    contratUpdate.mockResolvedValue({ id: 'contrat-1', statut: 'ACTIVE' })

    const res = await PATCH(makeRequest({ status: 'ACTIVE' }), { params: { id: 'contrat-1' } })

    expect(res.status).toBe(200)
    expect(logAudit).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        action: 'update',
        entityType: 'Contrat',
        entityId: 'contrat-1',
        oldValues: { statut: 'SIGNED' },
        newValues: { statut: 'ACTIVE' },
      },
      expect.anything()
    )
  })

  it('rejects ENDED -> ACTIVE as an illegal transition with 400', async () => {
    parseOrBadRequest.mockReturnValue({ data: { status: 'ACTIVE' } })
    contratFindUnique.mockResolvedValue({
      id: 'contrat-1',
      statut: 'ENDED',
      billboardId: 'bb-1',
      faces: [{ face: 'BOTH' }],
    })

    const res = await PATCH(makeRequest({ status: 'ACTIVE' }), { params: { id: 'contrat-1' } })

    expect(res.status).toBe(400)
    expect(contratUpdate).not.toHaveBeenCalled()
    expect(logAudit).not.toHaveBeenCalled()
  })

  it('rejects an illegal transition with 400 before creating an approval request, even when the role requires approval', async () => {
    getPermission.mockReturnValue('requires_approval')
    parseOrBadRequest.mockReturnValue({ data: { status: 'ACTIVE' } })
    contratFindUnique.mockResolvedValue({
      id: 'contrat-1',
      statut: 'ENDED',
      billboardId: 'bb-1',
      faces: [{ face: 'BOTH' }],
    })

    const res = await PATCH(makeRequest({ status: 'ACTIVE' }), { params: { id: 'contrat-1' } })

    expect(res.status).toBe(400)
    expect(createApprovalRequest).not.toHaveBeenCalled()
    expect(contratUpdate).not.toHaveBeenCalled()
    expect(logAudit).not.toHaveBeenCalled()
  })

  it('does not log an audit row when statut is unchanged', async () => {
    parseOrBadRequest.mockReturnValue({ data: { numero: 'NEW-REF' } })
    contratFindUnique.mockResolvedValue({
      id: 'contrat-1',
      statut: 'ACTIVE',
      billboardId: 'bb-1',
      faces: [{ face: 'BOTH' }],
    })
    contratUpdate.mockResolvedValue({ id: 'contrat-1', statut: 'ACTIVE', numero: 'NEW-REF' })

    const res = await PATCH(makeRequest({ numero: 'NEW-REF' }), { params: { id: 'contrat-1' } })

    expect(res.status).toBe(200)
    expect(logAudit).not.toHaveBeenCalled()
  })
})
