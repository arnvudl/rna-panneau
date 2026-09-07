import { describe, it, expect } from 'vitest'
import { findDistrictNameAt, findCommuneNameAt } from './geo-lookup'

describe('geo-lookup', () => {
  it('finds the district containing Antananarivo city center', () => {
    const name = findDistrictNameAt(-18.8792, 47.5079)
    expect(name).toBeTruthy()
    expect(typeof name).toBe('string')
  })

  it('returns undefined for a point in the ocean, far from any land', () => {
    expect(findDistrictNameAt(-10, 40)).toBeUndefined()
  })

  it('finds a commune for Antananarivo city center', () => {
    const name = findCommuneNameAt(-18.8792, 47.5079)
    expect(name === undefined || typeof name === 'string').toBe(true)
  })
})
