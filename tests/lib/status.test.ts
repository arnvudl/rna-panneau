import { describe, it, expect } from 'vitest'
import { deriveBillboardStatus } from '@/lib/status'

const activeContrat = (daysUntilEnd: number | null) => ({
  statut: 'ACTIVE' as const,
  dateFin: daysUntilEnd === null ? null : new Date(Date.now() + daysUntilEnd * 24 * 60 * 60 * 1000),
  faces: [{ face: 'FACE_1' as const }],
})

describe('deriveBillboardStatus', () => {
  it('returns MAINTENANCE when the billboard is flagged damaged', () => {
    expect(deriveBillboardStatus({ damaged: true, statusOverride: null, contrats: [] })).toBe('MAINTENANCE')
  })

  it('returns AVAILABLE when there is no active contrat', () => {
    expect(deriveBillboardStatus({ damaged: false, statusOverride: null, contrats: [] })).toBe('AVAILABLE')
  })

  it('returns RENTED when the active contrat ends in more than 30 days', () => {
    expect(
      deriveBillboardStatus({ damaged: false, statusOverride: null, contrats: [activeContrat(60)] })
    ).toBe('RENTED')
  })

  it('returns EXPIRING_SOON when the active contrat ends within 30 days', () => {
    expect(
      deriveBillboardStatus({ damaged: false, statusOverride: null, contrats: [activeContrat(10)] })
    ).toBe('EXPIRING_SOON')
  })

  it('returns EXPIRING_SOON at the exact 30-day boundary', () => {
    expect(
      deriveBillboardStatus({ damaged: false, statusOverride: null, contrats: [activeContrat(30)] })
    ).toBe('EXPIRING_SOON')
  })

  it('returns EXPIRED when the active contrat end date is in the past', () => {
    expect(
      deriveBillboardStatus({ damaged: false, statusOverride: null, contrats: [activeContrat(-5)] })
    ).toBe('EXPIRED')
  })

  it('returns RENTED indefinitely when the active contrat has no end date', () => {
    expect(
      deriveBillboardStatus({ damaged: false, statusOverride: null, contrats: [activeContrat(null)] })
    ).toBe('RENTED')
  })

  it('returns the most urgent status across two active faces', () => {
    const now = new Date()
    const soon = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000)
    const later = new Date(now.getTime() + 200 * 24 * 60 * 60 * 1000)
    const status = deriveBillboardStatus({
      damaged: false,
      statusOverride: null,
      contrats: [
        { statut: 'ACTIVE', dateFin: soon, faces: [{ face: 'FACE_1' }] },
        { statut: 'ACTIVE', dateFin: later, faces: [{ face: 'FACE_2' }] },
      ],
    })
    expect(status).toBe('EXPIRING_SOON')
  })

  it('is AVAILABLE only when no face has an active contrat', () => {
    const status = deriveBillboardStatus({
      damaged: false,
      statusOverride: null,
      contrats: [{ statut: 'ENDED', dateFin: new Date(), faces: [{ face: 'FACE_1' }] }],
    })
    expect(status).toBe('AVAILABLE')
  })

  it('returns the override verbatim when set, ignoring contrats', () => {
    const status = deriveBillboardStatus({
      damaged: false,
      statusOverride: 'RENTED',
      contrats: [],
    })
    expect(status).toBe('RENTED')
  })

  it('returns the override even when damaged is true', () => {
    const status = deriveBillboardStatus({
      damaged: true,
      statusOverride: 'AVAILABLE',
      contrats: [],
    })
    expect(status).toBe('AVAILABLE')
  })

  it('falls back to automatic derivation when override is null', () => {
    const status = deriveBillboardStatus({
      damaged: true,
      statusOverride: null,
      contrats: [],
    })
    expect(status).toBe('MAINTENANCE')
  })
})
