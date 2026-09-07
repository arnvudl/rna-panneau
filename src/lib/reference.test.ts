import { describe, it, expect } from 'vitest'
import { generateReference } from './reference'

describe('generateReference', () => {
  it('formats region code and 4-digit sequence', () => {
    expect(generateReference({ sequence: 1, regionCode: 'DIA' })).toBe('DIA-0001')
  })

  it('pads sequences up to 4 digits', () => {
    expect(generateReference({ sequence: 42, regionCode: 'ANL' })).toBe('ANL-0042')
    expect(generateReference({ sequence: 9999, regionCode: 'ANL' })).toBe('ANL-9999')
  })

  it('does not truncate sequences beyond 4 digits', () => {
    expect(generateReference({ sequence: 12345, regionCode: 'ANL' })).toBe('ANL-12345')
  })
})
