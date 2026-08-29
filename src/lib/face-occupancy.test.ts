import { describe, it, expect } from 'vitest'
import { isFaceAvailable } from './face-occupancy'

describe('isFaceAvailable', () => {
  it('returns true when no active occupancies', () => {
    expect(isFaceAvailable('BOTH', [])).toBe(true)
    expect(isFaceAvailable('FACE_1', [])).toBe(true)
    expect(isFaceAvailable('FACE_2', [])).toBe(true)
  })

  it('returns false for any face when BOTH is already occupied', () => {
    const active = [{ face: 'BOTH' as const }]
    expect(isFaceAvailable('BOTH', active)).toBe(false)
    expect(isFaceAvailable('FACE_1', active)).toBe(false)
    expect(isFaceAvailable('FACE_2', active)).toBe(false)
  })

  it('returns false for BOTH when any single face is occupied', () => {
    expect(isFaceAvailable('BOTH', [{ face: 'FACE_1' }])).toBe(false)
    expect(isFaceAvailable('BOTH', [{ face: 'FACE_2' }])).toBe(false)
  })

  it('allows FACE_2 when FACE_1 is occupied', () => {
    expect(isFaceAvailable('FACE_2', [{ face: 'FACE_1' }])).toBe(true)
  })

  it('allows FACE_1 when FACE_2 is occupied', () => {
    expect(isFaceAvailable('FACE_1', [{ face: 'FACE_2' }])).toBe(true)
  })

  it('returns false when same face is already occupied', () => {
    expect(isFaceAvailable('FACE_1', [{ face: 'FACE_1' }])).toBe(false)
    expect(isFaceAvailable('FACE_2', [{ face: 'FACE_2' }])).toBe(false)
  })

  it('returns false for BOTH when both individual faces are occupied', () => {
    const active = [{ face: 'FACE_1' as const }, { face: 'FACE_2' as const }]
    expect(isFaceAvailable('BOTH', active)).toBe(false)
  })

  it('returns false for FACE_1 when both individual faces are occupied', () => {
    const active = [{ face: 'FACE_1' as const }, { face: 'FACE_2' as const }]
    expect(isFaceAvailable('FACE_1', active)).toBe(false)
  })
})
