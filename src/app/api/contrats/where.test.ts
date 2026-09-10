import { describe, it, expect } from 'vitest'
import { buildContratWhere } from './where'

function paramsOf(entries: Record<string, string>): URLSearchParams {
  return new URLSearchParams(entries)
}

describe('buildContratWhere', () => {
  it('sets billboardId/clientId/statut to undefined when no params are given', () => {
    expect(buildContratWhere(paramsOf({}))).toEqual({
      billboardId: undefined,
      clientId: undefined,
      statut: undefined,
    })
  })

  it('filters by billboardId, clientId and statut directly on Contrat', () => {
    const where = buildContratWhere(
      paramsOf({ billboardId: 'b1', clientId: 'c1', statut: 'ACTIVE' })
    )
    expect(where).toEqual({ billboardId: 'b1', clientId: 'c1', statut: 'ACTIVE' })
  })

  it('ignores an invalid statut value rather than passing it through to Prisma', () => {
    const where = buildContratWhere(paramsOf({ statut: 'NOT_A_STATUS' }))
    expect(where.statut).toBeUndefined()
  })

  it('filters by regionId through the billboard relation', () => {
    const where = buildContratWhere(paramsOf({ regionId: 'r1' }))
    expect(where).toEqual({
      billboardId: undefined,
      clientId: undefined,
      statut: undefined,
      billboard: { regionId: 'r1' },
    })
  })

  it('filters by districtId through the billboard relation', () => {
    const where = buildContratWhere(paramsOf({ districtId: 'd1' }))
    expect(where.billboard).toEqual({ districtId: 'd1' })
  })

  it('filters by communeId through the billboard relation', () => {
    const where = buildContratWhere(paramsOf({ communeId: 'co1' }))
    expect(where.billboard).toEqual({ communeId: 'co1' })
  })

  it('combines regionId, districtId and communeId into a single billboard filter', () => {
    const where = buildContratWhere(
      paramsOf({ regionId: 'r1', districtId: 'd1', communeId: 'co1' })
    )
    expect(where.billboard).toEqual({ regionId: 'r1', districtId: 'd1', communeId: 'co1' })
  })

  it('combines billboard-relation filters with direct Contrat filters', () => {
    const where = buildContratWhere(
      paramsOf({ clientId: 'c1', statut: 'DRAFT', regionId: 'r1', districtId: 'd1' })
    )
    expect(where).toEqual({
      billboardId: undefined,
      clientId: 'c1',
      statut: 'DRAFT',
      billboard: { regionId: 'r1', districtId: 'd1' },
    })
  })

  it('combines billboardId with region/district/commune filters (redundant but not contradictory)', () => {
    const where = buildContratWhere(paramsOf({ billboardId: 'b1', regionId: 'r1' }))
    expect(where).toEqual({
      billboardId: 'b1',
      clientId: undefined,
      statut: undefined,
      billboard: { regionId: 'r1' },
    })
  })

  it('omits the billboard relation filter entirely when no region/district/commune param is given', () => {
    const where = buildContratWhere(paramsOf({ clientId: 'c1' }))
    expect(where.billboard).toBeUndefined()
    expect('billboard' in where).toBe(false)
  })
})
