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
      statut: 'ENDED',
      billboardId: 'bb-1',
      faces: [{ face: 'BOTH' }],
    })
    contratFindMany.mockResolvedValue([])
    isFaceAvailable.mockReturnValue(true)
    contratUpdate.mockResolvedValue({ id: 'contrat-1', statut: 'ACTIVE' })

    const res = await PATCH(makeRequest({ status: 'ACTIVE' }), { params: { id: 'contrat-1' } })

    expect(res.status).toBe(200)
    expect(logAudit).toHaveBeenCalledWith({
      userId: 'user-1',
      action: 'update',
      entityType: 'Contrat',
      entityId: 'contrat-1',
      oldValues: { statut: 'ENDED' },
      newValues: { statut: 'ACTIVE' },
    })
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
