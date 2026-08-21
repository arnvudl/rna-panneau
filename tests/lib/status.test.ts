import { describe, it, expect } from 'vitest'
import { deriveBillboardStatus } from '@/lib/status'

const activeContract = (daysUntilEnd: number) => ({
  status: 'ACTIVE' as const,
  endDate: new Date(Date.now() + daysUntilEnd * 24 * 60 * 60 * 1000),
})

describe('deriveBillboardStatus', () => {
  it('returns MAINTENANCE when the billboard is flagged damaged', () => {
    expect(deriveBillboardStatus({ damaged: true, contracts: [] })).toBe('MAINTENANCE')
  })

  it('returns AVAILABLE when there is no active contract', () => {
    expect(deriveBillboardStatus({ damaged: false, contracts: [] })).toBe('AVAILABLE')
  })

  it('returns RENTED when the active contract ends in more than 30 days', () => {
    expect(
      deriveBillboardStatus({ damaged: false, contracts: [activeContract(60)] })
    ).toBe('RENTED')
  })

  it('returns EXPIRING_SOON when the active contract ends within 30 days', () => {
    expect(
      deriveBillboardStatus({ damaged: false, contracts: [activeContract(10)] })
    ).toBe('EXPIRING_SOON')
  })

  it('returns EXPIRED when the active contract end date is in the past', () => {
    expect(
      deriveBillboardStatus({ damaged: false, contracts: [activeContract(-5)] })
    ).toBe('EXPIRED')
  })
})
