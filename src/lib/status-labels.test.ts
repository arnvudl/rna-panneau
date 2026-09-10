import { describe, it, expect } from 'vitest'
import { CONTRAT_STATUS_LABELS, CONTRAT_STATUS_STYLES } from './status-labels'
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
