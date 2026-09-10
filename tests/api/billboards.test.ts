import { describe, it, expect } from 'vitest'
import { buildBillboardWhere } from '@/app/api/billboards/where'

describe('buildBillboardWhere', () => {
  it('returns an empty object when no filters are given', () => {
    expect(buildBillboardWhere(new URLSearchParams())).toEqual({})
  })

  it('filters by region and damaged', () => {
    const params = new URLSearchParams({ regionId: 'region-1', damaged: 'true' })
    expect(buildBillboardWhere(params)).toEqual({ regionId: 'region-1', damaged: true })
  })

  it('filters by district and commune', () => {
    const params = new URLSearchParams({ districtId: 'district-1', communeId: 'commune-1' })
    expect(buildBillboardWhere(params)).toEqual({
      districtId: 'district-1',
      communeId: 'commune-1',
    })
  })

  it('filters by dimension', () => {
    const params = new URLSearchParams({ dimension: 'D4X3' })
    expect(buildBillboardWhere(params)).toEqual({ dimension: 'D4X3' })
  })

  it('filters by clientId via an active-contrat relation', () => {
    const params = new URLSearchParams({ clientId: 'client-1' })
    const where = buildBillboardWhere(params)
    expect(where.contrats).toEqual({ some: { clientId: 'client-1', statut: 'ACTIVE' } })
  })
})
