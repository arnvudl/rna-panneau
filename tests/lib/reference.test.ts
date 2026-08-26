import { describe, it, expect } from 'vitest'
import { generateReference, resolveCityPrefix } from '@/lib/reference'

describe('resolveCityPrefix', () => {
  it('matches a known city case-insensitively', () => {
    expect(resolveCityPrefix('antananarivo', [{ city: 'Antananarivo', prefix: 'TNR' }])).toBe('TNR')
  })

  it('falls back to the first 3 letters uppercased when no match exists', () => {
    expect(resolveCityPrefix('Nouvelleville', [])).toBe('NOU')
  })
})

describe('generateReference', () => {
  it('pads sequence to 3 digits and uses the resolved prefix, prefix first', () => {
    expect(generateReference({ sequence: 1, city: 'Antananarivo', prefixes: [{ city: 'Antananarivo', prefix: 'TNR' }] })).toBe(
      'TNR 001'
    )
  })

  it('does not pad sequences over 999', () => {
    expect(generateReference({ sequence: 1200, city: 'Diego', prefixes: [{ city: 'Diego', prefix: 'DIE' }] })).toBe(
      'DIE 1200'
    )
  })

  it('never contains the old hardcoded ANM prefix for a city whose real prefix differs', () => {
    expect(generateReference({ sequence: 1, city: 'Antananarivo', prefixes: [{ city: 'Antananarivo', prefix: 'TNR' }] })).not.toContain(
      'ANM'
    )
  })
})
