import { describe, it, expect } from 'vitest'
import { buildBillboardWhere } from '@/app/api/billboards/where'

describe('buildBillboardWhere', () => {
  it('returns an empty object when no filters are given', () => {
    expect(buildBillboardWhere(new URLSearchParams())).toEqual({})
  })

  it('filters by city and damaged', () => {
    const params = new URLSearchParams({ city: 'Toamasina', damaged: 'true' })
    expect(buildBillboardWhere(params)).toEqual({ city: 'Toamasina', damaged: true })
  })

  it('filters by dimension', () => {
    const params = new URLSearchParams({ dimension: 'D4X3' })
    expect(buildBillboardWhere(params)).toEqual({ dimension: 'D4X3' })
  })

  it('filters by clientId via an active-contract relation', () => {
    const params = new URLSearchParams({ clientId: 'client-1' })
    const where = buildBillboardWhere(params)
    expect(where.contracts).toEqual({ some: { clientId: 'client-1', status: 'ACTIVE' } })
  })
})
