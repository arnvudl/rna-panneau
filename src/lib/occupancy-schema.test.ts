import { describe, it, expect } from 'vitest'
import { createOccupancySchema } from './occupancy-schema'

const valid = {
  billboardId: 'clx1234',
  clientId: 'clx5678',
}

describe('createOccupancySchema', () => {
  describe('required fields', () => {
    it('accepts minimal valid input (billboardId + clientId)', () => {
      const result = createOccupancySchema.safeParse(valid)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.face).toBe('BOTH')
      }
    })

    it('rejects missing billboardId', () => {
      const result = createOccupancySchema.safeParse({ clientId: 'clx5678' })
      expect(result.success).toBe(false)
    })

    it('rejects missing clientId', () => {
      const result = createOccupancySchema.safeParse({ billboardId: 'clx1234' })
      expect(result.success).toBe(false)
    })

    it('rejects empty object', () => {
      const result = createOccupancySchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('face field', () => {
    it('defaults to BOTH when omitted', () => {
      const result = createOccupancySchema.safeParse(valid)
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.face).toBe('BOTH')
    })

    it('accepts FACE_1', () => {
      const result = createOccupancySchema.safeParse({ ...valid, face: 'FACE_1' })
      expect(result.success).toBe(true)
    })

    it('accepts FACE_2', () => {
      const result = createOccupancySchema.safeParse({ ...valid, face: 'FACE_2' })
      expect(result.success).toBe(true)
    })

    it('rejects invalid face value', () => {
      const result = createOccupancySchema.safeParse({ ...valid, face: 'FACE_3' })
      expect(result.success).toBe(false)
    })

    it('rejects numeric face', () => {
      const result = createOccupancySchema.safeParse({ ...valid, face: 1 })
      expect(result.success).toBe(false)
    })
  })

  describe('contractRef field', () => {
    it('accepts valid contractRef', () => {
      const result = createOccupancySchema.safeParse({ ...valid, contractRef: 'CTR-2026-001' })
      expect(result.success).toBe(true)
    })

    it('trims whitespace from contractRef', () => {
      const result = createOccupancySchema.safeParse({ ...valid, contractRef: '  CTR-001  ' })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.contractRef).toBe('CTR-001')
    })

    it('rejects contractRef longer than 200 chars', () => {
      const result = createOccupancySchema.safeParse({ ...valid, contractRef: 'x'.repeat(201) })
      expect(result.success).toBe(false)
    })

    it('accepts contractRef of exactly 200 chars', () => {
      const result = createOccupancySchema.safeParse({ ...valid, contractRef: 'x'.repeat(200) })
      expect(result.success).toBe(true)
    })
  })

  describe('startDate field', () => {
    it('accepts valid ISO datetime', () => {
      const result = createOccupancySchema.safeParse({
        ...valid,
        startDate: '2026-01-15T00:00:00.000Z',
      })
      expect(result.success).toBe(true)
    })

    it('rejects non-ISO date string (YYYY-MM-DD without time)', () => {
      const result = createOccupancySchema.safeParse({
        ...valid,
        startDate: '2026-01-15',
      })
      expect(result.success).toBe(false)
    })

    it('rejects garbage string', () => {
      const result = createOccupancySchema.safeParse({
        ...valid,
        startDate: 'not-a-date',
      })
      expect(result.success).toBe(false)
    })

    it('rejects numeric timestamp', () => {
      const result = createOccupancySchema.safeParse({
        ...valid,
        startDate: 1700000000000,
      })
      expect(result.success).toBe(false)
    })

    it('accepts when omitted', () => {
      const result = createOccupancySchema.safeParse(valid)
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.startDate).toBeUndefined()
    })
  })

  describe('endDate field', () => {
    it('accepts valid ISO datetime', () => {
      const result = createOccupancySchema.safeParse({
        ...valid,
        endDate: '2027-06-30T23:59:59.999Z',
      })
      expect(result.success).toBe(true)
    })

    it('rejects non-ISO date string', () => {
      const result = createOccupancySchema.safeParse({
        ...valid,
        endDate: '30/06/2027',
      })
      expect(result.success).toBe(false)
    })

    it('accepts when omitted', () => {
      const result = createOccupancySchema.safeParse(valid)
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.endDate).toBeUndefined()
    })
  })

  describe('combined date edge cases', () => {
    it('accepts both startDate and endDate', () => {
      const result = createOccupancySchema.safeParse({
        ...valid,
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-12-31T23:59:59.999Z',
      })
      expect(result.success).toBe(true)
    })

    it('accepts startDate after endDate (no cross-validation in schema)', () => {
      const result = createOccupancySchema.safeParse({
        ...valid,
        startDate: '2027-01-01T00:00:00.000Z',
        endDate: '2026-01-01T00:00:00.000Z',
      })
      expect(result.success).toBe(true)
    })

    it('accepts only startDate without endDate', () => {
      const result = createOccupancySchema.safeParse({
        ...valid,
        startDate: '2026-06-01T00:00:00.000Z',
      })
      expect(result.success).toBe(true)
    })

    it('accepts only endDate without startDate', () => {
      const result = createOccupancySchema.safeParse({
        ...valid,
        endDate: '2026-06-01T00:00:00.000Z',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('extra fields', () => {
    it('strips unknown fields', () => {
      const result = createOccupancySchema.safeParse({
        ...valid,
        hackField: '<script>alert(1)</script>',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect((result.data as Record<string, unknown>).hackField).toBeUndefined()
      }
    })
  })
})
