import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const requireSession = vi.fn()
const contratFindUnique = vi.fn()
const contratFindMany = vi.fn()

vi.mock('@/lib/api-helpers', () => ({
  requireSession: (...args: unknown[]) => requireSession(...args),
  parseOrBadRequest: vi.fn(),
  createApprovalRequest: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contrat: {
      findUnique: (...args: unknown[]) => contratFindUnique(...args),
      findMany: (...args: unknown[]) => contratFindMany(...args),
    },
  },
}))

import { GET as listContrats } from '@/app/api/contrats/route'
import { GET as getContrat } from '@/app/api/contrats/[id]/route'

function makeListRequest(query: string) {
  return new NextRequest(`http://localhost/api/contrats${query}`)
}

function makeDetailRequest() {
  return new NextRequest('http://localhost/api/contrats/contrat-1')
}

describe('GET /api/contrats (list)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    requireSession.mockResolvedValue({ session: { user: { id: 'user-1', role: 'ADMIN' } } })
  })

  it('returns 401 without a session', async () => {
    requireSession.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })

    const res = await listContrats(makeListRequest(''))

    expect(res.status).toBe(401)
    expect(contratFindMany).not.toHaveBeenCalled()
  })

  it('filters results by statut query param', async () => {
    contratFindMany.mockResolvedValue([{ id: 'contrat-1', statut: 'ACTIVE' }])

    const res = await listContrats(makeListRequest('?statut=ACTIVE'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(contratFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ statut: 'ACTIVE' }),
      })
    )
    expect(body).toEqual([{ id: 'contrat-1', statut: 'ACTIVE' }])
  })

  it('ignores an invalid statut query param', async () => {
    contratFindMany.mockResolvedValue([])

    await listContrats(makeListRequest('?statut=NOT_A_STATUS'))

    expect(contratFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ statut: undefined }),
      })
    )
  })

  it('filters results by clientId query param', async () => {
    contratFindMany.mockResolvedValue([{ id: 'contrat-2', clientId: 'client-9' }])

    const res = await listContrats(makeListRequest('?clientId=client-9'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(contratFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientId: 'client-9' }),
      })
    )
    expect(body).toEqual([{ id: 'contrat-2', clientId: 'client-9' }])
  })

  it('filters results by billboardId query param', async () => {
    contratFindMany.mockResolvedValue([{ id: 'contrat-3', billboardId: 'bb-5' }])

    const res = await listContrats(makeListRequest('?billboardId=bb-5'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(contratFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ billboardId: 'bb-5' }),
      })
    )
    expect(body).toEqual([{ id: 'contrat-3', billboardId: 'bb-5' }])
  })
})

describe('GET /api/contrats/[id] (detail)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    requireSession.mockResolvedValue({ session: { user: { id: 'user-1', role: 'ADMIN' } } })
  })

  it('returns 401 without a session', async () => {
    requireSession.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })

    const res = await getContrat(makeDetailRequest(), { params: { id: 'contrat-1' } })

    expect(res.status).toBe(401)
    expect(contratFindUnique).not.toHaveBeenCalled()
  })

  it('returns the contrat with relations when found', async () => {
    const contrat = {
      id: 'contrat-1',
      statut: 'ACTIVE',
      client: { id: 'client-1', name: 'Acme' },
      faces: [{ face: 'BOTH' }],
      billboard: { id: 'bb-1' },
    }
    contratFindUnique.mockResolvedValue(contrat)

    const res = await getContrat(makeDetailRequest(), { params: { id: 'contrat-1' } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(contratFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'contrat-1' },
        include: { client: true, faces: true, billboard: true },
      })
    )
    expect(body).toEqual(contrat)
  })

  it('returns 404 when not found', async () => {
    contratFindUnique.mockResolvedValue(null)

    const res = await getContrat(makeDetailRequest(), { params: { id: 'missing-id' } })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body).toEqual({ error: 'Not found' })
  })
})
