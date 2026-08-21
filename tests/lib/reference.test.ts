import { describe, it, expect } from 'vitest'
import { generateReference } from '@/lib/reference'

describe('generateReference', () => {
  it('formats as ANM <padded-number> <city-code>', () => {
    expect(generateReference({ sequence: 1, city: 'Antananarivo' })).toBe('ANM 001 TNR')
  })

  it('pads sequence numbers under 100', () => {
    expect(generateReference({ sequence: 42, city: 'Toamasina' })).toBe('ANM 042 TOA')
  })

  it('does not pad sequence numbers over 999', () => {
    expect(generateReference({ sequence: 1234, city: 'Fianarantsoa' })).toBe('ANM 1234 FIA')
  })
})
