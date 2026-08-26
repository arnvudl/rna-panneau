import { describe, it, expect } from 'vitest'
import { isFaceAvailable } from '@/lib/face-occupancy'

describe('isFaceAvailable', () => {
  it('allows BOTH when no active occupancies exist', () => {
    expect(isFaceAvailable('BOTH', [])).toBe(true)
  })

  it('allows FACE_1 when only FACE_2 is active', () => {
    expect(isFaceAvailable('FACE_1', [{ face: 'FACE_2' }])).toBe(true)
  })

  it('blocks FACE_1 when FACE_1 is already active', () => {
    expect(isFaceAvailable('FACE_1', [{ face: 'FACE_1' }])).toBe(false)
  })

  it('blocks FACE_1 when BOTH is already active', () => {
    expect(isFaceAvailable('FACE_1', [{ face: 'BOTH' }])).toBe(false)
  })

  it('blocks BOTH when any face is already active', () => {
    expect(isFaceAvailable('BOTH', [{ face: 'FACE_1' }])).toBe(false)
  })
})
