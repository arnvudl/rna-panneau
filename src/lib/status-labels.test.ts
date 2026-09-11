import { describe, it, expect } from 'vitest'
import {
  CONTRAT_STATUS_LABELS,
  CONTRAT_STATUS_STYLES,
  CONTRAT_EXPIRING_SOON_WINDOW_DAYS,
  isContratExpiringSoon,
} from './status-labels'
import { CONTRAT_STATUS_VALUES } from './contrat-schema'

describe('CONTRAT_STATUS_STYLES', () => {
  it('has exactly one style entry per ContratStatus value', () => {
    // Guards against a 6th status being added to ContratStatus without a
    // matching style entry, which would silently render an unstyled column.
    expect(Object.keys(CONTRAT_STATUS_STYLES).sort()).toEqual(
      [...CONTRAT_STATUS_VALUES].sort()
    )
  })

  it('has exactly one label entry per ContratStatus value', () => {
    expect(Object.keys(CONTRAT_STATUS_LABELS).sort()).toEqual(
      [...CONTRAT_STATUS_VALUES].sort()
    )
  })
})

describe('isContratExpiringSoon', () => {
  const now = new Date('2026-01-01T00:00:00.000Z')
  const daysFromNow = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString()

  it('is false for a non-ACTIVE contrat, even with a near dateFin', () => {
    expect(
      isContratExpiringSoon({ statut: 'SIGNED', dateFin: daysFromNow(5) }, now)
    ).toBe(false)
  })

  it('is false for an ACTIVE contrat with no dateFin (open-ended)', () => {
    expect(isContratExpiringSoon({ statut: 'ACTIVE', dateFin: null }, now)).toBe(false)
  })

  it('is false for an ACTIVE contrat whose dateFin is far in the future', () => {
    expect(
      isContratExpiringSoon({ statut: 'ACTIVE', dateFin: daysFromNow(CONTRAT_EXPIRING_SOON_WINDOW_DAYS + 1) }, now)
    ).toBe(false)
  })

  it('is true for an ACTIVE contrat whose dateFin falls exactly at the window boundary', () => {
    expect(
      isContratExpiringSoon({ statut: 'ACTIVE', dateFin: daysFromNow(CONTRAT_EXPIRING_SOON_WINDOW_DAYS) }, now)
    ).toBe(true)
  })

  it('is true for an ACTIVE contrat whose dateFin is a few days out', () => {
    expect(isContratExpiringSoon({ statut: 'ACTIVE', dateFin: daysFromNow(3) }, now)).toBe(true)
  })

  it('is true for an ACTIVE contrat whose dateFin is today', () => {
    expect(isContratExpiringSoon({ statut: 'ACTIVE', dateFin: daysFromNow(0) }, now)).toBe(true)
  })

  it('is false for an ACTIVE contrat whose dateFin already passed', () => {
    expect(isContratExpiringSoon({ statut: 'ACTIVE', dateFin: daysFromNow(-1) }, now)).toBe(false)
  })

  it('is false for an ACTIVE contrat with an unparseable dateFin string', () => {
    expect(isContratExpiringSoon({ statut: 'ACTIVE', dateFin: 'not-a-date' }, now)).toBe(false)
  })
})
