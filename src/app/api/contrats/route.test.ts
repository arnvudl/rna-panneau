import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const findMany = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: { contrat: { findMany: (...args: unknown[]) => findMany(...args) } },
}))

vi.mock('@/lib/api-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-helpers')>('@/lib/api-helpers')
  return {
    ...actual,
    requireSession: vi.fn(async () => ({ session: { user: { id: 'u1', role: 'ADMIN' } } })),
  }
})

import { GET } from './route'

describe('GET /api/contrats', () => {
  beforeEach(() => {
    findMany.mockReset()
    findMany.mockResolvedValue([])
  })

  it('queries with an empty (all-undefined) where clause when no filters are given', async () => {
    await GET(new NextRequest('http://localhost/api/contrats'))
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { billboardId: undefined, clientId: undefined, statut: undefined },
      })
    )
  })

  it('passes regionId/districtId/communeId through as a billboard-relation filter', async () => {
    await GET(
      new NextRequest(
        'http://localhost/api/contrats?regionId=r1&districtId=d1&communeId=co1'
      )
    )
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          billboard: { regionId: 'r1', districtId: 'd1', communeId: 'co1' },
        }),
      })
    )
  })

  it('combines region/district/commune filters with clientId, billboardId and statut', async () => {
    await GET(
      new NextRequest(
        'http://localhost/api/contrats?clientId=c1&billboardId=b1&statut=ACTIVE&regionId=r1'
      )
    )
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clientId: 'c1',
          billboardId: 'b1',
          statut: 'ACTIVE',
          billboard: { regionId: 'r1' },
        },
      })
    )
  })
})
