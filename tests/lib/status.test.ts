import { describe, it, expect } from 'vitest'
import { deriveBillboardStatus } from '@/lib/status'

const activeOccupancy = (daysUntilEnd: number | null) => ({
  status: 'ACTIVE' as const,
  endDate: daysUntilEnd === null ? null : new Date(Date.now() + daysUntilEnd * 24 * 60 * 60 * 1000),
  face: 'FACE_1' as const,
})

describe('deriveBillboardStatus', () => {
  it('returns MAINTENANCE when the billboard is flagged damaged', () => {
    expect(deriveBillboardStatus({ damaged: true, statusOverride: null, occupancies: [] })).toBe('MAINTENANCE')
  })

  it('returns AVAILABLE when there is no active occupancy', () => {
    expect(deriveBillboardStatus({ damaged: false, statusOverride: null, occupancies: [] })).toBe('AVAILABLE')
  })

  it('returns RENTED when the active occupancy ends in more than 30 days', () => {
    expect(
      deriveBillboardStatus({ damaged: false, statusOverride: null, occupancies: [activeOccupancy(60)] })
    ).toBe('RENTED')
  })

  it('returns EXPIRING_SOON when the active occupancy ends within 30 days', () => {
    expect(
      deriveBillboardStatus({ damaged: false, statusOverride: null, occupancies: [activeOccupancy(10)] })
    ).toBe('EXPIRING_SOON')
  })

  it('returns EXPIRING_SOON at the exact 30-day boundary', () => {
    expect(
      deriveBillboardStatus({ damaged: false, statusOverride: null, occupancies: [activeOccupancy(30)] })
    ).toBe('EXPIRING_SOON')
  })

  it('returns EXPIRED when the active occupancy end date is in the past', () => {
    expect(
      deriveBillboardStatus({ damaged: false, statusOverride: null, occupancies: [activeOccupancy(-5)] })
    ).toBe('EXPIRED')
  })

  it('returns RENTED indefinitely when the active occupancy has no end date', () => {
    expect(
      deriveBillboardStatus({ damaged: false, statusOverride: null, occupancies: [activeOccupancy(null)] })
    ).toBe('RENTED')
  })

  it('returns the most urgent status across two active faces', () => {
    const now = new Date()
    const soon = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000)
    const later = new Date(now.getTime() + 200 * 24 * 60 * 60 * 1000)
    const status = deriveBillboardStatus({
      damaged: false,
      statusOverride: null,
      occupancies: [
        { status: 'ACTIVE', endDate: soon, face: 'FACE_1' },
        { status: 'ACTIVE', endDate: later, face: 'FACE_2' },
      ],
    })
    expect(status).toBe('EXPIRING_SOON')
  })

  it('is AVAILABLE only when no face has an active occupancy', () => {
    const status = deriveBillboardStatus({
      damaged: false,
      statusOverride: null,
      occupancies: [{ status: 'TERMINATED', endDate: new Date(), face: 'FACE_1' }],
    })
    expect(status).toBe('AVAILABLE')
  })

  it('returns the override verbatim when set, ignoring occupancies', () => {
    const status = deriveBillboardStatus({
      damaged: false,
      statusOverride: 'RENTED',
      occupancies: [],
    })
    expect(status).toBe('RENTED')
  })

  it('returns the override even when damaged is true', () => {
    const status = deriveBillboardStatus({
      damaged: true,
      statusOverride: 'AVAILABLE',
      occupancies: [],
    })
    expect(status).toBe('AVAILABLE')
  })

  it('falls back to automatic derivation when override is null', () => {
    const status = deriveBillboardStatus({
      damaged: true,
      statusOverride: null,
      occupancies: [],
    })
    expect(status).toBe('MAINTENANCE')
  })
})
