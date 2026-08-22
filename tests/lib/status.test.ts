import { describe, it, expect } from 'vitest'
import { deriveBillboardStatus } from '@/lib/status'

const activeContract = (daysUntilEnd: number) => ({
  status: 'ACTIVE' as const,
  endDate: new Date(Date.now() + daysUntilEnd * 24 * 60 * 60 * 1000),
  face: 'FACE_1' as const,
})

describe('deriveBillboardStatus', () => {
  it('returns MAINTENANCE when the billboard is flagged damaged', () => {
    expect(deriveBillboardStatus({ damaged: true, statusOverride: null, contracts: [] })).toBe('MAINTENANCE')
  })

  it('returns AVAILABLE when there is no active contract', () => {
    expect(deriveBillboardStatus({ damaged: false, statusOverride: null, contracts: [] })).toBe('AVAILABLE')
  })

  it('returns RENTED when the active contract ends in more than 30 days', () => {
    expect(
      deriveBillboardStatus({ damaged: false, statusOverride: null, contracts: [activeContract(60)] })
    ).toBe('RENTED')
  })

  it('returns EXPIRING_SOON when the active contract ends within 30 days', () => {
    expect(
      deriveBillboardStatus({ damaged: false, statusOverride: null, contracts: [activeContract(10)] })
    ).toBe('EXPIRING_SOON')
  })

  it('returns EXPIRING_SOON at the exact 30-day boundary', () => {
    expect(
      deriveBillboardStatus({ damaged: false, statusOverride: null, contracts: [activeContract(30)] })
    ).toBe('EXPIRING_SOON')
  })

  it('returns EXPIRED when the active contract end date is in the past', () => {
    expect(
      deriveBillboardStatus({ damaged: false, statusOverride: null, contracts: [activeContract(-5)] })
    ).toBe('EXPIRED')
  })

  it('returns the most urgent status across two active faces', () => {
    const now = new Date()
    const soon = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000)
    const later = new Date(now.getTime() + 200 * 24 * 60 * 60 * 1000)
    const status = deriveBillboardStatus({
      damaged: false,
      statusOverride: null,
      contracts: [
        { status: 'ACTIVE', endDate: soon, face: 'FACE_1' },
        { status: 'ACTIVE', endDate: later, face: 'FACE_2' },
      ],
    })
    expect(status).toBe('EXPIRING_SOON')
  })

  it('is AVAILABLE only when no face has an active contract', () => {
    const status = deriveBillboardStatus({
      damaged: false,
      statusOverride: null,
      contracts: [{ status: 'TERMINATED', endDate: new Date(), face: 'FACE_1' }],
    })
    expect(status).toBe('AVAILABLE')
  })

  it('returns the override verbatim when set, ignoring contracts', () => {
    const status = deriveBillboardStatus({
      damaged: false,
      statusOverride: 'RENTED',
      contracts: [],
    })
    expect(status).toBe('RENTED')
  })

  it('returns the override even when damaged is true', () => {
    const status = deriveBillboardStatus({
      damaged: true,
      statusOverride: 'AVAILABLE',
      contracts: [],
    })
    expect(status).toBe('AVAILABLE')
  })

  it('falls back to automatic derivation when override is null', () => {
    const status = deriveBillboardStatus({
      damaged: true,
      statusOverride: null,
      contracts: [],
    })
    expect(status).toBe('MAINTENANCE')
  })
})
